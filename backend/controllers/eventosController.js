// backend/controllers/eventosController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../db/supabaseClient');
const { analisarImagemPorUrl, analisarTexto } = require('../services/sightengineService');
const { classificarImagem, classificarTexto } = require('../services/moderacaoService');

// ── Alternância de armazenamento de imagem ──
// USE_SUPABASE_STORAGE=true  -> memoryStorage + Supabase Storage (usar em produção)
// USE_SUPABASE_STORAGE=false -> diskStorage local em /uploads (só serve pra dev local,
//                                 some a cada deploy no Render)
const USAR_SUPABASE = process.env.USE_SUPABASE_STORAGE === 'true';

const storage = USAR_SUPABASE
    ? multer.memoryStorage()
    : multer.diskStorage({
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

// Nome do bucket no Supabase Storage. Precisa existir e estar público.
const BUCKET_NAME = 'imagens-eventos';

// Faz upload do buffer recebido do multer pro Supabase Storage
// e devolve a URL pública do arquivo. Só é chamada quando USAR_SUPABASE = true.
exports.uploadParaSupabase = async (file) => {
    if (!supabase) throw new Error("Client do Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env).");

    const nomeArquivo = `${Date.now()}${path.extname(file.originalname)}`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(nomeArquivo, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(nomeArquivo);

    return data.publicUrl;
};

// Indica ao route handler qual modo está ativo, sem precisar reler o env var lá.
exports.usarSupabase = USAR_SUPABASE;

const connection = require("../db/db_config");

// =====================================================
// MODERAÇÃO (Sightengine) — roda antes de salvar o evento
// =====================================================
// Analisa a imagem (por URL, já que ela já foi upada pro Supabase antes
// desse ponto) e o texto (nome + descrição). Se a Sightengine falhar por
// erro de rede/instabilidade, deixamos o evento passar (fail-open) — só
// registramos no console. Pra travar a criação nesse caso em vez de deixar
// passar, é só trocar os ".catch(...)" abaixo por não capturar o erro.
async function moderarEvento(imagemUrl, nome, descricao) {
  const textoParaAnalise = [nome, descricao].filter(Boolean).join(' ');

  const [resultadoImagem, resultadoTexto] = await Promise.all([
    imagemUrl
      ? analisarImagemPorUrl(imagemUrl).catch((e) => {
          console.error('⚠️  Falha ao moderar imagem do evento:', e.message);
          return null;
        })
      : Promise.resolve(null),
    textoParaAnalise
      ? analisarTexto(textoParaAnalise).catch((e) => {
          console.error('⚠️  Falha ao moderar texto do evento:', e.message);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const decisaoImagem = resultadoImagem ? classificarImagem(resultadoImagem) : 'APROVADA';
  const decisaoTexto = resultadoTexto ? classificarTexto(resultadoTexto) : 'APROVADA';

  const decisoes = [decisaoImagem, decisaoTexto];
  const decisaoFinal = decisoes.includes('BLOQUEADA')
    ? 'BLOQUEADA'
    : decisoes.includes('REVISAO')
      ? 'REVISAO'
      : 'APROVADA';

  console.log(`🛡️  [MODERAÇÃO] imagem=${decisaoImagem} texto=${decisaoTexto} final=${decisaoFinal}`);

  return { decisaoFinal, decisaoImagem, decisaoTexto };
}

// =====================================================
// CRIAR EVENTO
// =====================================================
exports.criarEvento = async (req, res) => {
  const {
    nome, assunto, categoria, imagem, data_inicio, data_fim,
    descricao, local_nome, cep, rua, cidade, estado, nome_produtor, ingressos,
  } = req.body;

  if (!nome || !data_inicio || !data_fim)
    return res.status(400).json({ erro: "Nome, data de início e data de término são obrigatórios." });

  try {
    const { decisaoFinal, decisaoImagem, decisaoTexto } = await moderarEvento(imagem, nome, descricao);

    if (decisaoFinal !== 'APROVADA') {
      return res.status(422).json({
        erro: "Seu evento não pôde ser publicado porque a imagem ou a descrição foram identificadas como inadequadas pelas nossas regras de conteúdo. Revise o material e tente novamente.",
        decisao: decisaoFinal,
        detalhes: { imagem: decisaoImagem, texto: decisaoTexto },
      });
    }
  } catch (erroModeracao) {
    console.error('⚠️  Erro inesperado na moderação do evento:', erroModeracao.message);
    // segue o fluxo normal (fail-open) em caso de erro inesperado
  }

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