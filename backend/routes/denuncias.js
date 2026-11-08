// =====================================================
//  backend/routes/denuncias.js
//  Usuário logado denuncia um evento ou um local (estabelecimento).
//  A denúncia é salva no banco (histórico) E enviada por e-mail
//  para o suporte (roles.suporte@gmail.com).
// =====================================================
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const db = require("../db/db_config");
const { verificarToken } = require("../middleware/auth");
const { wrapEmail, logoAttachment } = require("../services/emailTemplate");

// E-mail que recebe as denúncias (pode trocar no .env com EMAIL_SUPORTE=...)
const EMAIL_SUPORTE = process.env.EMAIL_SUPORTE || "roles.suporte@gmail.com";

// Mesmo transporter usado em routes/admin.js e routes/contato.js
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  family: 4,
  port: 587,
  secure: false,
  connectionTimeout: 10000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// tipo da denúncia -> tabela do alvo (lista fixa, por isso é seguro usar na query)
const TABELA_DO_ALVO = {
  evento: "eventos",
  local: "estabelecimentos",
};

// tipo -> página de detalhe (para o link dentro do e-mail)
const PAGINA_DO_ALVO = {
  evento: "/frontend/detalheseventos/detalheevento.html?id=",
  local: "/frontend/detalheslocais/detalheslocais.html?id=",
};

const ROTULO_MOTIVO = {
  informacoes_incorretas: "Informações incorretas",
  local_fechado: "O local fechou ou não existe",
  conteudo_improprio: "Fotos ou conteúdo impróprio",
  golpe_fraude: "Golpe ou fraude",
  evento_cancelado: "Evento cancelado ou que não vai acontecer",
  outro: "Outro motivo",
};

// Escapa HTML: nome, motivo e descrição vêm de usuários e não podem virar código no e-mail
function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Envia o e-mail para o suporte. Se falhar, quem chama só registra no console:
// a denúncia já está salva no banco e o usuário não precisa ver esse erro.
async function enviarEmailSuporte({ id, tipo, alvoId, alvoNome, motivo, descricao, denunciante, baseUrl }) {
  const tipoTexto = tipo === "evento" ? "Evento" : "Local";
  const link = baseUrl + PAGINA_DO_ALVO[tipo] + encodeURIComponent(alvoId);
  const motivoTexto = ROTULO_MOTIVO[motivo] || motivo;

  await transporter.sendMail({
    from: `"Rolês Denúncias" <${process.env.EMAIL_USER}>`,
    to: EMAIL_SUPORTE,
    subject: `[Denúncia #${id}] ${tipoTexto}: ${alvoNome}`,
    html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Nova denúncia recebida</h2>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          Um usuário denunciou um ${tipoTexto.toLowerCase()} na plataforma.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;margin-bottom:20px;">
          <tr><td style="padding:6px 0;width:130px;color:#999;">Protocolo</td><td><strong>#${id}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#999;">${tipoTexto}</td><td><strong>${esc(alvoNome)}</strong> (id ${alvoId})</td></tr>
          <tr><td style="padding:6px 0;color:#999;">Motivo</td><td>${esc(motivoTexto)}</td></tr>
          <tr><td style="padding:6px 0;color:#999;">Denunciante</td><td>${esc(denunciante)}</td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin:0;">Detalhes informados:</p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:16px 20px;margin:8px 0 24px;font-size:14px;color:#333;line-height:1.7;">
          ${descricao ? esc(descricao).replace(/\n/g, "<br>") : "<em>Sem detalhes adicionais.</em>"}
        </div>
        <a href="${esc(link)}" style="display:inline-block;background:#6c2bd9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:bold;">
          Ver ${tipoTexto.toLowerCase()} denunciado
        </a>
      </td></tr>
    `),
    attachments: [logoAttachment],
  });
}

// POST /denuncias
// body: { tipo: 'evento' | 'local', alvo_id, motivo, descricao? }
router.post("/", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Faça login para denunciar." });

    const tipo = String(req.body.tipo || "").toLowerCase();
    const alvoId = Number.parseInt(req.body.alvo_id, 10);
    const motivo = String(req.body.motivo || "").trim().slice(0, 50);
    const descricao = String(req.body.descricao || "").trim().slice(0, 500);

    const tabela = TABELA_DO_ALVO[tipo];
    if (!tabela) return res.status(400).json({ erro: "Tipo de denúncia inválido." });
    if (!Number.isInteger(alvoId) || alvoId <= 0) return res.status(400).json({ erro: "Item denunciado inválido." });
    if (!motivo) return res.status(400).json({ erro: "Informe o motivo da denúncia." });

    // Confirma que o alvo existe e pega o nome direto do banco (não confia no que veio do front)
    const alvo = await db.query(`SELECT nome FROM ${tabela} WHERE id = ?`, [alvoId]);
    if (!alvo || alvo.length === 0) {
      return res.status(404).json({ erro: "O item denunciado não foi encontrado." });
    }
    const alvoNome = String(alvo[0].nome || "").slice(0, 200);

    // Salva no banco (histórico + impede denúncia repetida enquanto a anterior está aberta)
    const inserido = await db.query(
      `INSERT INTO denuncias (tipo, alvo_id, alvo_nome, motivo, descricao, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tipo, alvoId, alvoNome, motivo, descricao, usuarioId]
    );
    const denunciaId = inserido.insertId;

    // Responde ao usuário já; o e-mail segue em segundo plano
    res.status(201).json({ mensagem: "Denúncia enviada com sucesso." });

    try {
      const u = await db.query("SELECT nome_completo, email FROM usuarios WHERE id = ?", [usuarioId]);
      const denunciante = u[0]
        ? `${u[0].nome_completo || "Sem nome"} (${u[0].email})`
        : `Usuário #${usuarioId}`;

      await enviarEmailSuporte({
        id: denunciaId,
        tipo,
        alvoId,
        alvoNome,
        motivo,
        descricao,
        denunciante,
        baseUrl: process.env.SITE_URL || `${req.protocol}://${req.get("host")}`,
      });
      console.log(`📧 Denúncia #${denunciaId} enviada para ${EMAIL_SUPORTE}`);
    } catch (errEmail) {
      console.error(`❌ Denúncia #${denunciaId} salva, mas o e-mail para o suporte falhou:`, errEmail.message);
    }
  } catch (err) {
    // 23505 = índice único: já existe denúncia aberta desse usuário para esse item
    if (err.code === "23505") {
      return res.status(409).json({ erro: "Você já denunciou este item e a denúncia ainda está em análise." });
    }
    console.error("Erro ao criar denúncia:", err);
    if (!res.headersSent) {
      return res.status(500).json({ erro: "Erro ao enviar a denúncia.", detalhes: err.message });
    }
  }
});

module.exports = router;