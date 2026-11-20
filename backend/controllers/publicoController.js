// backend/controllers/publicoController.js
// Endpoints PÚBLICOS (sem login) usados pela landing page do empresário.
const db = require("../db/db_config");

// ---------------------------------------------------------------
// ⚠️ CONFIRA os nomes de tabelas/colunas abaixo com o seu banco:
//   usuarios, estabelecimentos          -> COUNT(*)
//   eventos.data_inicio                 -> já usada na busca do header
//   avaliacoes.nota                     -> NOME ASSUMIDO (ajuste se for outro)
//   depoimentos_parceiros               -> tabela nova (ver backend/sql/)
// Cada métrica roda isolada: se uma query falhar (ex.: tabela com outro
// nome), as outras continuam funcionando e a falha vira "null".
// ---------------------------------------------------------------

const TTL_MS = 5 * 60 * 1000; // cache em memória: 5 min (rota pública, não precisa bater no banco toda vez)
let cacheStats = { dados: null, ate: 0 };

async function seguro(nome, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[publico] métrica "${nome}" falhou:`, err.message);
    return null;
  }
}

async function contar(sql) {
  const linhas = await db.query(sql);
  return Number(linhas[0]?.total) || 0;
}

// GET /publico/estatisticas
exports.estatisticas = async (req, res) => {
  try {
    if (cacheStats.dados && cacheStats.ate > Date.now()) {
      res.set("Cache-Control", "public, max-age=300");
      return res.json(cacheStats.dados);
    }

    const [usuarios, estabelecimentos, eventosMes, avaliacao] = await Promise.all([
      // Se existir coluna de status (ex.: ativo = TRUE), acrescente o WHERE aqui.
      seguro("usuarios", () => contar("SELECT COUNT(*) AS total FROM usuarios")),
      seguro("estabelecimentos", () => contar("SELECT COUNT(*) AS total FROM estabelecimentos")),
      seguro("eventos_mes", () =>
        contar(`SELECT COUNT(*) AS total FROM eventos
                WHERE data_inicio >= date_trunc('month', NOW())
                  AND data_inicio <  date_trunc('month', NOW()) + INTERVAL '1 month'`)
      ),
      seguro("avaliacao_media", async () => {
        const linhas = await db.query("SELECT AVG(nota) AS media, COUNT(*) AS total FROM avaliacoes");
        const total = Number(linhas[0]?.total) || 0;
        const media = Number(linhas[0]?.media);
        return total > 0 && Number.isFinite(media) ? Math.round(media * 10) / 10 : null;
      }),
    ]);

    const dados = { usuarios, estabelecimentos, eventosMes, avaliacaoMedia: avaliacao };

    // Se TUDO falhou, não cacheia e avisa o front com 503
    if (Object.values(dados).every((v) => v === null)) {
      return res.status(503).json({ erro: "Estatísticas indisponíveis no momento." });
    }

    cacheStats = { dados, ate: Date.now() + TTL_MS };
    res.set("Cache-Control", "public, max-age=300");
    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar estatísticas públicas:", err);
    res.status(500).json({ erro: "Erro ao buscar estatísticas." });
  }
};

// GET /publico/depoimentos
// Comentários REAIS da tabela "avaliacoes" (feitos por usuários).
const NOTA_MINIMA = 4;   // só mostra avaliações com nota >= 4 (use 1 para mostrar todas)
const MIN_CHARS = 5;     // ignora comentários muito curtos ("legal", "ok")
const MAX_CHARS = 280;   // comentários longos são resumidos com "…"

// "Maria da Silva Souza" -> "Maria S." (privacidade: nunca expõe o nome completo)
function nomeCurto(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "Usuário do Rolês";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

function resumir(texto) {
  const t = String(texto).replace(/\s+/g, " ").trim();
  if (t.length <= MAX_CHARS) return t;
  return t.slice(0, MAX_CHARS).replace(/\s+\S*$/, "") + "…";
}

exports.depoimentos = async (req, res) => {
  try {
    const linhas = await db.query(
      `SELECT a.id, a.nome_autor, a.nota, a.comentario,
              est.nome AS estabelecimento_nome,
              ev.nome  AS evento_nome
       FROM avaliacoes a
       LEFT JOIN estabelecimentos est ON est.id = a.estabelecimento_id
       LEFT JOIN eventos ev           ON ev.id  = a.evento_id
       WHERE a.comentario IS NOT NULL
         AND char_length(btrim(a.comentario)) >= ?
         AND a.nota >= ?
       ORDER BY a.nota DESC, a.id DESC
       LIMIT 6`,
      [MIN_CHARS, NOTA_MINIMA]
    );

    res.set("Cache-Control", "public, max-age=300");
    res.json(
      linhas.map((d) => {
        const alvo = d.estabelecimento_nome || d.evento_nome;
        return {
          id: d.id,
          autor: nomeCurto(d.nome_autor),
          estabelecimento: alvo ? `sobre ${alvo}` : "",
          texto: resumir(d.comentario),
          nota: Number(d.nota) || 0,
        };
      })
    );
  } catch (err) {
    console.error("Erro ao buscar depoimentos:", err);
    res.status(500).json({ erro: "Erro ao buscar depoimentos." });
  }
};