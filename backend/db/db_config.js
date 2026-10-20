require("dotenv").config();

const { Pool, types } = require("pg");

// Faz o driver devolver timestamp/date/timestamptz como texto puro,
// em vez de converter automaticamente pra objeto Date do JS.
// Isso evita bugs de fuso horário e "Invalid Date" no frontend,
// preservando o mesmo comportamento que o mysql2 tinha antes.
types.setTypeParser(1114, (val) => val); // timestamp without time zone
types.setTypeParser(1082, (val) => val); // date
types.setTypeParser(1184, (val) => val); // timestamptz

/* ── BANCOS ──────────────────────────────────────────────
   DATABASE_URL          -> banco principal (Neon)
   DATABASE_URL_RESERVA  -> banco reserva (Aiven). Opcional: se não existir
                            no .env, o sistema roda só com o principal.      */

// Remove da URL os parâmetros sslmode e channel_binding. O driver 'pg' deixa
// a URL sobrescrever a configuração de SSL abaixo, e isso quebra a conexão
// com certificados como o do Aiven. O SSL continua ativo pela opção 'ssl'.
function limparUrl(url) {
  if (!url) return url;
  const pos = url.indexOf("?");
  if (pos === -1) return url;
  const base = url.slice(0, pos);
  const resto = url
    .slice(pos + 1)
    .split("&")
    .filter((p) => !/^(sslmode|channel_binding)=/i.test(p))
    .join("&");
  return resto ? `${base}?${resto}` : base;
}

function criarPool(url, max) {
  const p = new Pool({
    connectionString: limparUrl(url),
    ssl: { rejectUnauthorized: false },
    max,
    connectionTimeoutMillis: 8000, // falha rápido se o banco não responder
    idleTimeoutMillis: 30000
  });
  // Sem este handler, uma conexão ociosa derrubada pelo servidor
  // (comum em banco gratuito) derruba o Node inteiro.
  p.on("error", (err) => console.error("[db] Erro em conexao ociosa:", err.message));
  return p;
}

const poolPrincipal = criarPool(process.env.DATABASE_URL, 10);
const poolReserva = process.env.DATABASE_URL_RESERVA
  ? criarPool(process.env.DATABASE_URL_RESERVA, 5) // Aiven gratuito aceita no máximo 20 conexões
  : null;

console.log(
  "Usando PostgreSQL (Neon)" + (poolReserva ? " com banco reserva (Aiven)" : " sem banco reserva")
);

/* ── FALLBACK PARA O BANCO RESERVA ───────────────────────
   Só troca de banco quando o problema é de CONEXÃO (banco fora do ar,
   timeout, cota estourada). Erros de SQL normais continuam sendo
   lançados pro controller, como antes.
   Depois de trocar, usa o reserva por 60 segundos e então tenta o
   principal de novo.                                                     */
const TEMPO_RESERVA_MS = 60000;
let reservaAte = 0;

function erroDeConexao(err) {
  const codigosRede = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "EAI_AGAIN", "EPIPE"];
  if (codigosRede.includes(err.code)) return true;
  if (
    typeof err.code === "string" &&
    (err.code.startsWith("08") || // falhas de conexão
      err.code.startsWith("57P") || // banco desligando/reiniciando
      err.code === "53300" || // conexões demais
      err.code === "53100") // disco/cota cheia
  ) {
    return true;
  }
  return /timeout exceeded when trying to connect|Connection terminated|connection.*(closed|ended)|the database system is (starting up|shutting down)/i.test(
    String(err.message || "")
  );
}

function ativarReserva(err) {
  reservaAte = Date.now() + TEMPO_RESERVA_MS;
  console.warn(
    "[db] Banco principal indisponivel (" + (err.code || err.message) + "). Usando banco reserva por 60s."
  );
}

// Executa uma query: tenta o principal (com uma nova tentativa) e, se a
// conexão falhar de novo e houver reserva, usa o reserva.
async function executar(pgSql, params) {
  if (poolReserva && Date.now() < reservaAte) {
    return poolReserva.query(pgSql, params);
  }
  try {
    return await poolPrincipal.query(pgSql, params);
  } catch (err) {
    if (!erroDeConexao(err)) throw err;
    try {
      return await poolPrincipal.query(pgSql, params); // segunda tentativa
    } catch (err2) {
      if (!poolReserva || !erroDeConexao(err2)) throw err2;
      ativarReserva(err2);
      return poolReserva.query(pgSql, params);
    }
  }
}

