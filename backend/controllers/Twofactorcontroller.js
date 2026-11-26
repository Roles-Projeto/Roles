"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/db_config");
const twoFactor = require("../utils/twoFactor");

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Obtém o ID do usuário através do JWT normal.
 */
function idDoToken(req) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    return (
      payload.id ||
      payload.userId ||
      payload.user_id ||
      payload.sub ||
      null
    );
  } catch {
    return null;
  }
}


/**
 * Verifica token temporário do fluxo de 2FA.
 */
function verificarTokenTemporario(token) {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(
      token,
      twoFactor.segredoTemporario()
    );
  } catch {
    return null;
  }
}


/**
 * Busca usuário pelo ID.
 */
async function buscarUsuarioPorId(id) {
  if (!id) {
    return null;
  }

  const rows = await db.query(
    "SELECT * FROM usuarios WHERE id = ?",
    [id]
  );

  return rows.length ? rows[0] : null;
}


/**
 * Busca usuário através do JWT normal.
 */
async function buscarUsuarioLogado(req, res) {
  const id = idDoToken(req);

  if (!id) {
    res.status(401).json({
      erro: "Você precisa estar logado."
    });

    return null;
  }

  const usuario = await buscarUsuarioPorId(id);

  if (!usuario) {
    res.status(404).json({
      erro: "Usuário não encontrado."
    });

    return null;
  }

  return usuario;
}


/**
 * Cria JWT normal.
 *
 * Esse token só deve existir depois que o 2FA
 * tiver sido concluído.
 */
