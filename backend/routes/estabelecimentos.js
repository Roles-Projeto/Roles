const express = require("express");
const router = express.Router();
const db = require("../db/db_config");
const { verificarToken } = require("../middleware/auth");

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

// Monta o endereço da rota que serve a imagem. O parametro v (tamanho da
// imagem) muda quando a imagem muda, entao o navegador nao fica com cache velho.
function urlImagem(req, id, tipo, versao) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${proto}://${req.get("host")}${req.baseUrl}/${id}/imagem/${tipo}?v=${versao || 0}`;
}

// Lista pública — as imagens guardadas dentro do banco (data:...base64) NAO vão
// mais no JSON da lista (pesavam MB por chamada). No lugar vai uma URL curta.
// Imagens que já são URL ou caminho continuam iguais.
router.get("/", async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT id, nome, tipo, especialidade, faixa_preco, descricao,
             endereco, cidade, estado, bairro, rua, numero,
             telefone, website, comodidades,
             CASE WHEN img_logo LIKE 'data:%' THEN NULL ELSE img_logo END AS img_logo,
             CASE WHEN img_capa LIKE 'data:%' THEN NULL ELSE img_capa END AS img_capa,
             (img_logo LIKE 'data:%') AS logo_inline,
             (img_capa LIKE 'data:%') AS capa_inline,
             LENGTH(img_logo) AS logo_tam,
             LENGTH(img_capa) AS capa_tam,
             nota, avaliacoes, categoria_card, visibilidade
      FROM estabelecimentos
      WHERE visibilidade = ?
      ORDER BY criado_em DESC`, ["publico"]);

    for (const r of rows) {
      if (r.logo_inline) r.img_logo = urlImagem(req, r.id, "logo", r.logo_tam);
      if (r.capa_inline) r.img_capa = urlImagem(req, r.id, "capa", r.capa_tam);
      delete r.logo_inline;
      delete r.capa_inline;
      delete r.logo_tam;
      delete r.capa_tam;
    }

    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar estabelecimentos:", err);
    res.status(500).json({ erro: "Erro interno ao buscar estabelecimentos." });
  }
});

// Serve o logo ou a capa de um estabelecimento público como imagem de verdade,
// com cache no navegador. Só busca no banco a coluna da imagem pedida.
router.get("/:id/imagem/:tipo", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).end();

    let rows;
    if (req.params.tipo === "logo") {
      rows = await db.query("SELECT img_logo AS imagem FROM estabelecimentos WHERE id = ? AND visibilidade = ?", [id, "publico"]);
    } else if (req.params.tipo === "capa") {
      rows = await db.query("SELECT img_capa AS imagem FROM estabelecimentos WHERE id = ? AND visibilidade = ?", [id, "publico"]);
    } else {
      return res.status(404).end();
    }

    const valor = rows && rows[0] && rows[0].imagem;
    if (!valor) return res.status(404).end();

    // Imagem que já é URL ou caminho: só redireciona.
    if (!valor.startsWith("data:")) return res.redirect(valor);

    // Imagem guardada como data URI: decodifica e devolve os bytes.
    const virgula = valor.indexOf(",");
    if (virgula === -1) return res.status(404).end();
    const meta = valor.slice(5, virgula);
    const ehBase64 = /;base64$/i.test(meta);
    const mime = meta.replace(/;base64$/i, "").toLowerCase();

    // Só imagens comuns, pra essa rota nunca servir HTML ou script.
    if (!/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(mime)) return res.status(415).end();

    const dados = valor.slice(virgula + 1);
    const buffer = ehBase64 ? Buffer.from(dados, "base64") : Buffer.from(decodeURIComponent(dados));

    res.set({
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    res.send(buffer);
  } catch (err) {
    console.error("Erro ao servir imagem do estabelecimento:", err);
    res.status(500).end();
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
            usuarioId, nome, tipo ?? null, especialidade ?? null, faixa_preco ?? null,
      capacidade !== undefined && capacidade !== null && capacidade !== "" ? Number(capacidade) : null,
      descricao ?? null, local_nome ?? null, cep ?? null, rua ?? null, numero ?? null,
      complemento ?? null, bairro ?? null, cidade ?? null, estado ?? null,
      endereco ?? null, telefone ?? null, website ?? null, responsavel ?? null, cnpj ?? null,
      visibilidade || "publico", horario || "", comodidades ?? null,
      img_logo ?? null, img_capa ?? null, categoria_card ?? null,
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
            nome ?? null, tipo ?? null, especialidade ?? null, faixa_preco ?? null,
      capacidade !== undefined && capacidade !== null && capacidade !== "" ? Number(capacidade) : null,
      descricao ?? null, local_nome ?? null, cep ?? null, rua ?? null, numero ?? null,
      complemento ?? null, bairro ?? null, cidade ?? null, estado ?? null, endereco ?? null,
      telefone ?? null, website ?? null, responsavel ?? null, cnpj ?? null,
      visibilidade ?? "publico", horario ?? "", comodidades ?? null, img_logo ?? null,
      img_capa ?? null, categoria_card ?? null,
      JSON.stringify(fotos_galeria ?? []), JSON.stringify(pratos ?? []), id
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