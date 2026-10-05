const express = require("express");
const router = express.Router();
const connection = require("../db/db_config");
const nodemailer = require("nodemailer");
const { wrapEmail, logoAttachment } = require("../services/emailTemplate");


async function criarTransporter() {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}
router.post("/", async (req, res) => {
    const { nome, email, tipo, assunto, mensagem } = req.body;

    if (!nome || !email || !tipo || !assunto || !mensagem) {
        return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
    }

    connection.query(
        `INSERT INTO contatos (nome, email, tipo, assunto, mensagem) VALUES (?, ?, ?, ?, ?)`,
        [nome.trim(), email.trim(), tipo.trim(), assunto.trim(), mensagem.trim()],
        async (err, result) => {
            if (err) {
                console.error("Erro ao salvar contato:", err.message);
                return res.status(500).json({ erro: "Erro ao salvar mensagem." });
            }

            try {
                const transporter = await criarTransporter();

                // Email pra voce (suporte)
                await transporter.sendMail({
                    from: `"Rolês Contato" <${process.env.EMAIL_USER}>`,
                    to: process.env.EMAIL_USER,
                    replyTo: email,
                    subject: `[Rolês] ${tipo.toUpperCase()} - ${assunto}`,
                    html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;">Nova mensagem de contato</h2>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Nome:</strong> ${nome}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Motivo:</strong> ${tipo}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Assunto:</strong> ${assunto}</p>
          <p style="margin:0;font-size:14px;color:#555;"><strong>Protocolo:</strong> #${result.insertId}</p>
        </div>
        <p style="color:#555;font-size:14px;margin:0 0 8px;"><strong>Mensagem:</strong></p>
        <div style="background:#fafafa;border-left:3px solid #ddd;padding:12px 16px;font-size:14px;color:#333;line-height:1.7;">
          ${mensagem}
        </div>
      </td></tr>
    `),
                    attachments: [logoAttachment]
                });
                // Confirmacao pro usuario
                await transporter.sendMail({
                    from: `"Rolês" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: `Recebemos sua mensagem — ${assunto}`,
                    html: wrapEmail(`
      <tr><td style="padding:40px;text-align:center;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Mensagem recebida!</h2>
        <p style="color:#333;font-size:15px;margin:0 0 12px;">Olá, <strong>${nome}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
          Recebemos sua mensagem sobre <strong>${assunto}</strong> e retornaremos em até 24 horas úteis.
        </p>
        <div style="background:#f5f0ff;border:2px dashed #6c2bd9;border-radius:12px;padding:20px;display:inline-block;">
          <p style="margin:0;font-size:13px;color:#555;">Protocolo</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#6c2bd9;letter-spacing:4px;">#${result.insertId}</p>
        </div>
      </td></tr>
    `),
                    attachments: [logoAttachment]
                });

                console.log("Emails de contato enviados com sucesso");
            } catch (mailErr) {
                console.error("Erro ao enviar email de contato:", mailErr.message);
            }

            res.status(201).json({
                mensagem: "Contato recebido com sucesso!",
                id: result.insertId,
            });
        }
    );
});

module.exports = router;