function gerarTokenNormal(usuario) {
  return jwt.sign(
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
}


/**
 * Monta os dados de login usados pelo frontend.
 */
function montarDadosLogin(usuario, token) {
  return {
    token,
    id: usuario.id,
    nome_completo: usuario.nome_completo,
    email: usuario.email,
    telefone: usuario.telefone || null,
    foto_perfil: usuario.foto_perfil || null,
    role: usuario.role
  };
}


/**
 * Lê os códigos de recuperação armazenados.
 *
 * Os códigos armazenados são hashes.
 */
function lerCodigosRecuperacao(usuario) {
  if (!usuario.totp_recovery_codes) {
    return [];
  }

  try {
    const codigos = JSON.parse(
      usuario.totp_recovery_codes
    );

    return Array.isArray(codigos)
      ? codigos
      : [];
  } catch {
    return [];
  }
}


/**
 * Gera e armazena os códigos de recuperação.
 *
 * Os códigos reais só são retornados uma vez para
 * o usuário. No banco ficam somente os hashes.
 */
async function gerarEArmazenarCodigosRecuperacao(usuarioId) {
  const codigos =
    twoFactor.gerarCodigosRecuperacao(8);

  const hashes = await Promise.all(
    codigos.map(
      (codigoRecuperacao) =>
        bcrypt.hash(
          twoFactor.normalizarCodigoRecuperacao(
            codigoRecuperacao
          ),
          10
        )
    )
  );

  await db.query(
    `
    UPDATE usuarios
    SET totp_recovery_codes = ?
    WHERE id = ?
    `,
    [
      JSON.stringify(hashes),
      usuarioId
    ]
  );

  return codigos;
}


/**
 * Valida o código enviado por e-mail.
 *
 * finalidade:
 * - login
 * - setup
 *
 * Os códigos ficam na tabela:
 * dois_fatores_email
 */
async function validarCodigoEmail(
  usuarioId,
  codigo,
  finalidade
) {
  const codigoNormalizado =
    String(codigo || "").trim();

  if (!/^\d{6}$/.test(codigoNormalizado)) {
    return {
      sucesso: false,
      status: 400,
      erro: "Digite o código de 6 dígitos enviado para seu e-mail."
    };
  }

  const rows = await db.query(
    `
    SELECT *
    FROM dois_fatores_email
    WHERE usuario_id = ?
      AND finalidade = ?
    ORDER BY criado_em DESC
    LIMIT 1
    `,
    [
      usuarioId,
      finalidade
    ]
  );

  if (!rows.length) {
    return {
      sucesso: false,
      status: 400,
      erro:
        "Nenhum código válido foi encontrado. Solicite um novo código."
    };
  }

  const registro = rows[0];

  /*
   * Limite de tentativas.
   */
  if (Number(registro.tentativas) >= 4) {
    return {
      sucesso: false,
      status: 429,
      erro:
        "Número máximo de tentativas atingido. Solicite um novo código."
    };
  }

  /*
   * Verifica expiração.
   */
  const expirado =
    new Date(registro.expira_em).getTime() <=
    Date.now();

  if (expirado) {
    await db.query(
      `
      DELETE FROM dois_fatores_email
      WHERE id = ?
      `,
      [registro.id]
    );

    return {
      sucesso: false,
      status: 400,
      erro:
        "O código expirou. Solicite um novo código."
    };
  }

  /*
   * Compara o código informado com o hash.
   */
  const valido = await bcrypt.compare(
    codigoNormalizado,
    registro.codigo_hash
  );

  if (!valido) {
    await db.query(
      `
      UPDATE dois_fatores_email
      SET tentativas = tentativas + 1
      WHERE id = ?
      `,
      [registro.id]
    );

    const tentativasRestantes =
      Math.max(
        0,
        3 - Number(registro.tentativas)
      );

    return {
      sucesso: false,
      status: 401,
      erro:
        tentativasRestantes > 0
          ? `Código inválido. Você ainda possui ${tentativasRestantes} tentativa(s).`
          : "Código inválido. Número máximo de tentativas atingido."
    };
  }

  /*
   * Código usado com sucesso.
   *
   * É apagado imediatamente para impedir reutilização.
   */
  await db.query(
    `
    DELETE FROM dois_fatores_email
    WHERE id = ?
    `,
    [registro.id]
  );

  return {
    sucesso: true
  };
}


/*
 * ============================================================
 * STATUS
 * ============================================================
 */

exports.status = async (req, res) => {
  try {
    const usuario =
      await buscarUsuarioLogado(req, res);

    if (!usuario) {
      return;
    }

    const codigos =
      lerCodigosRecuperacao(usuario);

    res.json({
      ativo: usuario.totp_ativo === true,
      obrigatorio: true,
      codigosRecuperacaoRestantes:
        codigos.length
    });

  } catch (err) {
    console.error(
      "❌ 2FA status:",
      err
    );

    res.status(500).json({
      erro: "Erro no servidor."
    });
  }
};


/*
 * ============================================================
 * CONFIGURAR
 * ============================================================
 *
 * O sistema agora usa e-mail.
 *
 * Não existe mais QR Code nem segredo TOTP.
 *
 * Esse endpoint é mantido para compatibilidade
 * com o frontend antigo, mas não configura nada.
 */

exports.configurar = async (req, res) => {
  return res.status(410).json({
    erro:
      "A configuração por aplicativo autenticador foi desativada. O 2FA agora é configurado por código enviado por e-mail."
  });
};


/*
 * ============================================================
 * CONFIGURAÇÃO INICIAL
 * ============================================================
 *
 * O código já é enviado pelo authController durante
 * o login.
 *
 * Portanto não existe mais etapa de QR Code.
 *
 * Esse endpoint fica apenas como compatibilidade.
 */

exports.configurarInicial = async (
  req,
  res
) => {
  return res.status(410).json({
    erro:
      "A configuração inicial por QR Code foi removida. Use o código enviado por e-mail."
  });
};


/*
 * ============================================================
 * ATIVAÇÃO NORMAL
 * ============================================================
 *
 * O 2FA é obrigatório e ativado através do fluxo
 * inicial de login.
 *
 * Não existe mais ativação por TOTP.
 */

exports.ativar = async (req, res) => {
  return res.status(410).json({
    erro:
      "A ativação por aplicativo autenticador foi removida. O 2FA é ativado por código enviado por e-mail."
  });
};


/*
 * ============================================================
 * ATIVAÇÃO INICIAL
 * ============================================================
 *
 * FLUXO:
 *
 * email + senha corretos
 *          ↓
 * token temporário 2fa_setup
 *          ↓
 * código enviado por e-mail
 *          ↓
 * validação do código
 *          ↓
 * ativa 2FA
 *          ↓
 * gera recovery codes
 *          ↓
 * gera JWT normal
 *          ↓
 * login concluído
 */

exports.ativarInicial = async (
  req,
  res
) => {
  try {
    const {
      tokenTemporario,
      codigo
    } = req.body || {};

    /*
     * ========================================================
     * 1. TOKEN TEMPORÁRIO
     * ========================================================
     */

    if (!tokenTemporario) {
      return res.status(401).json({
        erro:
          "Token temporário não informado."
      });
    }

    const payload =
      verificarTokenTemporario(
        tokenTemporario
      );

    if (!payload) {
      return res.status(401).json({
        erro:
          "A sessão de configuração expirou.",
        expirado: true
      });
    }

    /*
     * Esse endpoint aceita SOMENTE o token
     * criado para ativação inicial.
     */
    if (payload.tipo !== "2fa_setup") {
      return res.status(401).json({
        erro:
          "Token inválido para ativação inicial."
      });
    }

    /*
     * ========================================================
     * 2. BUSCAR USUÁRIO
     * ========================================================
     */

    const usuario =
      await buscarUsuarioPorId(
        payload.id
      );

    if (!usuario) {
      return res.status(404).json({
        erro:
          "Usuário não encontrado."
      });
    }

    /*
     * Impede ativação duplicada.
     */
    if (usuario.totp_ativo === true) {
      return res.status(400).json({
        erro:
          "O 2FA deste usuário já está ativo."
      });
    }

    /*
     * ========================================================
     * 3. VALIDAR CÓDIGO DE E-MAIL
     * ========================================================
     */

    const resultado =
      await validarCodigoEmail(
        usuario.id,
        codigo,
        "setup"
      );

    if (!resultado.sucesso) {
      return res.status(
        resultado.status
      ).json({
        erro: resultado.erro
      });
    }

    /*
     * ========================================================
     * 4. ATIVAR 2FA
     * ========================================================
     *
     * Não precisamos mais de:
     * - totp_secret
     * - QR Code
     * - aplicativo autenticador
     */

    await db.query(
      `
      UPDATE usuarios
      SET totp_ativo = TRUE,
          totp_secret = NULL
      WHERE id = ?
      `,
      [usuario.id]
    );

    /*
     * ========================================================
     * 5. GERAR CÓDIGOS DE RECUPERAÇÃO
     * ========================================================
     */

    const codigosRecuperacao =
      await gerarEArmazenarCodigosRecuperacao(
        usuario.id
      );

    /*
     * ========================================================
     * 6. BUSCAR USUÁRIO ATUALIZADO
     * ========================================================
     */

    const usuarioAtualizado =
      await buscarUsuarioPorId(
        usuario.id
      );

    if (!usuarioAtualizado) {
      return res.status(500).json({
        erro:
          "Não foi possível finalizar o login."
      });
    }

    /*
     * ========================================================
     * 7. GERAR JWT NORMAL
     * ========================================================
     *
     * Só acontece depois da confirmação do 2FA.
     */

    const token =
      gerarTokenNormal(
        usuarioAtualizado
      );

    /*
     * ========================================================
     * 8. RETORNO
     * ========================================================
     */

    res.json({
      sucesso: true,

      mensagem:
        "2FA configurado com sucesso!",

      ...montarDadosLogin(
        usuarioAtualizado,
        token
      ),

      /*
       * Os códigos reais são enviados somente agora.
       * O banco guarda apenas os hashes.
       */
      codigosRecuperacao
    });

  } catch (err) {
    console.error(
      "❌ 2FA ativação inicial:",
      err
    );

    res.status(500).json({
      erro:
        "Erro ao ativar o 2FA."
    });
  }
};


/*
 * ============================================================
 * DESATIVAR
 * ============================================================
 *
 * O 2FA é obrigatório.
 *
 * Portanto NÃO existe caminho para:
 *
 * totp_ativo = FALSE
 *
 * através da API.
 */

exports.desativar = async (
  req,
  res
) => {
  return res.status(403).json({
    erro:
      "O 2FA é obrigatório nesta conta e não pode ser desativado."
  });
};