// backend/services/notificacaoService.js
// ============================================================
// Verifica, para um usuário (ou para todos), se existe um evento
// próximo da localização atual dele que combine com o que ele
// costuma buscar/clicar — e dispara uma notificação.
//
// Usa a mesma conexão de banco (connection.query com callback)
// que o resto do projeto já usa.
// ============================================================

const connection = require("../db/db_config");
const recomendacaoService = require('./recomendacaoService');

const RAIO_KM_NOTIFICACAO = 5; // raio considerado "perto" pra fins de notificação
const SCORE_MINIMO_PARA_NOTIFICAR = 0.5; // só notifica se o evento combinar razoavelmente com o gosto do usuário

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// ============================================================
// 1) Verifica e notifica UM usuário específico
// ============================================================
async function verificarENotificarUsuario(usuarioId) {
  const sqlUsuario = `SELECT ultima_latitude, ultima_longitude FROM usuarios WHERE id = ?`;
  const resultado = await query(sqlUsuario, [usuarioId]);
  const usuario = resultado[0];

  if (!usuario || usuario.ultima_latitude == null || usuario.ultima_longitude == null) {
    return []; // sem localização, não dá pra notificar por proximidade
  }

  const recomendados = await recomendacaoService.obterRecomendacoes({
    usuarioId,
    latitude: usuario.ultima_latitude,
    longitude: usuario.ultima_longitude,
    raioKm: RAIO_KM_NOTIFICACAO,
    limite: 5
  });

  const eventosParaNotificar = recomendados.filter(
    (evento) => evento.scoreFinal >= SCORE_MINIMO_PARA_NOTIFICAR && evento.distanciaKm != null
  );

  const notificacoesEnviadas = [];
  for (const evento of eventosParaNotificar) {
    const jaNotificado = await jaFoiNotificado(usuarioId, evento.id);
    if (jaNotificado) continue; // não manda o mesmo aviso duas vezes

    const mensagem = `Tem um evento de ${evento.categoria} que você pode curtir a ${evento.distanciaKm.toFixed(1)} km de você: ${evento.nome}`;
    await salvarNotificacao(usuarioId, evento.id, mensagem);
    await enviarNotificacaoReal(usuarioId, mensagem);
    notificacoesEnviadas.push({ eventoId: evento.id, mensagem });
  }

  return notificacoesEnviadas;
}

// ============================================================
// 2) Verifica e notifica TODOS os usuários (uso em cron job)
// ============================================================
async function verificarENotificarTodosUsuarios() {
  const sqlUsuarios = `
    SELECT id FROM usuarios
    WHERE ultima_latitude IS NOT NULL AND ultima_longitude IS NOT NULL
  `;
  const usuarios = await query(sqlUsuarios, []);

  const resultado = {};
  for (const usuario of usuarios) {
    resultado[usuario.id] = await verificarENotificarUsuario(usuario.id);
  }
  return resultado;
}

// ============================================================
// Funções auxiliares
// ============================================================
async function jaFoiNotificado(usuarioId, eventoId) {
  const sql = `SELECT id FROM notificacoes WHERE usuario_id = ? AND evento_id = ?`;
  const linhas = await query(sql, [usuarioId, eventoId]);
  return linhas.length > 0;
}

async function salvarNotificacao(usuarioId, eventoId, mensagem) {
  const sql = `
    INSERT INTO notificacoes (usuario_id, evento_id, mensagem)
    VALUES (?, ?, ?)
  `;
  await query(sql, [usuarioId, eventoId, mensagem]);
}

// PLACEHOLDER: troque pelo envio real. Vocês já têm emailService.js
// e emailTemplate.js no projeto — dá pra plugar o envio de e-mail
// real aqui chamando essas funções, se quiserem.
async function enviarNotificacaoReal(usuarioId, mensagem) {
  console.log(`[notificação] usuário ${usuarioId}: ${mensagem}`);
}

module.exports = {
  verificarENotificarUsuario,
  verificarENotificarTodosUsuarios
};