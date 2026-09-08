"use strict";

console.log("🔥 CONTROLLER CARREGADO - CAMINHO:", __filename);

const bcrypt     = require("bcrypt");
const connection = require("../db/db_config");
const nodemailer = require("nodemailer");

// ── Cole aqui o base64 completo que você gerou com o PowerShell ──
const fs   = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "../../Frontend/imagens/logo-roles.png");

/* ════════════════════════════════════════
   TEMPLATE BASE DE EMAIL
════════════════════════════════════════ */
function wrapEmail(conteudo) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0edf8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f0edf8;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 24px rgba(108,43,217,.12);max-width:600px;">
  <tr>
    <td style="background:linear-gradient(135deg,#6c2bd9 0%,#9b59b6 100%);padding:40px;text-align:center;">
      <img src="cid:logo_roles" alt="Roles"
           style="width:60px;height:60px;border-radius:12px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
      <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:1px;">Roles</h1>
    </td>
  </tr>
  ${conteudo}
  <tr>
    <td style="background:#1a1a2e;padding:24px 40px;text-align:center;">
      <p style="color:#fff;font-size:13px;margin:0;">© ${new Date().getFullYear()} Roles Eventos - Todos os direitos reservados</p>
      <p style="color:rgba(255,255,255,.5);font-size:12px;margin:6px 0 0;">Duvidas? Entre em contato pelo nosso suporte.</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ════════════════════════════════════════
   SERVIÇO DE EMAIL (GMAIL)
════════════════════════════════════════ */
async function enviarEmail(para, assunto, html) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        family: 4,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    await transporter.sendMail({
        from: `"Roles" <${process.env.EMAIL_USER}>`,
        to:   para,
        subject: assunto,
        html,
        attachments: [
            {
                filename: "logo.png",
                path: LOGO_PATH,
                cid: "logo_roles"
            }
        ]
    });
    console.log("✅ EMAIL ENVIADO!");
}
/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function gerarCodigo() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function enviarEmailCodigo(email, codigo) {
    console.log("📩 TENTANDO ENVIAR EMAIL PARA:", email);
    console.log("🔑 CÓDIGO GERADO:", codigo);

    const html = wrapEmail(`
      <tr><td style="padding:40px;text-align:center;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Verificacao de Conta</h2>
        <p style="color:#555;font-size:15px;margin:0 0 28px;line-height:1.6;">
          Use o codigo abaixo para ativar sua conta no Roles:
        </p>
        <div style="background:#f5f0ff;border:2px dashed #6c2bd9;border-radius:16px;
                    padding:28px;display:inline-block;margin-bottom:28px;">
          <span style="font-size:48px;font-weight:700;letter-spacing:12px;color:#6c2bd9;">
            ${codigo}
          </span>
        </div>
        <p style="color:#999;font-size:13px;margin:0;">
          Este codigo expira em <strong>10 minutos</strong>.<br>
          Se voce nao solicitou isso, ignore este e-mail.
        </p>
      </td></tr>
    `);

    await enviarEmail(email, "Seu codigo de verificacao - Roles", html);
}

