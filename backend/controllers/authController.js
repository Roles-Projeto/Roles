"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/db_config");
const nodemailer = require("nodemailer");
const twoFactor = require("../utils/twoFactor");

/* ════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════ */

const MAX_TENTATIVAS = 4;
const BLOQUEIO_MINUTOS = 15;
const CODIGO_2FA_EXPIRA_MINUTOS = 5;

/* ════════════════════════════════════════
   EMAIL
════════════════════════════════════════ */

const {
  wrapEmail,
  logoAttachment
} = require("../services/emailTemplate");

async function enviarEmail(para, assunto, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "EMAIL_USER ou EMAIL_PASS não configurados."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Rolês" <${process.env.EMAIL_USER}>`,
    to: para,
    subject: assunto,
    html,
    attachments: [logoAttachment]
  });
}

/* ════════════════════════════════════════
   2FA POR EMAIL
════════════════════════════════════════ */

function gerarCodigoEmail() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

async function enviarCodigo2FAEmail(
  usuario,
  finalidade
) {
  const codigo = gerarCodigoEmail();

  /*
   * Guarda somente o hash do código.
   * O código original nunca é salvo no banco.
   */
  const codigoHash = await bcrypt.hash(
    codigo,
    10
  );

  /*
   * Remove códigos anteriores desse usuário.
   */
  await db.query(
    `DELETE FROM dois_fatores_email
     WHERE usuario_id = ?`,
    [usuario.id]
  );

  /*
   * Cria novo código com validade de 5 minutos.
   */
  await db.query(
    `INSERT INTO dois_fatores_email
     (
       usuario_id,
       codigo_hash,
       finalidade,
       expira_em
     )
     VALUES (
       ?,
       ?,
       ?,
       CURRENT_TIMESTAMP + INTERVAL '5 minutes'
     )`,
    [
      usuario.id,
      codigoHash,
      finalidade
    ]
  );

  const isSetup =
    finalidade === "setup";

  const assunto = isSetup
    ? "Ative a verificação em duas etapas — Rolês"
    : "Seu código de verificação — Rolês";

  const titulo = isSetup
    ? "Ative a verificação em duas etapas"
    : "Seu código de verificação";

  const mensagem = isSetup
    ? "Use este código para ativar a verificação em duas etapas da sua conta."
    : "Use este código para concluir o login na sua conta.";

  await enviarEmail(
    usuario.email,
    assunto,
    wrapEmail(`
      <tr>
        <td style="padding:40px;text-align:center;">

          <h2 style="
            color:#1a1a2e;
            margin:0 0 12px;
            font-size:22px;
          ">
            ${titulo}
          </h2>

          <p style="
            color:#333;
            font-size:15px;
            margin:0 0 20px;
          ">
            Olá, <strong>${usuario.nome_completo}</strong>!
          </p>

          <p style="
            color:#555;
            font-size:14px;
            margin:0 0 25px;
            line-height:1.6;
          ">
            ${mensagem}
          </p>

          <div style="
            background:#f5f0ff;
            border:2px solid #6c2bd9;
            border-radius:12px;
            padding:22px;
            margin:0 auto 25px;
            max-width:280px;
          ">

            <div style="
              font-size:32px;
              font-weight:700;
              letter-spacing:8px;
              color:#6c2bd9;
            ">
              ${codigo}
            </div>

          </div>

          <p style="
            color:#777;
            font-size:13px;
            margin:0 0 10px;
          ">
            Este código expira em
            <strong>${CODIGO_2FA_EXPIRA_MINUTOS} minutos</strong>.
          </p>

          <p style="
            color:#999;
            font-size:12px;
            margin:0;
          ">
            Se você não solicitou este código,
            ignore este e-mail.
          </p>

        </td>
      </tr>
    `)
  );
}

/* ════════════════════════════════════════
   GARANTE TABELA login_historico
════════════════════════════════════════ */

async function ensureHistoricoTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS login_historico (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      ip VARCHAR(64),
      dispositivo VARCHAR(255),
      navegador VARCHAR(100),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch((err) => {
    console.error(
      "⚠️ Não foi possível verificar login_historico:",
      err.message
    );
  });
}

ensureHistoricoTable();

/* ════════════════════════════════════════
   DETECTAR NAVEGADOR / DISPOSITIVO
════════════════════════════════════════ */

