"use strict";

const connection = require("../db/db_config");
const { enviarEmailCandidatura } = require("../services/emailService");

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */

/*
 * Descobre o tipo REAL do arquivo pelos primeiros bytes.
 * Não confiamos no mimetype/extensão enviados pelo navegador,
 * pois o cliente pode mentir sobre eles.
 */
function detectarTipo(buf) {
    if (!buf || buf.length < 12) return null;

    if (buf.slice(0, 5).toString("latin1") === "%PDF-") {
        return "application/pdf";
    }

    if (
        buf[0] === 0x89 &&
        buf.slice(1, 4).toString("latin1") === "PNG"
    ) {
        return "image/png";
    }

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return "image/jpeg";
    }

    if (
        buf.slice(0, 4).toString("latin1") === "RIFF" &&
        buf.slice(8, 12).toString("latin1") === "WEBP"
    ) {
        return "image/webp";
    }

    return null;
}

// O multer entrega o nome em latin1; converte para UTF-8 para manter acentos
function nomeSeguroDoArquivo(originalname) {
    const utf8 = Buffer.from(originalname || "curriculo", "latin1").toString("utf8");

    return utf8
        .replace(/[\\/]/g, "_")
        .replace(/[\u0000-\u001f]/g, "")
        .slice(0, 255);
}

function texto(valor, max) {
    if (typeof valor !== "string") return "";
    return valor.trim().slice(0, max);
}

/* ════════════════════════════════════════
   CRIAR CANDIDATURA
   POST /candidaturas   (multipart/form-data)
════════════════════════════════════════ */

async function criarCandidatura(req, res) {
    try {

        // Honeypot: campo escondido que só robôs preenchem.
        // Responde sucesso sem gravar nada.
        if (req.body.website) {
            return res.status(201).json({ mensagem: "Candidatura recebida!" });
        }

        const nome          = texto(req.body.nome, 120);
        const whatsapp      = String(req.body.whatsapp || "").replace(/\D/g, "");
        const email         = texto(req.body.email, 120);
        const vaga          = texto(req.body.vaga, 120);
        const cidadeEstado  = texto(req.body.cidade_estado, 80);

        if (nome.length < 3) {
            return res.status(400).json({ erro: "Informe seu nome completo." });
        }

        if (whatsapp.length < 10 || whatsapp.length > 11) {
            return res.status(400).json({ erro: "Informe um WhatsApp válido, com DDD." });
        }

        if (!vaga) {
            return res.status(400).json({ erro: "Escolha a vaga de interesse." });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ erro: "O e-mail informado não é válido." });
        }

        // Currículo (opcional)
        let curriculoNome  = null;
        let curriculoTipo  = null;
        let curriculoDados = null;

        if (req.file) {
            const tipoReal = detectarTipo(req.file.buffer);

            if (!tipoReal) {
                return res.status(400).json({
                    erro: "Formato de currículo inválido. Envie um PDF ou uma imagem (PNG, JPG ou WEBP)."
                });
            }

            curriculoNome  = nomeSeguroDoArquivo(req.file.originalname);
            curriculoTipo  = tipoReal;
            curriculoDados = req.file.buffer;
        }

        // 1) Salva no banco (fonte da verdade)
        const resultado = await connection.query(
            `INSERT INTO candidaturas
                (nome, whatsapp, email, vaga, cidade_estado,
                 curriculo_nome, curriculo_tipo, curriculo_dados)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [
                nome,
                whatsapp,
                email || null,
                vaga,
                cidadeEstado || null,
                curriculoNome,
                curriculoTipo,
                curriculoDados
            ]
        );

        const candidaturaId = resultado?.[0]?.id;

        // 2) Notificação por e-mail
        // A candidatura JÁ está salva. Qualquer falha aqui é registrada,
        // mas não derruba a resposta ao usuário.
        try {
            await enviarEmailCandidatura(
                { nome, whatsapp, email, vaga, cidadeEstado },
                curriculoDados
                    ? { nome: curriculoNome, tipo: curriculoTipo, dados: curriculoDados }
                    : null
            );

            if (candidaturaId) {
                await connection.query(
                    `UPDATE candidaturas
                        SET email_enviado = TRUE, email_enviado_em = NOW(), email_erro = NULL
                      WHERE id = ?`,
                    [candidaturaId]
                );
            }
        } catch (errEmail) {
            console.error(`⚠️ Falha ao enviar e-mail da candidatura ${candidaturaId}:`, errEmail.message);

            if (candidaturaId) {
                try {
                    await connection.query(
                        "UPDATE candidaturas SET email_erro = ? WHERE id = ?",
                        [String(errEmail.message).slice(0, 500), candidaturaId]
                    );
                } catch (errLog) {
                    console.error("⚠️ Não foi possível registrar o erro do e-mail:", errLog.message);
                }
            }
        }

        // 3) Usuário recebe sucesso porque o banco gravou
        return res.status(201).json({ mensagem: "Candidatura recebida!" });

    } catch (err) {

        console.error("❌ ERRO criarCandidatura:", err.message);

        // Não devolve err.message ao cliente (pode expor detalhes do banco)
        return res.status(500).json({
            erro: "Não foi possível enviar sua candidatura. Tente novamente."
        });
    }
}

module.exports = {
    criarCandidatura
};