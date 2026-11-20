try { require("dotenv").config(); } catch (e) {}
const { Pool } = require("pg");

const url =
    process.env.DATABASE_URL ||
    process.env.DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;

if (!url) {
    console.log("Nenhuma variável de conexão conhecida. Variáveis parecidas no .env:");
    console.log(Object.keys(process.env).filter(k => /DB|DATA|PG|POSTGRES|NEON|URL/i.test(k)));
    process.exit(1);
}

console.log("Host:", new URL(url).host);

const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});

pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
`)
.then(r => { console.table(r.rows); process.exit(0); })
.catch(e => { console.error("Erro:", e.message); process.exit(1); });
