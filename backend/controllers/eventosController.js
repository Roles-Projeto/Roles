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

const db = require("../db/db_config");

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
// Exige login (req.usuario vem do middleware verificarToken,
// que precisa estar na rota — ver routes/eventos.js) e salva
// o usuario_id de quem criou. Roda a moderação (Sightengine) na
// imagem e no texto antes de gravar; se for reprovado, não salva.
// =====================================================
exports.criarEvento = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const {
      nome, assunto, categoria, imagem, data_inicio, data_fim,
      descricao, local_nome, cep, rua, cidade, estado, nome_produtor, ingressos,
    } = req.body;

    if (!nome || !data_inicio || !data_fim)
      return res.status(400).json({ erro: "Nome, data de início e data de término são obrigatórios." });

    // ── MODERAÇÃO (Sightengine) — roda antes de salvar o evento ──
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
      // segue o fluxo normal (fail-open) em caso de erro inesperado na moderação
    }

    const sql = `INSERT INTO eventos
        (usuario_id, nome, assunto, categoria, imagem, data_inicio, data_fim,
         descricao, local_nome, cep, rua, cidade, estado, nome_produtor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const valores = [
      usuarioId, nome, assunto || null, categoria || null, imagem || null, data_inicio, data_fim,
      descricao || null, local_nome || null, cep || null, rua || null, cidade || null, estado || null, nome_produtor || null
    ];

    const result = await db.query(sql, valores);
    const eventoId = result.insertId;

    if (!ingressos || ingressos.length === 0) {
      return res.status(201).json({ mensagem: "Evento criado com sucesso!", eventoId });
    }

    const placeholders = ingressos.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const sqlIng = `INSERT INTO ingressos (evento_id, titulo, tipo, valor, quantidade_total) VALUES ${placeholders}`;
    const vals = ingressos.flatMap(i => [
      eventoId,
      i.titulo,
      i.tipo,
      i.tipo === "pago" ? (parseFloat(i.valor) || 0) : 0,
      parseInt(i.quantidade_total) || 1,
    ]);

    try {
      await db.query(sqlIng, vals);
      res.status(201).json({ mensagem: "Evento e ingressos criados com sucesso!", eventoId });
    } catch (errIng) {
      res.status(500).json({ erro: "Evento salvo, mas erro ao salvar ingressos.", detalhes: errIng.message });
    }
  } catch (err) {
    console.error("Erro ao salvar evento:", err);
    res.status(500).json({ erro: "Erro ao salvar evento.", detalhes: err.message });
  }
};

// =====================================================
// LISTAR EVENTOS
//
// Dois modos, dependendo se vem ?criador_id= na URL:
//
// - SEM criador_id (listagem pública, ex: página de eventos do site):
//   só eventos futuros, de todo mundo.
//
// - COM criador_id (usado pelo Dashboard):
//   traz TODOS os eventos daquele usuário (passados e futuros),
//   já que o dono precisa ver o histórico completo.
// =====================================================
exports.listarEventos = async (req, res) => {
  try {
    const { criador_id } = req.query;

    const filtroWhere = criador_id
      ? "WHERE e.usuario_id = ?"
      : "WHERE e.data_inicio >= NOW()";

    const sql = `
      SELECT e.*, MIN(i.valor) AS preco_minimo,
        STRING_AGG(i.titulo, ', ') AS tipos_ingresso
      FROM eventos e
      LEFT JOIN ingressos i ON i.evento_id = e.id
      ${filtroWhere}
      GROUP BY e.id
      ORDER BY e.data_inicio ${criador_id ? "DESC" : "ASC"}
    `;

    const params = criador_id ? [criador_id] : [];
    const results = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error("Erro ao buscar eventos:", err);
    res.status(500).json({ erro: "Erro ao buscar eventos.", detalhes: err.message });
  }
};

// =====================================================
// STATUS DE VENDA DE UM TIPO DE INGRESSO
// Mesma regra usada na compra (ingressosController):
// pausado > em_breve > encerrado > esgotado > disponivel
// =====================================================
function getStatusVenda(tipo, disponiveis, agora = new Date()) {
  if (tipo.ativo === false || tipo.ativo === 0) return "pausado";
  if (tipo.data_inicio_venda && agora < new Date(tipo.data_inicio_venda)) return "em_breve";
  if (tipo.data_fim_venda && agora > new Date(tipo.data_fim_venda)) return "encerrado";
  if (disponiveis <= 0) return "esgotado";
  return "disponivel";
}

// =====================================================
// BUSCAR EVENTO POR ID
// Cada ingresso volta com:
//   disponivel   = quantidade_total - vendidos/cortesias aprovados
//   status_venda = disponivel | pausado | em_breve | encerrado | esgotado
// =====================================================
exports.buscarEvento = async (req, res) => {
  try {
    const { id } = req.params;

    const eventos = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);
    if (!eventos || eventos.length === 0) {
      return res.status(404).json({ erro: "Evento não encontrado." });
    }
    const evento = eventos[0];

    const ingressosDb = await db.query(`
      SELECT i.*,
        COALESCE((
          SELECT SUM(v.quantidade) FROM vendas v
          WHERE v.ingresso_id = i.id AND v.status IN ('aprovado', 'cortesia')
        ), 0) AS ocupados
      FROM ingressos i
      WHERE i.evento_id = ?
      ORDER BY i.id ASC
    `, [id]);

    const agora = new Date();
    const ingressos = ingressosDb.map((t) => {
      const disponivel = Math.max(0, Number(t.quantidade_total) - (Number(t.ocupados) || 0));
      return {
        ...t,
        disponivel,
        status_venda: getStatusVenda(t, disponivel, agora),
      };
    });

    res.json({ ...evento, ingressos });
  } catch (err) {
    console.error("Erro ao buscar evento:", err);
    res.status(500).json({ erro: "Erro ao buscar evento.", detalhes: err.message });
  }
};

// =====================================================
// EDITAR EVENTO
// Exige login e checa se o evento pertence ao usuário logado.
// =====================================================
exports.editarEvento = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { id } = req.params;

    const existentes = await db.query("SELECT usuario_id FROM eventos WHERE id = ?", [id]);
    if (!existentes || existentes.length === 0) {
      return res.status(404).json({ erro: "Evento não encontrado." });
    }
    if (String(existentes[0].usuario_id) !== String(usuarioId)) {
      return res.status(403).json({ erro: "Você não tem permissão para editar este evento." });
    }

    const {
      nome, assunto, categoria, imagem, data_inicio, data_fim,
      descricao, local_nome, cep, rua, cidade, estado, nome_produtor,
    } = req.body;

    if (!nome || !data_inicio || !data_fim)
      return res.status(400).json({ erro: "Nome, data de início e data de término são obrigatórios." });

    const sql = `UPDATE eventos SET nome=?, assunto=?, categoria=?, imagem=?, data_inicio=?, data_fim=?,
      descricao=?, local_nome=?, cep=?, rua=?, cidade=?, estado=?, nome_produtor=? WHERE id=?`;

    const valores = [
      nome, assunto || null, categoria || null, imagem || null, data_inicio, data_fim,
      descricao || null, local_nome || null, cep || null, rua || null, cidade || null, estado || null, nome_produtor || null, id
    ];

    await db.query(sql, valores);
    res.json({ mensagem: "Evento atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao editar evento:", err);
    res.status(500).json({ erro: "Erro ao editar evento.", detalhes: err.message });
  }
};

// =====================================================
// EXCLUIR EVENTO
// Exige login e checa se o evento pertence ao usuário logado.
// =====================================================
exports.excluirEvento = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { id } = req.params;

    const existentes = await db.query("SELECT usuario_id FROM eventos WHERE id = ?", [id]);
    if (!existentes || existentes.length === 0) {
      return res.status(404).json({ erro: "Evento não encontrado." });
    }
    if (String(existentes[0].usuario_id) !== String(usuarioId)) {
      return res.status(403).json({ erro: "Você não tem permissão para excluir este evento." });
    }

    await db.query("DELETE FROM eventos WHERE id = ?", [id]);
    res.json({ mensagem: "Evento excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir evento:", err);
    res.status(500).json({ erro: "Erro ao excluir evento.", detalhes: err.message });
  }
};