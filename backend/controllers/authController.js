"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/db_config");
const nodemailer = require("nodemailer");

/* ════════════════════════════════════════
   CONSTANTES DE LIMITE DE TENTATIVAS
════════════════════════════════════════ */
const MAX_TENTATIVAS = 4;   // bloqueia na 4ª tentativa errada
const BLOQUEIO_MINUTOS = 15;  // tempo de bloqueio em minutos

/* ════════════════════════════════════════
   EMAIL
════════════════════════════════════════ */
async function enviarEmail(para, assunto, html) {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      family: 4,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Rolês" <${process.env.EMAIL_USER}>`,
      to: para, subject: assunto, html,
    });
  }
}

/* ════════════════════════════════════════
   GARANTE TABELA login_historico
════════════════════════════════════════ */
async function ensureHistoricoTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS login_historico (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id  INT          NOT NULL,
      ip          VARCHAR(64),
      dispositivo VARCHAR(255),
      navegador   VARCHAR(100),
      criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => { });
}
ensureHistoricoTable();

/* ════════════════════════════════════════
   DETECTAR NAVEGADOR / DISPOSITIVO
════════════════════════════════════════ */
function detectarNavegador(ua) {
  if (!ua) return "Desconhecido";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Navegador";
}

function detectarDispositivo(ua) {
  if (!ua) return "Desktop";
  return /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";
}

