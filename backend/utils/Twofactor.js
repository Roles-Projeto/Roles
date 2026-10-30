"use strict";

const crypto = require("crypto");

const ALFABETO_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/* ════════════════════════════════════════
   TOKEN TEMPORÁRIO (etapa entre senha e código)
   Usa um segredo DIFERENTE do JWT normal, então esse token
   nunca é aceito como login pelo middleware auth.js.
════════════════════════════════════════ */
function segredoTemporario() {
  return `${process.env.JWT_SECRET}:2fa`;
}

/* ════════════════════════════════════════
   BASE32 (formato que os apps autenticadores usam)
════════════════════════════════════════ */
function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALFABETO_B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALFABETO_B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const limpo = str.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (const ch of limpo) {
    const idx = ALFABETO_B32.indexOf(ch);
    if (idx < 0) throw new Error("Segredo base32 inválido.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ════════════════════════════════════════
   TOTP (RFC 6238): 6 dígitos, 30 segundos, SHA-1
════════════════════════════════════════ */
function gerarSegredo() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(segredoBuf, contador) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac("sha1", segredoBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const codigo =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(codigo % 1000000).padStart(6, "0");
}

// Aceita o código atual e o anterior/próximo (tolerância de relógio de ±30s)
function verificarTotp(segredoB32, codigo, janela = 1) {
  const informado = String(codigo || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(informado)) return false;

  const segredoBuf = base32Decode(segredoB32);
  const contadorAtual = Math.floor(Date.now() / 1000 / 30);

  for (let i = -janela; i <= janela; i++) {
    const esperado = hotp(segredoBuf, contadorAtual + i);
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(informado))) {
      return true;
    }
  }
  return false;
}

function gerarUrlOtpauth(email, segredoB32) {
  const emissor = "Rolês";
  return (
    `otpauth://totp/${encodeURIComponent(emissor)}:${encodeURIComponent(email)}` +
    `?secret=${segredoB32}&issuer=${encodeURIComponent(emissor)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}

/* ════════════════════════════════════════
   CRIPTOGRAFIA DO SEGREDO NO BANCO (AES-256-GCM)
   Se o banco vazar, os segredos não servem sozinhos.
   Use TOTP_ENC_KEY no .env (se não existir, usa o JWT_SECRET).
════════════════════════════════════════ */
function chaveCripto() {
  return crypto
    .createHash("sha256")
    .update(process.env.TOTP_ENC_KEY || process.env.JWT_SECRET)
    .digest();
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chaveCripto(), iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("hex")).join(":");
}

function decifrar(payload) {
  const [iv, tag, enc] = payload.split(":").map((h) => Buffer.from(h, "hex"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", chaveCripto(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/* ════════════════════════════════════════
   CÓDIGOS DE RECUPERAÇÃO (uso único)
════════════════════════════════════════ */
function gerarCodigosRecuperacao(quantidade = 8) {
  return Array.from({ length: quantidade }, () => {
    const hex = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 caracteres
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

// Normaliza para comparar sem depender de traço, espaço ou maiúscula
function normalizarCodigoRecuperacao(codigo) {
  return String(codigo || "").replace(/[\s-]/g, "").toUpperCase();
}

module.exports = {
  segredoTemporario,
  gerarSegredo,
  verificarTotp,
  gerarUrlOtpauth,
  cifrar,
  decifrar,
  gerarCodigosRecuperacao,
  normalizarCodigoRecuperacao,
};