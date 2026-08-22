require("dotenv").config();

const { Pool, types } = require("pg");

// Faz o driver devolver timestamp/date/timestamptz como texto puro,
// em vez de converter automaticamente pra objeto Date do JS.
// Isso evita bugs de fuso horário e "Invalid Date" no frontend,
// preservando o mesmo comportamento que o mysql2 tinha antes.
types.setTypeParser(1114, (val) => val); // timestamp without time zone
types.setTypeParser(1082, (val) => val); // date
types.setTypeParser(1184, (val) => val); // timestamptz

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log("🟢 Usando PostgreSQL (Supabase)");

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

const db = {
  query: (sql, params = [], callback) => {
    const pgSql = converterParams(converterSQL(sql));

    // ── MODO CALLBACK ──────────────────────────────────
    if (typeof callback === 'function') {
      pool.query(pgSql, params)
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
    return pool.query(pgSql, params).then(r => {
      const rows = r.rows;
      if (r.command === 'INSERT' && rows.length > 0 && rows[0].id) {
        rows.insertId = rows[0].id;
      }
      return rows;
    });
  }
};

module.exports = db;