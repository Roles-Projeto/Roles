const express = require("express");
const router = express.Router();
const db = require("../db/db_config");
const verificarToken = require("../middleware/auth");

// ── Upload de imagens (Supabase Storage) ──
const { usarSupabase, criarStorage, uploadParaSupabase } = require("../utils/supabaseUpload");

const BUCKET_ESTABELECIMENTOS = "imagens-estabelecimentos";
const upload = multerInstance();

function multerInstance() {
  const multer = require("multer");
  return multer({ storage: criarStorage("uploads-estabelecimentos") });
}

// Rota de upload — devolve a URL pra ser usada em img_logo, img_capa ou fotos_galeria
router.post("/upload-imagem", upload.single("imagem"), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: "Nenhuma imagem enviada" });

  // Modo local: multer já salvou o arquivo em disco, só devolve o caminho relativo.
  if (!usarSupabase) {
    return res.json({ url: `/uploads-estabelecimentos/${req.file.filename}` });
  }

  // Modo Supabase: o arquivo está em memória (req.file.buffer), sobe pro Storage.
  try {
    const url = await uploadParaSupabase(req.file, BUCKET_ESTABELECIMENTOS);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao enviar imagem para o Supabase Storage.", detalhes: err.message });
  }
});

function parseRow(row) {
  if (!row) return row;
  try { row.fotos_galeria = JSON.parse(row.fotos_galeria || "[]"); } catch { row.fotos_galeria = []; }
  try { row.pratos = JSON.parse(row.pratos || "[]"); } catch { row.pratos = []; }
  return row;
}

// Lista pública (continua igual)
router.get("/", async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT id, nome, tipo, especialidade, faixa_preco, descricao,
             endereco, cidade, estado, bairro, rua, numero,
             telefone, website, comodidades, img_logo, img_capa,
             nota, avaliacoes, categoria_card, visibilidade
      FROM estabelecimentos
      WHERE visibilidade = ?
      ORDER BY criado_em DESC`, ["publico"]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar estabelecimentos:", err);
    res.status(500).json({ erro: "Erro interno ao buscar estabelecimentos." });
  }
});

// Estabelecimentos do usuário logado (pro Dashboard)
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const rows = await db.query(
      `SELECT * FROM estabelecimentos WHERE usuario_id = ? ORDER BY criado_em DESC`,
      [usuarioId]
    );
    res.json(rows.map(parseRow));
  } catch (err) {
    console.error("Erro ao listar meus estabelecimentos:", err);
    res.status(500).json({ erro: "Erro interno ao buscar seus estabelecimentos." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM estabelecimentos WHERE id = ?", [req.params.id]);
    if (!rows || rows.length === 0)
      return res.status(404).json({ erro: "Estabelecimento não encontrado." });
    res.json(parseRow(rows[0]));
  } catch (err) {
    console.error("Erro ao buscar estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao buscar estabelecimento." });
  }
});

// Cadastro exige token e salva usuario_id
router.post("/", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id; // vem do token, não do body

    const {
      nome, tipo, especialidade, faixa_preco, capacidade, descricao,
      local_nome, cep, rua, numero, complemento, bairro, cidade, estado,
      endereco, telefone, website, responsavel, cnpj,
      visibilidade, horario, comodidades, img_logo, img_capa,
      categoria_card, fotos_galeria, pratos
    } = req.body;

    if (!nome) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });

    const result = await db.query(`
      INSERT INTO estabelecimentos
        (usuario_id, nome, tipo, especialidade, faixa_preco, capacidade, descricao,
         local_nome, cep, rua, numero, complemento, bairro, cidade, estado,
         endereco, telefone, website, responsavel, cnpj,
         visibilidade, horario, comodidades, img_logo, img_capa,
         categoria_card, fotos_galeria, pratos)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      usuarioId, nome, tipo, especialidade, faixa_preco, capacidade, descricao,
      local_nome, cep, rua, numero, complemento, bairro, cidade, estado,
      endereco, telefone, website, responsavel, cnpj,
      visibilidade || "publico", horario || "", comodidades,
      img_logo, img_capa, categoria_card,
      JSON.stringify(fotos_galeria || []), JSON.stringify(pratos || [])
    ]);

    res.status(201).json({ mensagem: "Estabelecimento cadastrado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao cadastrar estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao cadastrar estabelecimento." });
  }
});

// Edição — exige token e checa se o estabelecimento é do usuário logado
router.put("/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const existentes = await db.query("SELECT usuario_id FROM estabelecimentos WHERE id = ?", [id]);
    if (!existentes || existentes.length === 0) {
      return res.status(404).json({ erro: "Estabelecimento não encontrado." });
    }
    if (String(existentes[0].usuario_id) !== String(usuarioId)) {
      return res.status(403).json({ erro: "Você não tem permissão para editar este estabelecimento." });
    }

    const {
      nome, tipo, especialidade, faixa_preco, capacidade, descricao,
      local_nome, cep, rua, numero, complemento, bairro, cidade, estado,
      endereco, telefone, website, responsavel, cnpj,
      visibilidade, horario, comodidades, img_logo, img_capa,
      categoria_card, fotos_galeria, pratos
    } = req.body;

    await db.query(`
      UPDATE estabelecimentos SET
        nome=?, tipo=?, especialidade=?, faixa_preco=?, capacidade=?,
        descricao=?, local_nome=?, cep=?, rua=?, numero=?,
        complemento=?, bairro=?, cidade=?, estado=?, endereco=?,
        telefone=?, website=?, responsavel=?, cnpj=?,
        visibilidade=?, horario=?, comodidades=?, img_logo=?,
        img_capa=?, categoria_card=?, fotos_galeria=?, pratos=?
      WHERE id=?`, [
      nome, tipo, especialidade, faixa_preco, capacidade,
      descricao, local_nome, cep, rua, numero,
      complemento, bairro, cidade, estado, endereco,
      telefone, website, responsavel, cnpj,
      visibilidade, horario || "", comodidades, img_logo,
      img_capa, categoria_card,
      JSON.stringify(fotos_galeria || []), JSON.stringify(pratos || []), id
    ]);

    res.json({ mensagem: "Estabelecimento atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao atualizar estabelecimento." });
  }
});

// Exclusão — exige token e checa dono também (antes não tinha nenhuma proteção)
router.delete("/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.usuario.id;

    const existentes = await db.query("SELECT usuario_id FROM estabelecimentos WHERE id = ?", [id]);
    if (!existentes || existentes.length === 0) {
      return res.status(404).json({ erro: "Estabelecimento não encontrado." });
    }
    if (String(existentes[0].usuario_id) !== String(usuarioId)) {
      return res.status(403).json({ erro: "Você não tem permissão para remover este estabelecimento." });
    }

    await db.query("DELETE FROM estabelecimentos WHERE id = ?", [id]);
    res.json({ mensagem: "Estabelecimento removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao remover estabelecimento." });
  }
});

module.exports = router;