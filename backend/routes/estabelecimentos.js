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

// NOVA ROTA — estabelecimentos do usuário logado (pro Dashboard)
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

// ── PERFIL COMPLETO DO ORGANIZADOR (com estatísticas reais) ──
// IMPORTANTE: precisa vir ANTES de "/:id" pra não conflitar
router.get("/:id/perfil", async (req, res) => {
  try {
    const { id } = req.params;

    const estRows = await db.query("SELECT * FROM estabelecimentos WHERE id = ?", [id]);
    if (!estRows.length) {
      return res.status(404).json({ erro: "Estabelecimento não encontrado." });
    }
    const est = parseRow(estRows[0]);
    const usuarioId = est.usuario_id;

    // Total de eventos e eventos ativos (data_fim ainda não passou)
    const eventosRows = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE data_fim >= NOW()) AS ativos
      FROM eventos
      WHERE usuario_id = ?`, [usuarioId]);

    // Participantes únicos (pessoas distintas que compraram ingresso pra algum evento deste organizador)
    const participantesRows = await db.query(`
      SELECT COUNT(DISTINCT v.usuario_id) AS total
      FROM vendas v
      JOIN ingressos i ON i.id = v.ingresso_id
      JOIN eventos e ON e.id = i.evento_id
      WHERE e.usuario_id = ?`, [usuarioId]);

    // Avaliação real (média + quantidade), calculada a partir da tabela avaliacoes
    const avaliacaoRows = await db.query(`
      SELECT COALESCE(AVG(nota), 0)::numeric(3,1) AS media, COUNT(*) AS total
      FROM avaliacoes
      WHERE estabelecimento_id = ?`, [id]);

    // Distribuição de notas (quantas avaliações têm nota 1, 2, 3, 4, 5)
    const distribuicaoRows = await db.query(`
      SELECT nota, COUNT(*) AS total
      FROM avaliacoes
      WHERE estabelecimento_id = ?
      GROUP BY nota`, [id]);

    // Lista completa das avaliações, mais recentes primeiro
    const avaliacoesListaRows = await db.query(`
      SELECT * FROM avaliacoes
      WHERE estabelecimento_id = ?
      ORDER BY created_at DESC`, [id]);

    // Seguidores reais
    const seguidoresRows = await db.query(`
      SELECT COUNT(*) AS total FROM seguidores WHERE estabelecimento_id = ?`, [id]);

    // Próximos e passados eventos, pra preencher as abas
    const proximosRows = await db.query(`
      SELECT * FROM eventos
      WHERE usuario_id = ? AND data_inicio >= NOW()
      ORDER BY data_inicio ASC`, [usuarioId]);

    const passadosRows = await db.query(`
      SELECT * FROM eventos
      WHERE usuario_id = ? AND data_fim < NOW()
      ORDER BY data_fim DESC`, [usuarioId]);

    res.json({
      ...est,
      total_eventos: parseInt(eventosRows[0].total, 10),
      eventos_ativos: parseInt(eventosRows[0].ativos, 10),
      participantes_totais: parseInt(participantesRows[0].total, 10),
      avaliacao_media: parseFloat(avaliacaoRows[0].media),
      avaliacao_total: parseInt(avaliacaoRows[0].total, 10),
      avaliacoes_distribuicao: distribuicaoRows,
      avaliacoes_lista: avaliacoesListaRows,
      seguidores_totais: parseInt(seguidoresRows[0].total, 10),
      eventos_proximos: proximosRows,
      eventos_passados: passadosRows
    });
  } catch (err) {
    console.error("Erro ao buscar perfil do estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao buscar perfil." });
  }
});

// ── SEGUIR / DEIXAR DE SEGUIR (toggle) ──
router.post("/:id/seguir", verificarToken, async (req, res) => {
  try {
    const estabelecimentoId = req.params.id;
    const usuarioId = req.usuario.id;

    const jaSegue = await db.query(
      "SELECT id FROM seguidores WHERE usuario_id = ? AND estabelecimento_id = ?",
      [usuarioId, estabelecimentoId]
    );

    if (jaSegue.length) {
      await db.query(
        "DELETE FROM seguidores WHERE usuario_id = ? AND estabelecimento_id = ?",
        [usuarioId, estabelecimentoId]
      );
      return res.json({ seguindo: false });
    } else {
      await db.query(
        "INSERT INTO seguidores (usuario_id, estabelecimento_id) VALUES (?, ?)",
        [usuarioId, estabelecimentoId]
      );
      return res.json({ seguindo: true });
    }
  } catch (err) {
    console.error("Erro ao seguir/deixar de seguir:", err);
    res.status(500).json({ erro: "Erro interno ao processar." });
  }
});

// ── VERIFICA SE O USUÁRIO LOGADO JÁ SEGUE ──
router.get("/:id/seguindo", verificarToken, async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT id FROM seguidores WHERE usuario_id = ? AND estabelecimento_id = ?",
      [req.usuario.id, req.params.id]
    );
    res.json({ seguindo: rows.length > 0 });
  } catch (err) {
    console.error("Erro ao verificar se segue:", err);
    res.status(500).json({ erro: "Erro interno." });
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

// Cadastro agora exige token e salva usuario_id
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

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
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

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM estabelecimentos WHERE id = ?", [req.params.id]);
    res.json({ mensagem: "Estabelecimento removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover estabelecimento:", err);
    res.status(500).json({ erro: "Erro interno ao remover estabelecimento." });
  }
});

module.exports = router;