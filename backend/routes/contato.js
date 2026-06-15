const express    = require("express");
const router     = express.Router();
const connection = require("../db/db_config");
const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
                if (resend) {
                    await resend.emails.send({
                        from: "Rolês Contato <onboarding@resend.dev>",
                        to: process.env.EMAIL_USER,
                        replyTo: email,
                        subject: `[Rolês] ${tipo.toUpperCase()} – ${assunto}`,
                        html: `<p><b>Nome:</b> ${nome}</p><p><b>Email:</b> ${email}</p><p><b>Motivo:</b> ${tipo}</p><p><b>Assunto:</b> ${assunto}</p><p><b>Mensagem:</b> ${mensagem}</p>`,
                    });
                }
            } catch (mailErr) {
                console.error("Aviso: e-mail não enviado:", mailErr.message);
            }

            try {
                if (resend) {
                    await resend.emails.send({
                        from: "Rolês <onboarding@resend.dev>",
                        to: email,
                        subject: `Recebemos sua mensagem – ${assunto}`,
                        html: `<p>Olá, <b>${nome}</b>! Recebemos sua mensagem sobre <b>${assunto}</b> e retornaremos em até 24 horas úteis. Protocolo: <b>#${result.insertId}</b></p>`,
                    });
                }
            } catch (mailErr) {
                console.error("Aviso: confirmação ao usuário não enviada:", mailErr.message);
            }

            res.status(201).json({
                mensagem: "Contato recebido com sucesso!",
                id: result.insertId,
            });
        }
    );
});

module.exports = router;