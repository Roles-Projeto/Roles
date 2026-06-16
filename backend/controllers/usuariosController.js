"use strict";

console.log("🔥 CONTROLLER CARREGADO - CAMINHO:", __filename);

const bcrypt = require("bcrypt");
const connection = require("../db/db_config");
const { Resend } = require("resend");
const nodemailer = require("nodemailer");

/* ════════════════════════════════════════
   SERVIÇO DE EMAIL (RESEND ou GMAIL)
════════════════════════════════════════ */
async function enviarEmail(para, assunto, html) {
  if (process.env.RESEND_API_KEY) {
    console.log("📧 Usando Resend...");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Roles App <onboarding@resend.dev>",
      to: para,
      subject: assunto,
      html,
    });
    if (error) throw new Error(error.message);

  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log("📧 Usando Gmail...");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      family: 4,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    await transporter.sendMail({
      from: `"Roles App" <${process.env.EMAIL_USER}>`,
      to: para,
      subject: assunto,
      html,
    });

  } else {
    throw new Error("Nenhum serviço de e-mail configurado.");
  }

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

  await enviarEmail(
    email,
    "Seu codigo de verificacao - Roles",
    `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;
                padding: 32px; background: #f9f9f9; border-radius: 12px;">
      <h2 style="color: #333;">Verificacao de Conta 🎉</h2>
      <p style="color: #555;">Use o codigo abaixo para ativar sua conta:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #6c3dff;">
          ${codigo}
        </span>
      </div>
      <p style="color: #999; font-size: 13px;">
        Este codigo expira em 10 minutos.
        Se voce nao solicitou isso, ignore este email.
      </p>
    </div>
    `
  );
}

/* ════════════════════════════════════════
   CADASTRAR USUÁRIO (2FA)
════════════════════════════════════════ */
async function cadastrarUsuario(req, res) {
  console.log("🔥 CHEGOU NO CONTROLLER cadastrarUsuario");

  try {
    const { nome_completo, email, telefone, senha } = req.body;

    if (!nome_completo || !email || !senha) {
      return res.status(400).json({ erro: "Preencha todos os campos obrigatorios." });
    }

    const existe = await connection.query(
      "SELECT id FROM usuarios WHERE email = ?",
      [email]
    );
    if (existe.length > 0) {
      return res.status(400).json({ erro: "E-mail ja cadastrado!" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const codigo = gerarCodigo();

    console.log("🔑 CÓDIGO GERADO:", codigo);
    console.log("🔥 VAI INSERIR USUÁRIO...");

    const insert = await connection.query(
      `INSERT INTO usuarios (nome_completo, email, telefone, senha, codigo_verificacao, verificado)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [nome_completo, email, telefone || null, senhaHash, codigo]
    );

    console.log("✅ USUÁRIO INSERIDO COM SUCESSO");

    // insertId varia entre mysql2 (insert.insertId) e pg (insert[0].id)
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
      [
        nome_completo,
        sobrenome || null,
        email,
        telefone || null,
        foto_perfil || null,
        cpf || null,
        nascimento || null,
        sexo || null,
        id,
      ]
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

    // mysql2 → result.affectedRows | pg → result[0] não existe, usamos rowCount via wrapper
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
      `
      <div style="font-family: Arial; padding: 30px;">
        <h2>Recuperacao de senha</h2>
        <p>Use o codigo abaixo para redefinir sua senha:</p>
        <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px;
                    color: #6c3dff; margin: 20px 0;">
          ${codigo}
        </div>
        <p>Esse codigo expira em 10 minutos.</p>
      </div>
      `
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
      "UPDATE usuarios SET senha = ?, codigo_recuperacao = NULL, codigo_expira_em = NULL, tentativas_login = 0, bloqueado_ate = NULL WHERE email = ?",
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
      "SELECT senha FROM usuarios WHERE id = ?",
      [id]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ erro: "Usuario nao encontrado" });
    }

    const ok = await bcrypt.compare(senhaAtual, results[0].senha);
    if (!ok) return res.status(401).json({ erro: "Senha atual incorreta." });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await connection.query(
      "UPDATE usuarios SET senha = ? WHERE id = ?",
      [senhaHash, id]
    );
    res.json({ mensagem: "Senha alterada com sucesso!" });

  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar senha", detalhes: err.message });
  }
}
async function toggleAlertaDispositivo(req, res) {
  const { id, alerta } = req.body;
  if (!id) return res.status(400).json({ erro: "ID obrigatório." });
  try {
    await connection.query(
      "UPDATE usuarios SET alerta_novo_dispositivo = ? WHERE id = ?",
      [alerta, id]
    );
    res.json({ mensagem: "Preferência atualizada." });
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
  toggleAlertaDispositivo,  // ← adiciona isso
};