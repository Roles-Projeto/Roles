/**
 * Serviço de Fila de Espera (em memória) — Rolês
 *
 * Ideia: só N pessoas por evento podem estar na tela de compra (checkout) ao
 * mesmo tempo. Quem passa disso entra numa fila e é liberado por ordem de chegada.
 *
 *  - "ativo": tem permissão para comprar (até `capacidade` por evento)
 *  - "espera": está na fila, com posição e estimativa de tempo
 *  - fila usa heartbeat: quem fecha a aba e para de consultar sai da fila sozinho
 *  - ativo expira depois de `ttlAtivoMs` (tempo máximo para concluir a compra)
 *
 * Observação: por ser em memória, funciona com 1 instância do servidor (caso do
 * Render gratuito). Para várias instâncias, trocar o Map por Redis.
 */
const crypto = require('crypto');

const config = {
  capacidade: 50,            // pessoas simultâneas no checkout, por evento
  ttlAtivoMs: 10 * 60 * 1000, // tempo para finalizar a compra depois de liberado
  ttlHeartbeatMs: 15 * 1000,  // sem consultar a fila por esse tempo = desistiu
  tempoMedioCompraSeg: 90     // usado só para estimar o tempo de espera
};

const eventos = new Map(); // eventoId -> { ativos: Map, fila: [], tickets: Map }

function getEvento(eventoId) {
  const id = String(eventoId);
  if (!eventos.has(id)) eventos.set(id, { ativos: new Map(), fila: [], tickets: new Map(), historico: [] });
  return eventos.get(id);
}

function novoTicket() {
  return crypto.randomBytes(12).toString('hex');
}

/** Remove ativos expirados e desistentes da fila, depois promove quem está esperando. */
function manter(eventoId) {
  const ev = getEvento(eventoId);
  const agora = Date.now();

  for (const [t, info] of ev.ativos) {
    if (agora > info.expiraEm) {
      ev.ativos.delete(t);
      ev.tickets.delete(t);
    }
  }

  ev.fila = ev.fila.filter(t => {
    const info = ev.tickets.get(t);
    if (!info) return false;
    // tickets de demonstração não dão heartbeat, então não "desistem"
    if (!info.demo && agora - info.ultimoPing > config.ttlHeartbeatMs) {
      ev.tickets.delete(t);
      return false;
    }
    return true;
  });

  while (ev.ativos.size < config.capacidade && ev.fila.length) {
    const t = ev.fila.shift();
    const info = ev.tickets.get(t);
    if (!info) continue;
    info.estado = 'ativo';
    info.expiraEm = agora + (info.demo ? info.duracaoDemoMs : config.ttlAtivoMs);
    ev.ativos.set(t, info);
  }
}

function entrar(eventoId, ticketExistente) {
  manter(eventoId);
  const ev = getEvento(eventoId);

  // quem recarrega a página mantém o lugar
  if (ticketExistente && ev.tickets.has(ticketExistente)) return status(eventoId, ticketExistente);

  const ticket = novoTicket();
  const info = { estado: 'espera', ultimoPing: Date.now(), entrouEm: Date.now(), demo: false };
  ev.tickets.set(ticket, info);
  ev.fila.push(ticket);
  manter(eventoId);
  return status(eventoId, ticket);
}

function status(eventoId, ticket) {
  manter(eventoId);
  const ev = getEvento(eventoId);
  const info = ev.tickets.get(ticket);
  if (!info) return { ticket, estado: 'expirado' };

  info.ultimoPing = Date.now();

  if (info.estado === 'ativo') {
    return { ticket, estado: 'ativo', expiraEmSeg: Math.max(0, Math.round((info.expiraEm - Date.now()) / 1000)) };
  }

  const posicao = ev.fila.indexOf(ticket) + 1;
  const rodadas = Math.ceil(posicao / config.capacidade);
  return {
    ticket,
    estado: 'espera',
    posicao,
    totalNaFila: ev.fila.length,
    estimativaSeg: Math.round(rodadas * config.tempoMedioCompraSeg)
  };
}

function sair(eventoId, ticket) {
  const ev = getEvento(eventoId);
  ev.ativos.delete(ticket);
  ev.tickets.delete(ticket);
  ev.fila = ev.fila.filter(t => t !== ticket);
  manter(eventoId);
}

/** Usado no checkout / na rota de compra: este ticket pode comprar? */
function podeComprar(eventoId, ticket) {
  manter(eventoId);
  const info = getEvento(eventoId).tickets.get(ticket);
  return !!info && info.estado === 'ativo';
}

/** A fila só vale a pena quando há muita gente. Sempre ligada em modo demo. */
function filaAtiva(eventoId) {
  manter(eventoId);
  const ev = getEvento(eventoId);
  return ev.ativos.size >= config.capacidade || ev.fila.length > 0;
}

/* ───────────── MODO DEMONSTRAÇÃO ───────────── */

/** Simula N clientes chegando de uma vez. Quem estiver ativo "compra" e sai em 4–12 s. */
function simular(eventoId, quantidade) {
  const ev = getEvento(eventoId);
  const n = Math.max(1, Math.min(Number(quantidade) || 1, 5000));
  for (let i = 0; i < n; i++) {
    const t = novoTicket();
    ev.tickets.set(t, {
      estado: 'espera', ultimoPing: Date.now(), entrouEm: Date.now(),
      demo: true, duracaoDemoMs: 4000 + Math.random() * 8000
    });
    ev.fila.push(t);
  }
  manter(eventoId);
  return painel(eventoId);
}

function resetar(eventoId) {
  eventos.delete(String(eventoId));
}

function painel(eventoId) {
  manter(eventoId);
  const ev = getEvento(eventoId);
  const reais = [...ev.tickets.values()].filter(i => !i.demo).length;
  return {
    eventoId: String(eventoId),
    capacidade: config.capacidade,
    ativos: ev.ativos.size,
    naFila: ev.fila.length,
    clientesReais: reais,
    clientesSimulados: ev.tickets.size - reais,
    config: { ...config }
  };
}

function configurar(novo = {}) {
  if (Number(novo.capacidade) > 0) config.capacidade = Math.floor(Number(novo.capacidade));
  if (Number(novo.tempoMedioCompraSeg) > 0) config.tempoMedioCompraSeg = Number(novo.tempoMedioCompraSeg);
  if (Number(novo.ttlAtivoSeg) > 0) config.ttlAtivoMs = Number(novo.ttlAtivoSeg) * 1000;
  return { ...config };
}

setInterval(() => { for (const id of eventos.keys()) manter(id); }, 2000).unref();

module.exports = { entrar, status, sair, podeComprar, filaAtiva, simular, resetar, painel, configurar, config };