function detectarNavegador(ua) {
  if (!ua) return "Desconhecido";

  if (ua.includes("Firefox")) {
    return "Firefox";
  }

  if (ua.includes("Edg")) {
    return "Edge";
  }

  if (ua.includes("Chrome")) {
    return "Chrome";
  }

  if (ua.includes("Safari")) {
    return "Safari";
  }

  return "Navegador";
}

function detectarDispositivo(ua) {
  if (!ua) return "Desktop";

  return /Mobi|Android/i.test(ua)
    ? "Mobile"
    : "Desktop";
}

/* ════════════════════════════════════════
   FINALIZAR LOGIN
════════════════════════════════════════ */

async function finalizarLogin(
  req,
  res,
  usuario
) {
  try {

    /*
     * Login realmente concluído.
     * Reseta tentativas de login.
     */
    await db.query(
      `UPDATE usuarios
       SET tentativas_login = 0,
           bloqueado_ate = NULL,
           ultima_tentativa = NULL
       WHERE id = ?`,
      [usuario.id]
    ).catch(() => { });

    /*
     * JWT normal.
     *
     * Esse token só é criado depois que
     * senha + 2FA foram validados.
     */
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h"
      }
    );

    const ua =
      req.headers["user-agent"] || "";

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "—";

    const navegador =
      detectarNavegador(ua);

    const dispositivo =
      detectarDispositivo(ua);

    const dispositivoStr =
      `${navegador} — ${dispositivo}`;

    /*
     * Registra acesso.
     */
    await db.query(
      `INSERT INTO login_historico
       (
         usuario_id,
         ip,
         dispositivo,
         navegador
       )
       VALUES (?, ?, ?, ?)`,
      [
        usuario.id,
        ip,
        dispositivoStr,
        navegador
      ]
    ).catch(() => { });

    /*
     * Verifica se é um novo dispositivo.
     */
    const historicoAnterior =
      await db.query(
        `SELECT id
         FROM login_historico
         WHERE usuario_id = ?
           AND dispositivo = ?
         ORDER BY criado_em DESC
         LIMIT 10`,
        [
          usuario.id,
          dispositivoStr
        ]
      ).catch(() => []);

    const isNovoDispositivo =
      Array.isArray(historicoAnterior) &&
      historicoAnterior.length === 1;

    const alertaAtivo =
      usuario.alerta_novo_dispositivo !== 0;

    /*
     * Envia alerta de novo dispositivo.
     */
    if (
      isNovoDispositivo &&
      usuario.email &&
      alertaAtivo
    ) {

      const agora =
        new Date().toLocaleString(
          "pt-BR",
          {
            timeZone:
              "America/Sao_Paulo"
          }
        );

      enviarEmail(
        usuario.email,
        "Novo acesso à sua conta Rolês",
        wrapEmail(`
          <tr>
            <td style="padding:40px;text-align:center;">

              <h2 style="
                color:#1a1a2e;
                margin:0 0 12px;
                font-size:22px;
              ">
                Novo dispositivo detectado
              </h2>

              <p style="
                color:#333;
                font-size:15px;
                margin:0 0 12px;
              ">
                Olá,
                <strong>
                  ${usuario.nome_completo}
                </strong>!
              </p>

              <p style="
                color:#555;
                font-size:14px;
                margin:0 0 20px;
                line-height:1.6;
              ">
                Detectamos um acesso à sua conta
                a partir de um novo dispositivo.
              </p>

              <div style="
                background:#f5f0ff;
                border-left:4px solid #6c2bd9;
                border-radius:8px;
                padding:20px;
                margin-bottom:24px;
                text-align:left;
              ">

                <p style="
                  margin:0 0 8px;
                  font-size:14px;
                  color:#555;
                ">
                  <strong>Dispositivo:</strong>
                  ${dispositivoStr}
                </p>

                <p style="
                  margin:0 0 8px;
                  font-size:14px;
                  color:#555;
                ">
                  <strong>IP:</strong>
                  ${ip}
                </p>

                <p style="
                  margin:0;
                  font-size:14px;
                  color:#555;
                ">
                  <strong>Data/Hora:</strong>
                  ${agora}
                </p>

              </div>

              <p style="
                color:#555;
                font-size:14px;
                margin:0 0 20px;
              ">
                Se foi você, pode ignorar este e-mail.
              </p>

              <p style="
                color:#e53e3e;
                font-size:14px;
                font-weight:600;
                margin:0 0 20px;
              ">
                Se não foi você, altere sua senha imediatamente!
              </p>

              <a
                href="${
                  process.env.FRONTEND_URL ||
                  "http://localhost:5502/frontend"
                }/recuperar-senha/recuperar-senha.html"
                style="
                  display:inline-block;
                  background:#6c2bd9;
                  color:#fff;
                  padding:12px 28px;
                  border-radius:8px;
                  text-decoration:none;
                  font-weight:600;
                "
              >
                Alterar minha senha
              </a>

            </td>
          </tr>
        `)
      ).catch(() => { });
    }

    /*
     * Só aqui o login é considerado concluído.
     */
    return res.json({
      mensagem:
        "Login realizado com sucesso!",
      token,
      id: usuario.id,
      nome_completo:
        usuario.nome_completo,
      email: usuario.email,
      telefone:
        usuario.telefone,
      foto_perfil:
        usuario.foto_perfil,
      role:
        usuario.role
    });

  } catch (err) {

    console.error(
      "❌ finalizarLogin:",
      err
    );

    return res.status(500).json({
      erro: "Erro no servidor.",
      detalhes: err.message
    });
  }
}

