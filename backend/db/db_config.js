require("dotenv").config();

const { Pool } = require("pg");

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

/* Converte funções de sintaxe MySQL usadas no código para o equivalente em Postgres */
function converterSQL(sql) {
  let result = sql
    .replace(/GROUP_CONCAT\((.+?)\s+SEPARATOR\s+'(.+?)'\)/gi, "STRING_AGG($1, '$2')")
    .replace(/GROUP_CONCAT\((.+?)\)/gi, "STRING_AGG($1, ',')")
    .replace(/IFNULL\(/gi, "COALESCE(");

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