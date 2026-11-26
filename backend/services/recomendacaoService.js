// backend/services/recomendacaoService.js
// ============================================================
// Motor de recomendação de eventos baseado em:
//   1) Comportamento do usuário (buscas e cliques recentes)
//   2) Proximidade geográfica (latitude/longitude do usuário)
//
// Usa a MESMA conexão que o eventosController.js já usa:
//   const connection = require("../db/db_config");
//   connection.query(sql, valores, (err, result) => {...})
//
// Por baixo dos panos eu só transformei esse callback em uma
// Promise (função "query" abaixo), pra poder usar await no
// resto do arquivo sem precisar aninhar callback dentro de
// callback. Não muda nada na forma como o db_config.js funciona.
// ============================================================

const connection = require("../db/db_config");

// ---------- Pesos configuráveis (mexa aqui pra calibrar) ----------
const PESO_TIPO = {
  clique: 3,   // clique demonstra mais interesse do que busca
  busca: 1
};

const JANELA_DIAS_COMPORTAMENTO = 60; // considera interações dos últimos 60 dias
const RAIO_KM_PADRAO = 15;            // raio padrão de busca por eventos próximos
const PESO_COMPORTAMENTO = 0.7;       // quanto o "gosto" do usuário pesa no score final
const PESO_DISTANCIA = 0.3;           // quanto a proximidade pesa no score final

// ------------------------------------------------------------
// Helper: transforma connection.query(sql, params, callback)
// em uma Promise, só pra poder usar await aqui dentro.
// ------------------------------------------------------------
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// ============================================================
// 1) REGISTRAR INTERAÇÃO (chame isso no clique/busca do usuário)
// ============================================================
async function registrarInteracao({ usuarioId, eventoId = null, tipo, categoria = null, termoBusca = null }) {
  if (!usuarioId || !tipo) {
    throw new Error('registrarInteracao: usuarioId e tipo são obrigatórios');
  }

  const sql = `
    INSERT INTO interacoes_usuario (usuario_id, evento_id, tipo, categoria, termo_busca)
    VALUES (?, ?, ?, ?, ?)
  `;
  await query(sql, [usuarioId, eventoId, tipo, categoria, termoBusca]);
}

// ============================================================
// 2) ATUALIZAR LOCALIZAÇÃO DO USUÁRIO (chame quando o app/site
//    pegar a geolocalização do navegador/celular)
// ============================================================
async function atualizarLocalizacaoUsuario({ usuarioId, latitude, longitude }) {
  const sql = `
    UPDATE usuarios
    SET ultima_latitude = ?, ultima_longitude = ?, localizacao_atualizada_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await query(sql, [latitude, longitude, usuarioId]);
}

// ============================================================
// 3) CALCULAR PREFERÊNCIAS DO USUÁRIO (categorias que ele mais
//    busca/clica, com peso maior para interações recentes)
// ============================================================
async function calcularPreferencias(usuarioId) {
  // Postgres/Supabase entende INTERVAL 'N days' direto.
  const sql = `
    SELECT categoria, tipo, criado_em
    FROM interacoes_usuario
    WHERE usuario_id = ?
      AND categoria IS NOT NULL
      AND criado_em >= (CURRENT_TIMESTAMP - INTERVAL '${JANELA_DIAS_COMPORTAMENTO} days')
  `;

  const interacoes = await query(sql, [usuarioId]);

  const pesosPorCategoria = {};
  const agora = Date.now();

  for (const interacao of interacoes) {
    const diasAtras = (agora - new Date(interacao.criado_em).getTime()) / (1000 * 60 * 60 * 24);
    const fatorRecencia = Math.max(0.1, 1 - diasAtras / JANELA_DIAS_COMPORTAMENTO); // decai com o tempo
    const peso = (PESO_TIPO[interacao.tipo] || 1) * fatorRecencia;

    pesosPorCategoria[interacao.categoria] = (pesosPorCategoria[interacao.categoria] || 0) + peso;
  }

  return pesosPorCategoria; // ex: { show: 8.4, bar: 2.1, balada: 5.0 }
}

// ============================================================
// 4) FÓRMULA DE DISTÂNCIA (Haversine) — calculada em JS
// ============================================================
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const R = 6371; // raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================
// 5) RECOMENDAÇÃO FINAL (comportamento + distância)
// ============================================================
async function obterRecomendacoes({ usuarioId, latitude = null, longitude = null, raioKm = RAIO_KM_PADRAO, limite = 10 }) {
  // 5.1 - pega preferências do usuário (categorias que ele mais interage)
  const preferencias = await calcularPreferencias(usuarioId);
  const maiorPeso = Math.max(1, ...Object.values(preferencias)); // evita divisão por 0

  // 5.2 - busca eventos futuros candidatos (mesmo filtro de data que
  //       o listarEventos do eventosController.js já usa)
  const sqlEventos = `
    SELECT id, nome, categoria, latitude, longitude, data_inicio
    FROM eventos
    WHERE data_inicio >= NOW()
  `;
  const eventos = await query(sqlEventos, []);

  // 5.3 - pontua cada evento
  const eventosComScore = eventos.map((evento) => {
    const pesoCategoria = preferencias[evento.categoria] || 0;
    const scoreComportamento = pesoCategoria / maiorPeso;

    let scoreDistancia = 0.5; // neutro, caso não tenha geolocalização disponível
    let distanciaKm = null;
    if (latitude != null && longitude != null && evento.latitude != null && evento.longitude != null) {
      distanciaKm = calcularDistanciaKm(latitude, longitude, evento.latitude, evento.longitude);
      scoreDistancia = distanciaKm <= raioKm ? 1 - distanciaKm / raioKm : 0;
    }

    const scoreFinal = scoreComportamento * PESO_COMPORTAMENTO + scoreDistancia * PESO_DISTANCIA;

    return { ...evento, distanciaKm, scoreFinal };
  });

  // 5.4 - ordena do maior score pro menor e corta no limite pedido
  return eventosComScore
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
    .slice(0, limite);
}

module.exports = {
  registrarInteracao,
  atualizarLocalizacaoUsuario,
  calcularPreferencias,
  calcularDistanciaKm,
  obterRecomendacoes
};