// backend/services/notificacaoService.js
// ============================================================
// Verifica, para um usuário (ou para todos), se existe um evento
// próximo da localização atual dele que combine com o que ele
// costuma buscar/clicar — e dispara uma notificação.
//
// Também avisa o organizador (push + e-mail) quando um tipo de
// ingresso está acabando ou esgotou (verificarIngressoAcabando).
//
// Usa a mesma conexão de banco (connection.query com callback)
// que o resto do projeto já usa.
// ============================================================

const connection = require("../db/db_config");
const recomendacaoService = require('./recomendacaoService');
const webpush = require('web-push');

const RAIO_KM_NOTIFICACAO = 5; // raio considerado "perto" pra fins de notificação
const SCORE_MINIMO_PARA_NOTIFICAR = 0.5; // só notifica se o evento combinar razoavelmente com o gosto do usuário

// ── Ingresso acabando ──
// Avisa quando restar no máximo o MAIOR entre: 5 unidades ou 10% do total do tipo.
const PERCENTUAL_ACABANDO = 0.10;
const MINIMO_ACABANDO = 5;

// Configura as credenciais VAPID pro envio real de push
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

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
// 3) Salva a inscrição de push enviada pelo navegador
// ============================================================
async function salvarInscricaoPush(usuarioId, inscricao) {
  const { endpoint, keys } = inscricao;
  const { p256dh, auth } = keys;

  const sql = `
    INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE
      SET usuario_id = EXCLUDED.usuario_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth
  `;
  await query(sql, [usuarioId, endpoint, p256dh, auth]);
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

// Envia a notificação push de verdade pra todos os dispositivos
// inscritos daquele usuário (pode ter mais de um: celular, notebook, etc.)
async function enviarNotificacaoReal(usuarioId, mensagem) {
  const sql = `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?`;
  const inscricoes = await query(sql, [usuarioId]);

  if (inscricoes.length === 0) {
    console.log(`[push] usuário ${usuarioId} não tem inscrição de push. Mensagem: ${mensagem}`);
    return;
  }

  const payload = JSON.stringify({
    title: "Roles",
    body: mensagem,
  });

  for (const inscricao of inscricoes) {
    const subscription = {
      endpoint: inscricao.endpoint,
      keys: {
        p256dh: inscricao.p256dh,
        auth: inscricao.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`[push] Notificação enviada pro usuário ${usuarioId} (endpoint ${inscricao.endpoint.slice(0, 40)}...)`);
    } catch (err) {
      // 404/410 = a inscrição não existe mais (usuário desinstalou, limpou dados, etc.)
      // então removemos do banco pra não tentar de novo no futuro.
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.warn(`[push] Inscrição expirada, removendo do banco (id=${inscricao.id})`);
        await query(`DELETE FROM push_subscriptions WHERE id = ?`, [inscricao.id]);
      } else {
        console.error(`[push] Erro ao enviar notificação pro usuário ${usuarioId}:`, err.message);
      }
    }
  }
}

// ============================================================
// 4) Envia uma notificação avulsa pro usuário (não ligada a evento)
// Usada, por exemplo, pra mandar a notificação de boas-vindas
// assim que o usuário ativa o push, ou qualquer outro aviso manual.
// ============================================================
async function enviarNotificacaoUsuario(usuarioId, { titulo, mensagem, url }) {
  const sql = `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?`;
  const inscricoes = await query(sql, [usuarioId]);

  if (inscricoes.length === 0) {
    console.log(`[push] usuário ${usuarioId} não tem inscrição de push. Mensagem: ${mensagem}`);
    return;
  }

  const payload = JSON.stringify({
    titulo: titulo || "Roles",
    mensagem: mensagem,
    url: url || "/frontend/index.html",
  });

  for (const inscricao of inscricoes) {
    const subscription = {
      endpoint: inscricao.endpoint,
      keys: {
        p256dh: inscricao.p256dh,
        auth: inscricao.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`[push] Notificação avulsa enviada pro usuário ${usuarioId}.`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.warn(`[push] Inscrição expirada, removendo do banco (id=${inscricao.id})`);
        await query(`DELETE FROM push_subscriptions WHERE id = ?`, [inscricao.id]);
      } else {
        console.error(`[push] Erro ao enviar notificação avulsa pro usuário ${usuarioId}:`, err.message);
      }
    }
  }
}

