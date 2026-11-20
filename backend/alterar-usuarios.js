try { require("dotenv").config(); } catch (e) {}
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000
});

const comandos = [
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT",
    "ALTER TABLE usuarios ALTER COLUMN senha DROP NOT NULL",
    "ALTER TABLE usuarios ALTER COLUMN cpf DROP NOT NULL",
    "ALTER TABLE usuarios ALTER COLUMN telefone DROP NOT NULL"
];

(async () => {
    try {
        for (const sql of comandos) {
            await pool.query(sql);
            console.log("OK:", sql);
        }

        const r = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'usuarios'
            ORDER BY ordinal_position
        `);
        console.table(r.rows);
        process.exit(0);
    } catch (e) {
        console.error("Erro:", e.message);
        process.exit(1);
    }
})();