/* ════════════════════════════════════════
   LOGIN
════════════════════════════════════════ */

exports.loginUsuario = async (
  req,
  res
) => {

  const {
    email,
    senha
  } = req.body;

  if (!email || !senha) {
    return res.status(400).json({
      erro:
        "Preencha email e senha."
    });
  }

  try {

    const results =
      await db.query(
        "SELECT * FROM usuarios WHERE email = ?",
        [email]
      );

    if (!results.length) {
      return res.status(400).json({
        erro:
          "Email não cadastrado."
      });
    }

    const usuario = results[0];

    /* ─────────────────────────────────────
       BLOQUEIO TEMPORÁRIO
    ───────────────────────────────────── */

    if (usuario.bloqueado_ate) {

      const bloqueadoAte =
        new Date(
          usuario.bloqueado_ate
        );

      if (
        bloqueadoAte > new Date()
      ) {

        const minutosRestantes =
          Math.max(
            1,
            Math.ceil(
              (
                bloqueadoAte -
                new Date()
              ) / 60000
            )
          );

        return res.status(429).json({
          erro:
            "Conta bloqueada temporariamente.",
          bloqueado: true,
          minutosRestantes,
          mensagem:
            `Muitas tentativas incorretas. Tente novamente em ${minutosRestantes} minuto(s) ou entre em contato com o suporte para reaver seu acesso.`,
          suporte: true
        });
      }
    }

    /* ─────────────────────────────────────
       CONTA NÃO VERIFICADA
    ───────────────────────────────────── */

    if (!usuario.verificado) {
      return res.status(403).json({
        erro:
          "Conta não verificada. Verifique o código enviado por email."
      });
    }

    /* ─────────────────────────────────────
       VERIFICA SENHA
    ───────────────────────────────────── */

    const senhaValida =
      await bcrypt.compare(
        senha,
        usuario.senha
      );

    if (!senhaValida) {

      const novasTentativas =
        (usuario.tentativas_login || 0) + 1;

      const restantes =
        MAX_TENTATIVAS -
        novasTentativas;

      /* ───────────────────────────────
         BLOQUEIA CONTA
      ─────────────────────────────── */

      if (
        novasTentativas >=
        MAX_TENTATIVAS
      ) {

        await db.query(
          `UPDATE usuarios
           SET tentativas_login = ?,
               bloqueado_ate =
                 CURRENT_TIMESTAMP
                 + (? * INTERVAL '1 minute'),
               ultima_tentativa =
                 CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            novasTentativas,
            BLOQUEIO_MINUTOS,
            usuario.id
          ]
        );

        enviarEmail(
          usuario.email,
          "⚠️ Conta bloqueada temporariamente — Rolês",
          wrapEmail(`
            <tr>
              <td style="padding:40px;text-align:center;">

                <h2 style="
                  color:#e53e3e;
                  margin:0 0 12px;
                  font-size:22px;
                ">
                  ⚠️ Conta bloqueada temporariamente
                </h2>

                <p style="
                  color:#333;
                  font-size:15px;
                  margin:0 0 12px;
                ">
                  Olá,
                  <strong>
                    ${usuario.nome_completo}
                  </strong>!
                </p>

                <p style="
                  color:#555;
                  font-size:14px;
                  margin:0 0 20px;
                  line-height:1.6;
                ">
                  Detectamos
                  <strong>
                    ${MAX_TENTATIVAS}
                    tentativas incorretas
                  </strong>
                  de acesso à sua conta.
                </p>

                <div style="
                  background:#fff5f5;
                  border:2px solid #e53e3e;
                  border-radius:12px;
                  padding:20px;
                  margin-bottom:24px;
                ">

                  <p style="
                    margin:0 0 8px;
                    font-size:14px;
                    color:#555;
                  ">
                    <strong>
                      Bloqueada por:
                    </strong>
                    ${BLOQUEIO_MINUTOS}
                    minutos
                  </p>

                  <p style="
                    margin:0;
                    font-size:14px;
                    color:#555;
                  ">
                    <strong>
                      Data/Hora:
                    </strong>
                    ${new Date().toLocaleString(
                      "pt-BR",
                      {
                        timeZone:
                          "America/Sao_Paulo"
                      }
                    )}
                  </p>

                </div>

                <p style="
                  color:#555;
                  font-size:14px;
                  margin:0 0 20px;
                ">
                  Se foi você, aguarde
                  ${BLOQUEIO_MINUTOS}
                  minutos e tente novamente.
                </p>

                <a
                  href="${
                    process.env.FRONTEND_URL ||
                    "http://localhost:5502/frontend"
                  }/recuperar-senha/recuperar-senha.html"
                  style="
                    display:inline-block;
                    background:#6c2bd9;
                    color:#fff;
                    padding:12px 28px;
                    border-radius:8px;
                    text-decoration:none;
                    font-weight:600;
                  "
                >
                  Redefinir senha
                </a>

              </td>
            </tr>
          `)
        ).catch(() => { });

        return res.status(429).json({
          erro:
            "Conta bloqueada temporariamente.",
          bloqueado: true,
          minutosRestantes:
            BLOQUEIO_MINUTOS,
          mensagem:
            `Você atingiu o limite de ${MAX_TENTATIVAS} tentativas. Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos. Você pode redefinir sua senha ou contatar o suporte.`,
          suporte: true
        });
      }

      /* ───────────────────────────────
         REGISTRA TENTATIVA
      ─────────────────────────────── */

      await db.query(
        `UPDATE usuarios
         SET tentativas_login = ?,
             ultima_tentativa =
               CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          novasTentativas,
          usuario.id
        ]
      );

      return res.status(400).json({
        erro:
          "Senha incorreta.",
        tentativasRestantes:
          Math.max(0, restantes),
        mensagem:
          `Senha incorreta. Você ainda tem ${Math.max(
            0,
            restantes
          )} tentativa(s) antes do bloqueio.`
      });
    }

    /* ════════════════════════════════════════
       SENHA CORRETA
       2FA OBRIGATÓRIO POR EMAIL
    ════════════════════════════════════════ */

    /*
     * CASO 1:
     * Usuário já possui 2FA ativo.
     *
     * Envia código para o e-mail.
     * NÃO entrega JWT ainda.
     */

    if (usuario.totp_ativo === true) {

      try {

        await enviarCodigo2FAEmail(
          usuario,
          "login"
        );

      } catch (emailErr) {

        console.error(
          "❌ Erro ao enviar código 2FA:",
          emailErr
        );

        return res.status(500).json({
          erro:
            "Não foi possível enviar o código de verificação para seu e-mail."
        });
      }

      const tokenTemporario =
        jwt.sign(
          {
            id: usuario.id,
            tipo: "2fa"
          },
          twoFactor.segredoTemporario(),
          {
            expiresIn: "5m"
          }
        );

      return res.json({
        requer2fa: true,
        tokenTemporario,
        mensagem:
          "Um código de verificação foi enviado para seu e-mail."
      });
    }

    /*
     * CASO 2:
     * Usuário ainda não possui 2FA.
     *
     * Primeiro login:
     * envia código para ativar 2FA.
     */

    try {

      await enviarCodigo2FAEmail(
        usuario,
        "setup"
      );

    } catch (emailErr) {

      console.error(
        "❌ Erro ao enviar código de ativação 2FA:",
        emailErr
      );

      return res.status(500).json({
        erro:
          "Não foi possível enviar o código de ativação para seu e-mail."
      });
    }

    const tokenTemporario =
      jwt.sign(
        {
          id: usuario.id,
          tipo: "2fa_setup"
        },
        twoFactor.segredoTemporario(),
        {
          expiresIn: "10m"
        }
      );

    return res.json({
      requer2faSetup: true,
      tokenTemporario,
      mensagem:
        "Um código de ativação foi enviado para seu e-mail."
    });

  } catch (err) {

    console.error(
      "❌ loginUsuario:",
      err
    );

    return res.status(500).json({
      erro: "Erro no servidor.",
      detalhes: err.message
    });
  }
};