// ============================================================
// 5) Ingresso acabando / esgotado — avisa o ORGANIZADOR do evento
//
// Chamada pelo comprarIngresso depois de uma compra que ocupou vagas.
// Calcula quantas unidades restam do tipo de ingresso; se estiver
// no limite (ou esgotado), avisa o dono do evento por push E por e-mail.
// Os dois canais são independentes: se um falhar, o outro ainda sai.
//
// Cada nível ('acabando' e 'esgotado') é avisado uma única vez por
// tipo de ingresso. O controle é feito pela tabela
// alertas_ingresso_acabando (UNIQUE ingresso_id + nivel), que também
// protege contra duas compras simultâneas avisando em duplicidade.
//
// Retorna { nivel, restante, mensagem } se avisou, ou null se não havia
// nada pra avisar.
// ============================================================
async function verificarIngressoAcabando(ingressoId) {
  const ingressoRows = await query(`
    SELECT i.id, i.titulo, i.quantidade_total, i.evento_id,
           e.nome AS nome_evento, e.usuario_id AS dono_id,
           u.nome_completo AS dono_nome, u.email AS dono_email
    FROM ingressos i
    JOIN eventos e ON e.id = i.evento_id
    LEFT JOIN usuarios u ON u.id = e.usuario_id
    WHERE i.id = ?
  `, [ingressoId]);
  const ingresso = ingressoRows[0];
  if (!ingresso || !ingresso.dono_id) return null;

  const ocupadosRows = await query(`
    SELECT COALESCE(SUM(quantidade), 0) AS total
    FROM vendas
    WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')
  `, [ingressoId]);
  const ocupados = Number(ocupadosRows[0]?.total) || 0;

  const total = Number(ingresso.quantidade_total) || 0;
  const restante = Math.max(0, total - ocupados);
  const limite = Math.max(MINIMO_ACABANDO, Math.ceil(total * PERCENTUAL_ACABANDO));

  if (restante > limite) return null; // ainda tem bastante, nada a avisar

  const nivel = restante === 0 ? 'esgotado' : 'acabando';

  // "Reserva" o aviso antes de enviar: se já existir, outro processo já avisou.
  try {
    await query(
      `INSERT INTO alertas_ingresso_acabando (ingresso_id, nivel) VALUES (?, ?)`,
      [ingresso.id, nivel]
    );
  } catch (err) {
    if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') return null; // já avisado
    throw err;
  }

  const mensagem = nivel === 'esgotado'
    ? `Esgotou! O ingresso "${ingresso.titulo}" do evento "${ingresso.nome_evento}" não tem mais unidades.`
    : `Seu ingresso "${ingresso.titulo}" do evento "${ingresso.nome_evento}" está acabando: restam apenas ${restante}.`;

  // Push e e-mail em paralelo; uma falha não derruba o outro canal.
  const envios = await Promise.allSettled([
    enviarNotificacaoUsuario(ingresso.dono_id, {
      titulo: nivel === 'esgotado' ? "Ingresso esgotado" : "Ingresso acabando",
      mensagem,
      url: "/frontend/dashboard/dashboard.html",
    }),
    (async () => {
      if (!ingresso.dono_email) {
        console.log(`[email] dono do evento ${ingresso.evento_id} não tem e-mail cadastrado.`);
        return;
      }
      const { enviarEmailIngressoAcabando } = require("./emailService");
      await enviarEmailIngressoAcabando({
        emailDono: ingresso.dono_email,
        nomeDono: ingresso.dono_nome,
        nomeEvento: ingresso.nome_evento,
        nomeIngresso: ingresso.titulo,
        nivel,
        restante,
        total,
      });
    })(),
  ]);

  envios.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[ingresso-acabando] Falha no envio de ${i === 0 ? 'push' : 'e-mail'}:`, r.reason?.message || r.reason);
    }
  });

  return { nivel, restante, mensagem };
}

module.exports = {
  verificarENotificarUsuario,
  verificarENotificarTodosUsuarios,
  salvarInscricaoPush,
  enviarNotificacaoUsuario,
  verificarIngressoAcabando,
};