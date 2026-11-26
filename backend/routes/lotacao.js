/**
 * routes/lotacao.js — Lotação de eventos e de locais (tarefa 183)
 *
 * EVENTOS (público)
 *   GET /lotacao/:eventoId
 *     Devolve só a porcentagem e o nível (sem expor o número de ingressos).
 *
 * LOCAIS (bares, restaurantes, baladas)
 *   GET /lotacao/local/:id            Público. Porcentagem e nível atuais.
 *   GET /lotacao/local/:id/gestao     Só o dono. Números completos.
 *   PUT /lotacao/local/:id            Só o dono. Informa quantas pessoas há agora.
 *
 * Regra de contagem dos EVENTOS (por tipo de ingresso):
 *   - "livre":    vendidos = soma de vendas.quantidade com status 'aprovado'
 *                 total    = ingressos.quantidade_total
 *   - "numerado": vendidos = assentos com status diferente de 'disponivel'
 *                 total    = quantidade de assentos do ingresso
 *   - Ingressos arquivados não entram. Vendas reembolsadas não ocupam vaga.
 *
 * Regra dos LOCAIS:
 *   - total  = estabelecimentos.capacidade (em pessoas)
 *   - agora  = lotacao_locais.ocupacao_atual, informada pelo dono
 *   - Se o dono não atualiza há mais de VALIDADE_HORAS, a lotação deixa de
 *     aparecer para o público (um dado velho seria pior que nenhum dado).
 *
 * Antes de usar a parte de locais, rode o arquivo lotacao_locais.sql no Neon.
 */

const express = require("express");
const router = express.Router();
const db = require("../db/db_config");
const { verificarToken } = require("../middleware/auth");

const VALIDADE_HORAS = 3;

/* ============================================================
   FUNÇÕES COMUNS
============================================================ */

/** Converte a porcentagem em um nível simples que o frontend traduz em texto/cor. */
function nivelDaLotacao(percentual) {
  if (percentual >= 100) return "esgotado";
  if (percentual >= 80) return "ultimas";
  if (percentual >= 50) return "alta";
  return "baixa";
}

/** Porcentagem inteira de 0 a 100, ou null quando não há capacidade cadastrada. */
function calcularPercentual(ocupados, capacidade) {
  const total = Number(capacidade);
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((Number(ocupados || 0) / total) * 100));
}

/* ============================================================
   LOCAIS
============================================================ */

/** Local + lotação atual (se houver) + minutos desde a última atualização. */
async function buscarLocal(id) {
  const rows = await db.query(
    `SELECT e.id, e.usuario_id, e.visibilidade, e.capacidade,
            l.ocupacao_atual,
            CAST(EXTRACT(EPOCH FROM (NOW() - l.atualizado_em)) / 60 AS INTEGER) AS minutos
       FROM estabelecimentos e
       LEFT JOIN lotacao_locais l ON l.estabelecimento_id = e.id
      WHERE e.id = ?`,
    [id]
  );
  return rows && rows[0] ? rows[0] : null;
}

/** A lotação do local ainda vale (foi atualizada dentro da janela de validade)? */
function estaAtual(local) {
  return (
    local.minutos !== null &&
    local.minutos !== undefined &&
    Number(local.minutos) <= VALIDADE_HORAS * 60
  );
}

/** Resposta completa para o dono do local. */
function respostaGestao(local) {
  const ocupacao = local.ocupacao_atual ?? 0;
  return {
    capacidade: local.capacidade ?? null,
    ocupacao_atual: ocupacao,
    percentual: calcularPercentual(ocupacao, local.capacidade),
    atual: estaAtual(local),
    minutos: local.minutos ?? null,
    validade_horas: VALIDADE_HORAS,
  };
}

function lerIdLocal(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ erro: "ID de local inválido." });
    return null;
  }
  return id;
}

/** Carrega o local e confirma que quem pediu é o dono. Responde o erro e devolve null se não for. */
async function carregarLocalDoDono(req, res) {
  const id = lerIdLocal(req, res);
  if (id === null) return null;

  const local = await buscarLocal(id);
  if (!local) {
    res.status(404).json({ erro: "Estabelecimento não encontrado." });
    return null;
  }
  if (String(local.usuario_id) !== String(req.usuario.id)) {
    res.status(403).json({ erro: "Você não tem permissão para gerenciar a lotação deste local." });
    return null;
  }
  return local;
}

