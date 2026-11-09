/**
 * Rotas da fila de espera.
 *
 * No server.js (Express):
 *   const filaRoutes = require('./filaRoutes');
 *   app.use('/fila', filaRoutes);
 *
 * Para proteger a compra de verdade, use o middleware exigirTicketFila
 * na rota POST /ingressos/comprar (exemplo no final do arquivo).
 */
const express = require('express');
const fila = require('../services/filaService');

const router = express.Router();

// Cliente chega e entra na fila (ou é liberado direto se houver vaga)
router.post('/entrar', (req, res) => {
  const { evento_id, ticket } = req.body || {};
  if (!evento_id) return res.status(400).json({ erro: 'evento_id é obrigatório' });
  res.json(fila.entrar(evento_id, ticket));
});

// Cliente consulta posição (a cada ~2s). Serve também de heartbeat.
router.get('/status/:eventoId/:ticket', (req, res) => {
  res.json(fila.status(req.params.eventoId, req.params.ticket));
});

// Cliente desiste / fecha a página (sendBeacon envia POST)
router.post('/sair', (req, res) => {
  const { evento_id, ticket } = req.body || {};
  if (evento_id && ticket) fila.sair(evento_id, ticket);
  res.json({ ok: true });
});

/* ── Modo demonstração (para a aula) ── */
router.get('/painel/:eventoId', (req, res) => res.json(fila.painel(req.params.eventoId)));
router.post('/demo/simular', (req, res) => {
  const { evento_id, quantidade } = req.body || {};
  res.json(fila.simular(evento_id || 'demo', quantidade));
});
router.post('/demo/reset', (req, res) => {
  fila.resetar((req.body || {}).evento_id || 'demo');
  res.json({ ok: true });
});
router.post('/demo/config', (req, res) => res.json(fila.configurar(req.body)));

/* ── Middleware para proteger a compra ── */
function exigirTicketFila(req, res, next) {
  const eventoId = req.body?.evento_id;
  const ticket = req.headers['x-fila-ticket'];
  // Só exige ticket quando existe fila ativa para o evento
  if (!fila.filaAtiva(eventoId) && !ticket) return next();
  if (fila.podeComprar(eventoId, ticket)) return next();
  res.status(429).json({ erro: 'Você precisa aguardar sua vez na fila de espera.' });
}

module.exports = router;
module.exports.exigirTicketFila = exigirTicketFila;

/* Exemplo:
   const { exigirTicketFila } = require('./filaRoutes');
   router.post('/comprar', exigirTicketFila, comprarController);
*/