/* ════════════════════════════════════════
   CÓDIGOS DE RECUPERAÇÃO
════════════════════════════════════════ */

async function consumirCodigoRecuperacao(
  usuario,
  codigoInformado
) {

  let hashes;

  try {

    hashes = JSON.parse(
      usuario.totp_recovery_codes ||
      "[]"
    );

  } catch {

    hashes = [];
  }

  const normalizado =
    twoFactor.normalizarCodigoRecuperacao(
      codigoInformado
    );

  if (!normalizado) {
    return false;
  }

  for (
    let i = 0;
    i < hashes.length;
    i++
  ) {

    if (
      await bcrypt.compare(
        normalizado,
        hashes[i]
      )
    ) {

      /*
       * Código de recuperação
       * é de uso único.
       */

      hashes.splice(i, 1);

      await db.query(
        `UPDATE usuarios
         SET totp_recovery_codes = ?
         WHERE id = ?`,
        [
          JSON.stringify(hashes),
          usuario.id
        ]
      );

      return true;
    }
  }

  return false;
}

/* ════════════════════════════════════════
   LOGIN — SEGUNDA ETAPA
   2FA POR EMAIL
════════════════════════════════════════ */

exports.verificarLogin2fa =
  async (req, res) => {

    const {
      tokenTemporario,
      codigo,
      recuperacao
    } = req.body;

    if (
      !tokenTemporario ||
      !codigo
    ) {
      return res.status(400).json({
        erro:
          "Informe o código de verificação."
      });
    }

    const expirado = () =>
      res.status(401).json({
        erro:
          "Verificação expirada. Entre novamente.",
        expirado: true
      });

    let payload;

    try {

      payload = jwt.verify(
        tokenTemporario,
        twoFactor.segredoTemporario()
      );

    } catch {

      return expirado();
    }

    /*
     * Este endpoint aceita SOMENTE
     * token de login 2FA.
     *
     * 2FA_SETUP é tratado pelo
     * ativarInicial no controller
     * de 2FA.
     */

    if (
      payload.tipo !== "2fa"
    ) {
      return expirado();
    }

    try {

      const rows =
        await db.query(
          `SELECT *
           FROM usuarios
           WHERE id = ?`,
          [payload.id]
        );

      const usuario =
        rows[0];

      if (
        !usuario ||
        usuario.totp_ativo !== true
      ) {
        return expirado();
      }

      /* ─────────────────────────────
         BLOQUEIO
      ───────────────────────────── */

      if (
        usuario.bloqueado_ate &&
        new Date(
          usuario.bloqueado_ate
        ) > new Date()
      ) {

        const minutosRestantes =
          Math.max(
            1,
            Math.ceil(
              (
                new Date(
                  usuario.bloqueado_ate
                ) -
                new Date()
              ) / 60000
            )
          );

        return res.status(429).json({
          erro:
            `Conta bloqueada temporariamente. Tente novamente em ${minutosRestantes} minuto(s).`,
          bloqueado: true,
          minutosRestantes,
          suporte: true
        });
      }

      /* ─────────────────────────────
         VERIFICA CÓDIGO
      ───────────────────────────── */

      let valido = false;

      /*
       * RECUPERAÇÃO
       */
      if (recuperacao) {

        valido =
          await consumirCodigoRecuperacao(
            usuario,
            codigo
          );

      }

      /*
       * CÓDIGO ENVIADO POR EMAIL
       */
      else {

        const rowsCodigo =
          await db.query(
            `SELECT *
             FROM dois_fatores_email
             WHERE usuario_id = ?
               AND finalidade = 'login'
             ORDER BY criado_em DESC
             LIMIT 1`,
            [usuario.id]
          );

        const registroCodigo =
          rowsCodigo[0];

        if (!registroCodigo) {

          valido = false;

        } else {

          const expirouCodigo =
            new Date(
              registroCodigo.expira_em
            ) <= new Date();

          if (expirouCodigo) {

            await db.query(
              `DELETE FROM dois_fatores_email
               WHERE id = ?`,
              [registroCodigo.id]
            );

            valido = false;

          } else if (
            registroCodigo.tentativas >=
            MAX_TENTATIVAS
          ) {

            valido = false;

          } else {

            valido =
              await bcrypt.compare(
                codigo,
                registroCodigo.codigo_hash
              );

            if (valido) {

              /*
               * Código é de uso único.
               */

              await db.query(
                `DELETE FROM dois_fatores_email
                 WHERE id = ?`,
                [registroCodigo.id]
              );

            } else {

              /*
               * Conta tentativa errada
               * do código 2FA.
               */

              await db.query(
                `UPDATE dois_fatores_email
                 SET tentativas =
                   tentativas + 1
                 WHERE id = ?`,
                [registroCodigo.id]
              );
            }
          }
        }
      }

      /* ─────────────────────────────
         CÓDIGO INVÁLIDO
      ───────────────────────────── */

      if (!valido) {

        const novasTentativas =
          (usuario.tentativas_login || 0) + 1;

        const restantes =
          MAX_TENTATIVAS -
          novasTentativas;

        /*
         * Bloqueia conta.
         */

        if (
          novasTentativas >=
          MAX_TENTATIVAS
        ) {

          await db.query(
            `UPDATE usuarios
             SET tentativas_login = ?,
                 bloqueado_ate =
                   CURRENT_TIMESTAMP
                   + (? * INTERVAL '1 minute'),
                 ultima_tentativa =
                   CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              novasTentativas,
              BLOQUEIO_MINUTOS,
              usuario.id
            ]
          );

          return res.status(429).json({
            erro:
              `Muitas tentativas incorretas. Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos.`,
            bloqueado: true,
            minutosRestantes:
              BLOQUEIO_MINUTOS,
            suporte: true
          });
        }

        await db.query(
          `UPDATE usuarios
           SET tentativas_login = ?,
               ultima_tentativa =
                 CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            novasTentativas,
            usuario.id
          ]
        );

        return res.status(401).json({
          erro:
            `Código inválido. Você ainda tem ${Math.max(
              0,
              restantes
            )} tentativa(s) antes do bloqueio.`,
          tentativasRestantes:
            Math.max(0, restantes)
        });
      }

      /*
       * Código válido.
       *
       * AGORA SIM o JWT normal
       * pode ser entregue.
       */

      return finalizarLogin(
        req,
        res,
        usuario
      );

    } catch (err) {

      console.error(
        "❌ verificarLogin2fa:",
        err
      );

      return res.status(500).json({
        erro:
          "Erro no servidor.",
        detalhes:
          err.message
      });
    }
  };