// Pega uma conexão dedicada (usada nas transações).
async function conectar() {
  if (poolReserva && Date.now() < reservaAte) {
    return poolReserva.connect();
  }
  try {
    return await poolPrincipal.connect();
  } catch (err) {
    if (!poolReserva || !erroDeConexao(err)) throw err;
    ativarReserva(err);
    return poolReserva.connect();
  }
}

/* Converte ? → $1, $2... (suas queries foram escritas nesse estilo) */
function converterParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/* Converte funções e sintaxe MySQL usadas no código para o equivalente em Postgres.
   Adicione novas conversões aqui conforme forem aparecendo erros — não precisa
   editar os controllers individualmente. */
function converterSQL(sql) {
  let result = sql
    // DATE_ADD(base, INTERVAL ? UNIDADE) -> (base) + (? * INTERVAL '1 unidade')
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+\?\s+(\w+)\)/gi,
      (_, base, unidade) => `(${base.trim()}) + (? * INTERVAL '1 ${unidade.toLowerCase()}')`)
    // DATE_SUB(base, INTERVAL ? UNIDADE) -> (base) - (? * INTERVAL '1 unidade')
    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+\?\s+(\w+)\)/gi,
      (_, base, unidade) => `(${base.trim()}) - (? * INTERVAL '1 ${unidade.toLowerCase()}')`)
    // UTC_TIMESTAMP() -> hora atual em UTC
    .replace(/UTC_TIMESTAMP\(\)/gi, "(NOW() AT TIME ZONE 'UTC')")
    // GROUP_CONCAT(campo SEPARATOR 'x') -> STRING_AGG(campo, 'x')
    .replace(/GROUP_CONCAT\((.+?)\s+SEPARATOR\s+'(.+?)'\)/gi, "STRING_AGG($1, '$2')")
    .replace(/GROUP_CONCAT\((.+?)\)/gi, "STRING_AGG($1, ',')")
    // IFNULL(a, b) -> COALESCE(a, b)
    .replace(/IFNULL\(/gi, "COALESCE(")
    // INT AUTO_INCREMENT (em CREATE TABLE) -> SERIAL
    .replace(/INT\s+AUTO_INCREMENT/gi, "SERIAL")
    // CURDATE() -> data atual
    .replace(/CURDATE\(\)/gi, "CURRENT_DATE")
    // CURTIME() -> hora atual
    .replace(/CURTIME\(\)/gi, "CURRENT_TIME");

  // Adiciona RETURNING id em INSERTs automaticamente, se ainda não tiver
  if (/^\s*INSERT\s+/i.test(result) && !/RETURNING/i.test(result)) {
    result = result.trimEnd().replace(/;?\s*$/, '') + ' RETURNING id';
  }

  return result;
}

// Roda uma série de queries dentro de uma transação real do Postgres.
// Uso: await db.transacao(async (tx) => { await tx.query(...); await tx.query(...); });
// Se qualquer query dentro do callback lançar erro, TUDO é revertido (ROLLBACK)
// e nada fica salvo pela metade. Se tudo der certo, comita (COMMIT) no final.
async function transacao(callback) {
  const client = await conectar();
  try {
    await client.query('BEGIN');

    const tx = {
      query: (sql, params = []) => {
        const pgSql = converterParams(converterSQL(sql));
        return client.query(pgSql, params).then(r => {
          const rows = r.rows;
          if (r.command === 'INSERT' && rows.length > 0 && rows[0].id) {
            rows.insertId = rows[0].id;
          }
          return rows;
        });
      }
    };

    const resultado = await callback(tx);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const db = {
  query: (sql, params = [], callback) => {
    const pgSql = converterParams(converterSQL(sql));

    // ── MODO CALLBACK ──────────────────────────────────
    if (typeof callback === 'function') {
      executar(pgSql, params)
        .then(r => {
          const rows = r.rows;
          if (r.command === 'INSERT' && rows.length > 0 && rows[0].id) {
            rows.insertId = rows[0].id;
          }
          callback(null, rows);
        })
        .catch(err => callback(err));
      return;
    }

    // ── MODO PROMISE / ASYNC-AWAIT ─────────────────────
    return executar(pgSql, params).then(r => {
      const rows = r.rows;
      if (r.command === 'INSERT' && rows.length > 0 && rows[0].id) {
        rows.insertId = rows[0].id;
      }
      return rows;
    });
  }
};

db.transacao = transacao;

module.exports = db;