// Público: lotação atual do local
router.get("/local/:id", async (req, res) => {
  const id = lerIdLocal(req, res);
  if (id === null) return;

  try {
    const local = await buscarLocal(id);

    // Local inexistente ou privado: nem confirma que existe.
    if (!local || local.visibilidade !== "publico") {
      return res.status(404).json({ erro: "Estabelecimento não encontrado." });
    }

    res.set("Cache-Control", "no-store");

    const percentual = calcularPercentual(local.ocupacao_atual, local.capacidade);
    if (percentual === null || !estaAtual(local)) {
      return res.json({ percentual: null, nivel: null, esgotado: false });
    }

    res.json({
      percentual,
      nivel: nivelDaLotacao(percentual),
      esgotado: percentual >= 100,
      minutos: local.minutos,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar lotação do local:", err.message);
    res.status(500).json({ erro: "Não foi possível buscar a lotação do local." });
  }
});

// Dono: números completos (também serve para o frontend descobrir se quem está logado é o dono)
router.get("/local/:id/gestao", verificarToken, async (req, res) => {
  try {
    const local = await carregarLocalDoDono(req, res);
    if (!local) return;

    res.set("Cache-Control", "no-store");
    res.json(respostaGestao(local));
  } catch (err) {
    console.error("❌ Erro ao buscar gestão da lotação:", err.message);
    res.status(500).json({ erro: "Não foi possível buscar a lotação do local." });
  }
});

// Dono: informa quantas pessoas há no local agora
router.put("/local/:id", verificarToken, async (req, res) => {
  try {
    const local = await carregarLocalDoDono(req, res);
    if (!local) return;

    if (!local.capacidade || Number(local.capacidade) <= 0) {
      return res.status(400).json({
        erro: "Cadastre a capacidade do local antes de informar a lotação.",
      });
    }

    const bruto = req.body ? req.body.ocupacao_atual : undefined;
    const vazio =
      bruto === undefined ||
      bruto === null ||
      (typeof bruto === "string" && bruto.trim() === "");
    const valor = vazio ? NaN : Number(bruto);

    if (!Number.isInteger(valor) || valor < 0) {
      return res.status(400).json({ erro: "Informe um número de pessoas (0 ou mais)." });
    }
    if (valor > Number(local.capacidade)) {
      return res.status(400).json({
        erro: `A lotação não pode passar da capacidade do local (${local.capacidade}).`,
      });
    }

    await db.query(
      `INSERT INTO lotacao_locais (estabelecimento_id, ocupacao_atual, atualizado_por, atualizado_em)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (estabelecimento_id)
       DO UPDATE SET ocupacao_atual = EXCLUDED.ocupacao_atual,
                     atualizado_por = EXCLUDED.atualizado_por,
                     atualizado_em  = NOW()`,
      [local.id, valor, req.usuario.id]
    );

    const atualizado = await buscarLocal(local.id);
    res.set("Cache-Control", "no-store");
    res.json(respostaGestao(atualizado));
  } catch (err) {
    console.error("❌ Erro ao salvar lotação do local:", err.message);
    res.status(500).json({ erro: "Não foi possível salvar a lotação do local." });
  }
});

/* ============================================================
   EVENTOS
============================================================ */

const SQL_LOTACAO_EVENTO = `
  WITH por_ingresso AS (
    SELECT
      CASE WHEN i.tipo_selecao = 'numerado'
           THEN (SELECT count(*) FROM assentos a WHERE a.ingresso_id = i.id)
           ELSE i.quantidade_total END AS total,
      CASE WHEN i.tipo_selecao = 'numerado'
           THEN (SELECT count(*) FROM assentos a
                  WHERE a.ingresso_id = i.id AND a.status <> 'disponivel')
           ELSE COALESCE((SELECT SUM(v.quantidade) FROM vendas v
                           WHERE v.ingresso_id = i.id AND v.status = 'aprovado'), 0)
      END AS vendidos
    FROM ingressos i
    WHERE i.evento_id = ?
      AND i.arquivado_em IS NULL
  )
  SELECT CAST(COALESCE(SUM(total), 0) AS INTEGER)    AS total,
         CAST(COALESCE(SUM(vendidos), 0) AS INTEGER) AS vendidos
  FROM por_ingresso
`;

// Público: lotação do evento (fica depois das rotas /local para nunca conflitar)
router.get("/:eventoId", async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  if (!Number.isInteger(eventoId) || eventoId <= 0) {
    return res.status(400).json({ erro: "ID de evento inválido." });
  }

  try {
    const rows = await db.query(SQL_LOTACAO_EVENTO, [eventoId]);
    const { total, vendidos } = rows[0];

    res.set("Cache-Control", "no-store");

    // Evento sem ingressos cadastrados: não há o que mostrar.
    if (!total) {
      return res.json({ percentual: null, nivel: null, esgotado: false });
    }

    const percentual = Math.min(100, Math.round((vendidos / total) * 100));

    res.json({
      percentual,
      nivel: nivelDaLotacao(percentual),
      esgotado: percentual >= 100,
      atualizado_em: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Erro ao calcular lotação do evento:", err.message);
    res.status(500).json({ erro: "Não foi possível calcular a lotação." });
  }
});

module.exports = router;