/* ════════════════════════════════════════
   DESBLOQUEAR CONTA
   POST /auth/desbloquear
════════════════════════════════════════ */

exports.desbloquearConta =
  async (req, res) => {

    const { email } =
      req.body;

    if (!email) {
      return res.status(400).json({
        erro:
          "Email é obrigatório."
      });
    }

    try {

      await db.query(
        `UPDATE usuarios
         SET tentativas_login = 0,
             bloqueado_ate = NULL,
             ultima_tentativa = NULL
         WHERE email = ?`,
        [email]
      );

      return res.json({
        mensagem:
          `Conta ${email} desbloqueada com sucesso.`
      });

    } catch (err) {

      return res.status(500).json({
        erro:
          "Erro ao desbloquear conta.",
        detalhes:
          err.message
      });
    }
  };

/* ════════════════════════════════════════
   HISTÓRICO DE ACESSOS
   GET /usuarios/historico-acessos/:id
════════════════════════════════════════ */

exports.historicoAcessos =
  async (req, res) => {

    const { id } =
      req.params;

    try {

      const rows =
        await db.query(
          `SELECT
             id,
             ip,
             dispositivo,
             navegador,
             criado_em
           FROM login_historico
           WHERE usuario_id = ?
           ORDER BY criado_em DESC
           LIMIT 20`,
          [id]
        );

      return res.json(rows);

    } catch (err) {

      return res.status(500).json({
        erro:
          "Erro ao buscar histórico.",
        detalhes:
          err.message
      });
    }
  };