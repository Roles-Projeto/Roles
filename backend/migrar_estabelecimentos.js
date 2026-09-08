// Migra a tabela `estabelecimentos` do MySQL local (docker) para o Postgres (Supabase),
// linha por linha, via driver, sem gerar arquivo .sql intermediário.
// Evita problemas de aspas/quebra de linha em campos grandes (ex: imagens base64).

require("dotenv").config();
const mysql = require("mysql2/promise");
const { Pool } = require("pg");

async function main() {
  // Conexão MySQL local
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST === "mysql" ? "localhost" : process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4"
  });

  // Conexão Postgres (Supabase)
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Lendo estabelecimentos do MySQL local...");
  const [rows] = await mysqlConn.query("SELECT * FROM estabelecimentos");
  console.log(`Encontrados ${rows.length} estabelecimentos.`);

  if (rows.length === 0) {
    console.log("Nenhuma linha encontrada, nada a migrar.");
    await mysqlConn.end();
    await pgPool.end();
    return;
  }

  const columns = Object.keys(rows[0]);
  console.log("Colunas detectadas:", columns.join(", "));

  let sucesso = 0;
  let falhas = [];

  for (const row of rows) {
    const values = columns.map(col => {
      let v = row[col];
      // JSON armazenado como string precisa ser mantido como está (Postgres jsonb aceita string JSON)
      return v;
    });

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const colList = columns.map(c => `"${c}"`).join(", ");
    const sql = `INSERT INTO estabelecimentos (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

    try {
      await pgPool.query(sql, values);
      sucesso++;
      console.log(`OK: id=${row.id} - ${row.nome}`);
    } catch (err) {
      falhas.push({ id: row.id, nome: row.nome, erro: err.message });
      console.error(`FALHOU: id=${row.id} - ${row.nome} -> ${err.message}`);
    }
  }

  console.log(`\nMigração concluída: ${sucesso}/${rows.length} inseridos com sucesso.`);
  if (falhas.length > 0) {
    console.log("\nFalhas detalhadas:");
    falhas.forEach(f => console.log(`  id=${f.id} (${f.nome}): ${f.erro}`));
  }

  await mysqlConn.end();
  await pgPool.end();
}

main().catch(err => {
  console.error("Erro geral no script:", err);
  process.exit(1);
});