/* ════════════════════════════════════════
   LOGIN
════════════════════════════════════════ */
exports.loginUsuario = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Preencha email e senha." });

  try {
    // ── 1. Busca o usuário ─────────────────────────────
    const results = await db.query(
      "SELECT * FROM usuarios WHERE email = ?", [email]
    );
    if (!results.length)
      return res.status(400).json({ erro: "Email não cadastrado." });

    const usuario = results[0];

    // ── 2. Verifica se está bloqueado ──────────────────
    if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate + 'Z') > new Date()) {
      const minutosRestantes = Math.ceil(
        (new Date(usuario.bloqueado_ate) - new Date()) / 60000
      );
      return res.status(429).json({
        erro: "Conta bloqueada temporariamente.",
        bloqueado: true,
        minutosRestantes,
        mensagem: `Muitas tentativas incorretas. Tente novamente em ${minutosRestantes} minuto(s) ou entre em contato com o suporte para reaver seu acesso.`,
        suporte: true,
      });
    }

    // ── 3. Conta não verificada ────────────────────────
    if (!usuario.verificado)
      return res.status(403).json({
        erro: "Conta não verificada. Verifique o código enviado por email.",
      });

    // ── 4. Verifica a senha ────────────────────────────
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      const novasTentativas = (usuario.tentativas_login || 0) + 1;
      const restantes = MAX_TENTATIVAS - novasTentativas;

      if (novasTentativas >= MAX_TENTATIVAS) {
        // ── Bloqueia por 30 minutos ──
        await db.query(
          `UPDATE usuarios
   SET tentativas_login = ?, bloqueado_ate = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
       ultima_tentativa = UTC_TIMESTAMP()
   WHERE id = ?`,
          [novasTentativas, BLOQUEIO_MINUTOS, usuario.id]
        );
        // ── Envia e-mail de aviso ──
        enviarEmail(
          email,
          "Conta bloqueada por tentativas incorretas — Rolês",
          `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
                      padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#e53e3e;">⚠️ Conta bloqueada temporariamente</h2>
            <p>Olá, <strong>${usuario.nome_completo}</strong>!</p>
            <p>Detectamos <strong>${MAX_TENTATIVAS} tentativas incorretas</strong>
               de acesso à sua conta.</p>
            <div style="background:#fff;border-radius:8px;padding:16px;
                        margin:16px 0;border-left:4px solid #e53e3e;">
              <p><strong>Conta bloqueada por:</strong> ${BLOQUEIO_MINUTOS} minutos</p>
              <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR",
            { timeZone: "America/Sao_Paulo" })}</p>
            </div>
            <p>Se foi você, aguarde ${BLOQUEIO_MINUTOS} minutos e tente novamente,
               ou <a href="${process.env.FRONTEND_URL}/recuperar-senha"
               style="color:#6c3dff;">redefina sua senha</a>.</p>
            <p>Se <strong>não foi você</strong>, entre em contato com nosso
               <a href="${process.env.FRONTEND_URL}/contato" style="color:#6c3dff;">
               suporte</a> imediatamente.</p>
            <p style="color:#999;font-size:12px;margin-top:24px;">
              Rolês — Sua plataforma de eventos</p>
          </div>
          `
        ).catch(() => { });

        return res.status(429).json({
          erro: "Conta bloqueada temporariamente.",
          bloqueado: true,
          minutosRestantes: BLOQUEIO_MINUTOS,
          mensagem: `Você atingiu o limite de ${MAX_TENTATIVAS} tentativas. Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos. Você pode redefinir sua senha ou contatar o suporte.`,
          suporte: true,
        });
      }

      // ── Ainda tem tentativas ──
      await db.query(
        `UPDATE usuarios
   SET tentativas_login = ?, ultima_tentativa = UTC_TIMESTAMP()
   WHERE id = ?`,
        [novasTentativas, usuario.id]
      );

      return res.status(400).json({
        erro: "Senha incorreta.",
        tentativasRestantes: restantes,
        mensagem: `Senha incorreta. Você ainda tem ${restantes} tentativa(s) antes do bloqueio.`,
      });
    }

    // ── 5. Login bem-sucedido — reseta tentativas ──────
    await db.query(
      `UPDATE usuarios
       SET tentativas_login = 0, bloqueado_ate = NULL, ultima_tentativa = NULL
       WHERE id = ?`,
      [usuario.id]
    ).catch(() => { });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // ── Dados do dispositivo ───────────────────────────
    const ua = req.headers["user-agent"] || "";
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "—";
    const navegador = detectarNavegador(ua);
    const dispositivo = detectarDispositivo(ua);
    const dispositivoStr = `${navegador} — ${dispositivo}`;

    // ── Salva no histórico ─────────────────────────────
    await db.query(
      "INSERT INTO login_historico (usuario_id, ip, dispositivo, navegador) VALUES (?, ?, ?, ?)",
      [usuario.id, ip, dispositivoStr, navegador]
    ).catch(() => { });

    // ── Verifica se é dispositivo novo ─────────────────
    const historicoAnterior = await db.query(
      `SELECT id FROM login_historico
       WHERE usuario_id = ? AND dispositivo = ?
       ORDER BY criado_em DESC LIMIT 10`,
      [usuario.id, dispositivoStr]
    ).catch(() => []);

    const isNovoDispositivo =
      Array.isArray(historicoAnterior) && historicoAnterior.length === 1;

    // ── Alerta de dispositivo novo ─────────────────────
    const alertaAtivo = usuario.alerta_novo_dispositivo !== 0;

    if (isNovoDispositivo && usuario.email && alertaAtivo) {
      const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      enviarEmail(
        usuario.email,
        "Novo acesso a sua conta Roles",
        `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
                    padding:32px;background:#f9f9f9;border-radius:12px;">
          <h2 style="color:#6c3dff;">Novo dispositivo detectado</h2>
          <p>Olá, <strong>${usuario.nome_completo}</strong>!</p>
          <p>Detectamos um acesso à sua conta a partir de um novo dispositivo:</p>
          <div style="background:#fff;border-radius:8px;padding:16px;
                      margin:16px 0;border-left:4px solid #6c3dff;">
            <p><strong>Dispositivo:</strong> ${dispositivoStr}</p>
            <p><strong>IP:</strong> ${ip}</p>
            <p><strong>Data/Hora:</strong> ${agora}</p>
          </div>
          <p>Se foi você, pode ignorar este e-mail.</p>
          <p>Se não foi você, acesse sua conta e altere sua senha imediatamente.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">
            Rolês — Sua plataforma de eventos</p>
        </div>
        `
      ).catch(() => { });
    }

    res.json({
      mensagem: "Login realizado com sucesso!",
      token,
      id: usuario.id,
      nome_completo: usuario.nome_completo,
      email: usuario.email,
      telefone: usuario.telefone,
      foto_perfil: usuario.foto_perfil,
      role: usuario.role,
    });

  } catch (err) {
    console.error("❌ loginUsuario:", err);
    res.status(500).json({ erro: "Erro no servidor.", detalhes: err.message });
  }
};

/* ════════════════════════════════════════
   DESBLOQUEAR CONTA (via Admin/Suporte)
   POST /auth/desbloquear
════════════════════════════════════════ */
exports.desbloquearConta = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ erro: "Email é obrigatório." });

  try {
    await db.query(
      `UPDATE usuarios
       SET tentativas_login = 0, bloqueado_ate = NULL, ultima_tentativa = NULL
       WHERE email = ?`,
      [email]
    );
    res.json({ mensagem: `Conta ${email} desbloqueada com sucesso.` });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao desbloquear conta.", detalhes: err.message });
  }
};

/* ════════════════════════════════════════
   HISTÓRICO DE ACESSOS
   GET /usuarios/historico-acessos/:id
════════════════════════════════════════ */
exports.historicoAcessos = async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.query(
      `SELECT id, ip, dispositivo, navegador, criado_em
       FROM login_historico
       WHERE usuario_id = ?
       ORDER BY criado_em DESC
       LIMIT 20`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar histórico.", detalhes: err.message });
  }
};