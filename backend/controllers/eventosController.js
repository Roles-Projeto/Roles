// backend/controllers/eventosController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

exports.upload = multer({ storage });

const connection = require("../db/db_config");

// =====================================================
// CRIAR EVENTO
// =====================================================
exports.criarEvento = (req, res) => {
  const {
    nome, assunto, categoria, imagem, data_inicio, data_fim,
    descricao, local_nome, cep, rua, cidade, estado, nome_produtor, ingressos,
  } = req.body;

  if (!nome || !data_inicio || !data_fim)
    return res.status(400).json({ erro: "Nome, data de início e data de término são obrigatórios." });

  const sql = `INSERT INTO eventos (nome, assunto, categoria, imagem, data_inicio, data_fim,
       descricao, local_nome, cep, rua, cidade, estado, nome_produtor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const valores = [nome, assunto||null, categoria||null, imagem||null, data_inicio, data_fim,
    descricao||null, local_nome||null, cep||null, rua||null, cidade||null, estado||null, nome_produtor||null];

  connection.query(sql, valores, (err, result) => {
    if (err) return res.status(500).json({ erro: "Erro ao salvar evento.", detalhes: err.message });

    const eventoId = result.insertId;

    if (!ingressos || ingressos.length === 0)
      return res.status(201).json({ mensagem: "Evento criado com sucesso!", eventoId });

    // ── Monta INSERT multi-linha compatível com Postgres ──
    // Em vez de "VALUES ?" (sintaxe exclusiva do mysql2), geramos
    // "(?, ?, ?, ?, ?), (?, ?, ?, ?, ?), ..." e um array de valores
    // já achatado (flatMap), na mesma ordem. O db_config.js converte
    // cada "?" pra $1, $2... na ordem em que aparecem, então isso
    // funciona igual pro Postgres.
    const placeholders = ingressos.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const sqlIng = `INSERT INTO ingressos (evento_id, titulo, tipo, valor, quantidade_total) VALUES ${placeholders}`;
    const vals = ingressos.flatMap(i => [
      eventoId,
      i.titulo,
      i.tipo,
      i.tipo === "pago" ? (parseFloat(i.valor) || 0) : 0,
      parseInt(i.quantidade_total) || 1,
    ]);

    connection.query(sqlIng, vals, (errIng) => {
      if (errIng) return res.status(500).json({ erro: "Evento salvo, mas erro ao salvar ingressos.", detalhes: errIng.message });
      res.status(201).json({ mensagem: "Evento e ingressos criados com sucesso!", eventoId });
    });
  });
};

// =====================================================
// LISTAR EVENTOS
// =====================================================
exports.listarEventos = (req, res) => {
  const sql = `
    SELECT e.*, MIN(i.valor) AS preco_minimo,
      GROUP_CONCAT(i.titulo SEPARATOR ', ') AS tipos_ingresso
    FROM eventos e
    LEFT JOIN ingressos i ON i.evento_id = e.id
    WHERE e.data_inicio >= NOW()
    GROUP BY e.id
    ORDER BY e.data_inicio ASC
  `;
  connection.query(sql, [], (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro ao buscar eventos.", detalhes: err.message });
    res.json(results);
  });
};

// =====================================================
// BUSCAR EVENTO POR ID
// =====================================================
exports.buscarEvento = (req, res) => {
  const { id } = req.params;

  connection.query("SELECT * FROM eventos WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro ao buscar evento." });
    if (results.length === 0) return res.status(404).json({ erro: "Evento não encontrado." });

    const evento = results[0];

    // Busca os ingressos desse evento
    connection.query("SELECT * FROM ingressos WHERE evento_id = ?", [id], (errIng, ingressos) => {
      if (errIng) return res.status(500).json({ erro: "Erro ao buscar ingressos." });

      res.json({ ...evento, ingressos });
    });
  });
};

// =====================================================
// EDITAR EVENTO
// =====================================================
exports.editarEvento = (req, res) => {
  const { id } = req.params;
  const {
    nome, assunto, categoria, imagem, data_inicio, data_fim,
    descricao, local_nome, cep, rua, cidade, estado, nome_produtor,
  } = req.body;

  if (!nome || !data_inicio || !data_fim)
    return res.status(400).json({ erro: "Nome, data de início e data de término são obrigatórios." });

  const sql = `UPDATE eventos SET nome=?, assunto=?, categoria=?, imagem=?, data_inicio=?, data_fim=?,
    descricao=?, local_nome=?, cep=?, rua=?, cidade=?, estado=?, nome_produtor=? WHERE id=?`;

  const valores = [nome, assunto||null, categoria||null, imagem||null, data_inicio, data_fim,
    descricao||null, local_nome||null, cep||null, rua||null, cidade||null, estado||null, nome_produtor||null, id];

  connection.query(sql, valores, (err, result) => {
    if (err) return res.status(500).json({ erro: "Erro ao editar evento.", detalhes: err.message });
    res.json({ mensagem: "Evento atualizado com sucesso!" });
  });
};

// =====================================================
// EXCLUIR EVENTO
// =====================================================
exports.excluirEvento = (req, res) => {
  const { id } = req.params;
  connection.query("DELETE FROM eventos WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ erro: "Erro ao excluir evento.", detalhes: err.message });
    res.json({ mensagem: "Evento excluído com sucesso!" });
  });
};