/* ════════════════════════════════════════
   CADASTRAR USUÁRIO (2FA)
════════════════════════════════════════ */
async function cadastrarUsuario(req, res) {
    console.log("🔥 CHEGOU NO CONTROLLER cadastrarUsuario");

    try {
        const { nome_completo, email, telefone, cpf, senha } = req.body;

        if (!nome_completo || !email || !senha || !cpf) {
            return res.status(400).json({ erro: "Preencha todos os campos obrigatorios." });
        }

        const cpfLimpo = cpf.replace(/\D/g, "");

        // Verifica no banco se e-mail OU cpf já existem
        const existe = await connection.query(
            "SELECT id, email, cpf FROM usuarios WHERE email = ? OR cpf = ?",
            [email, cpfLimpo]
        );

        if (existe.length > 0) {
            const duplicado = existe[0];
            if (duplicado.email === email) {
                return res.status(400).json({ erro: "E-mail ja cadastrado!" });
            }
            return res.status(400).json({ erro: "CPF ja cadastrado!" });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const codigo    = gerarCodigo();

        console.log("🔑 CÓDIGO GERADO:", codigo);
        console.log("🔥 VAI INSERIR USUÁRIO...");

        const insert = await connection.query(
            `INSERT INTO usuarios (nome_completo, email, telefone, cpf, senha, codigo_verificacao, verificado)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [nome_completo, email, telefone || null, cpfLimpo, senhaHash, codigo]
        );

        console.log("✅ USUÁRIO INSERIDO COM SUCESSO");

        const novoId = insert.insertId ?? insert[0]?.id ?? null;

        try {
            await enviarEmailCodigo(email, codigo);
            return res.status(201).json({
                mensagem: "Usuario criado! Codigo enviado por email.",
                id: novoId,
            });
        } catch (erroEmail) {
            console.error("❌ ERRO AO ENVIAR EMAIL:", erroEmail.message);
            return res.status(201).json({
                mensagem: "Usuario criado, mas houve erro ao enviar o email. Use o reenvio.",
                id: novoId,
                avisoEmail: erroEmail.message,
            });
        }

    } catch (erro) {
        console.error("❌ ERRO GERAL cadastrarUsuario:", erro.message);
        return res.status(500).json({ erro: "Erro interno do servidor", detalhes: erro.message });
    }
}

/* ════════════════════════════════════════
   LISTAR USUÁRIOS
════════════════════════════════════════ */
async function listarUsuarios(req, res) {
    try {
        const results = await connection.query(
            "SELECT id, nome_completo, email, telefone, criado_em FROM usuarios"
        );
        res.json(results);
    } catch (err) {
        res.status(500).json({ erro: "Erro no servidor.", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   BUSCAR USUÁRIO POR ID
════════════════════════════════════════ */
async function buscarUsuarioPorId(req, res) {
    const { id } = req.params;
    if (!id) return res.status(400).json({ erro: "ID do usuario e obrigatorio." });

    try {
        const results = await connection.query(
            `SELECT id, nome_completo, sobrenome, email, telefone,
                    foto_perfil, cpf, nascimento, sexo,
                    cidade, estado, criado_em
             FROM usuarios WHERE id = ?`,
            [id]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({ erro: "Usuario nao encontrado." });
        }

        res.json(results[0]);
    } catch (err) {
        console.error("❌ ERRO buscarUsuarioPorId:", err.message);
        res.status(500).json({ erro: "Erro ao buscar usuario.", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   ATUALIZAR USUÁRIO (perfil)
════════════════════════════════════════ */
async function atualizarUsuario(req, res) {
    const { id, nome_completo, sobrenome, email, telefone,
            foto_perfil, cpf, nascimento, sexo } = req.body;

    if (!id) return res.status(400).json({ erro: "ID do usuario e obrigatorio." });

    try {
        await connection.query(
            `UPDATE usuarios
             SET nome_completo = ?, sobrenome = ?, email = ?, telefone = ?,
                 foto_perfil = ?, cpf = ?, nascimento = ?, sexo = ?
             WHERE id = ?`,
            [nome_completo, sobrenome || null, email, telefone || null,
             foto_perfil || null, cpf || null, nascimento || null, sexo || null, id]
        );
        res.json({ mensagem: "Usuario atualizado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar usuario.", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   ENVIAR CÓDIGO (reenvio)
════════════════════════════════════════ */
async function enviarCodigo(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "E-mail obrigatorio." });

    const codigo = gerarCodigo();

    try {
        const result = await connection.query(
            "UPDATE usuarios SET codigo_verificacao = ? WHERE email = ?",
            [codigo, email]
        );

        const affected = result.affectedRows ?? result.rowCount ?? 1;
        if (affected === 0) return res.status(404).json({ erro: "Usuario nao encontrado." });

        await enviarEmailCodigo(email, codigo);
        res.json({ mensagem: "Codigo enviado com sucesso!" });

    } catch (err) {
        console.error("❌ ERRO enviarCodigo:", err.message);
        res.status(500).json({ erro: "Erro ao enviar e-mail.", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   VERIFICAR CÓDIGO
════════════════════════════════════════ */
async function verificarCodigo(req, res) {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
        return res.status(400).json({ erro: "Email e codigo sao obrigatorios" });
    }

    try {
        const results = await connection.query(
            "SELECT codigo_verificacao, verificado FROM usuarios WHERE email = ?",
            [email]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({ erro: "Usuario nao encontrado" });
        }

        const usuario = results[0];
        if (usuario.verificado) return res.json({ verificado: true });
        if (usuario.codigo_verificacao !== codigo) return res.json({ verificado: false });

        await connection.query(
            "UPDATE usuarios SET verificado = 1, codigo_verificacao = NULL WHERE email = ?",
            [email]
        );
        return res.json({ verificado: true });

    } catch (err) {
        res.status(500).json({ erro: "Erro no servidor", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   RECUPERAR SENHA
════════════════════════════════════════ */
async function recuperarSenha(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "E-mail obrigatorio." });

    const codigo = gerarCodigo();
    const expira = new Date(Date.now() + 10 * 60 * 1000);

    try {
        const result = await connection.query(
            "UPDATE usuarios SET codigo_recuperacao = ?, codigo_expira_em = ? WHERE email = ?",
            [codigo, expira, email]
        );

        const affected = result.affectedRows ?? result.rowCount ?? 1;
        if (affected === 0) return res.status(404).json({ erro: "Usuario nao encontrado" });

        await enviarEmail(
            email,
            "Recuperacao de senha - Roles",
            wrapEmail(`
              <tr><td style="padding:40px;text-align:center;">
                <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Recuperacao de Senha</h2>
                <p style="color:#555;font-size:15px;margin:0 0 28px;line-height:1.6;">
                  Recebemos um pedido para redefinir sua senha. Use o codigo abaixo:
                </p>
                <div style="background:#f5f0ff;border:2px dashed #6c2bd9;border-radius:16px;
                            padding:28px;display:inline-block;margin-bottom:28px;">
                  <span style="font-size:48px;font-weight:700;letter-spacing:12px;color:#6c2bd9;">
                    ${codigo}
                  </span>
                </div>
                <p style="color:#999;font-size:13px;margin:0;">
                  Este codigo expira em <strong>10 minutos</strong>.<br>
                  Se voce nao solicitou isso, ignore este e-mail.
                </p>
              </td></tr>
            `)
        );
        res.json({ mensagem: "Codigo enviado no e-mail." });

    } catch (err) {
        console.error("❌ ERRO recuperarSenha:", err.message);
        res.status(500).json({ erro: "Erro ao enviar e-mail." });
    }
}

/* ════════════════════════════════════════
   REDEFINIR SENHA
════════════════════════════════════════ */
async function redefinirSenha(req, res) {
    const { email, codigo, novaSenha } = req.body;
    if (!email || !codigo || !novaSenha) {
        return res.status(400).json({ erro: "Preencha todos os campos." });
    }

    try {
        const results = await connection.query(
            "SELECT codigo_recuperacao, codigo_expira_em FROM usuarios WHERE email = ?",
            [email]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({ erro: "Usuario nao encontrado" });
        }

        const usuario = results[0];
        if (usuario.codigo_recuperacao !== codigo) {
            return res.status(400).json({ erro: "Codigo invalido" });
        }
        if (new Date() > new Date(usuario.codigo_expira_em)) {
            return res.status(400).json({ erro: "Codigo expirado" });
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10);
        await connection.query(
            `UPDATE usuarios SET senha = ?, codigo_recuperacao = NULL,
             codigo_expira_em = NULL, tentativas_login = 0, bloqueado_ate = NULL
             WHERE email = ?`,
            [senhaHash, email]
        );
        res.json({ mensagem: "Senha redefinida com sucesso!" });

    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar senha", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   ALTERAR SENHA
════════════════════════════════════════ */
async function alterarSenha(req, res) {
    const { id, senhaAtual, novaSenha } = req.body;
    if (!id || !senhaAtual || !novaSenha) {
        return res.status(400).json({ erro: "Preencha todos os campos." });
    }

    try {
        const results = await connection.query(
            "SELECT senha FROM usuarios WHERE id = ?", [id]
        );

        if (!results || results.length === 0) {
            return res.status(404).json({ erro: "Usuario nao encontrado" });
        }

        const ok = await bcrypt.compare(senhaAtual, results[0].senha);
        if (!ok) return res.status(401).json({ erro: "Senha atual incorreta." });

        const senhaHash = await bcrypt.hash(novaSenha, 10);
        await connection.query(
            "UPDATE usuarios SET senha = ? WHERE id = ?", [senhaHash, id]
        );
        res.json({ mensagem: "Senha alterada com sucesso!" });

    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar senha", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   TOGGLE ALERTA DISPOSITIVO
════════════════════════════════════════ */
async function toggleAlertaDispositivo(req, res) {
    const { id, alerta } = req.body;
    if (!id) return res.status(400).json({ erro: "ID obrigatorio." });
    try {
        await connection.query(
            "UPDATE usuarios SET alerta_novo_dispositivo = ? WHERE id = ?",
            [alerta, id]
        );
        res.json({ mensagem: "Preferencia atualizada." });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar.", detalhes: err.message });
    }
}

/* ════════════════════════════════════════
   EXPORTS
════════════════════════════════════════ */
module.exports = {
    cadastrarUsuario,
    listarUsuarios,
    buscarUsuarioPorId,
    atualizarUsuario,
    enviarCodigo,
    verificarCodigo,
    recuperarSenha,
    redefinirSenha,
    alterarSenha,
    toggleAlertaDispositivo,
};