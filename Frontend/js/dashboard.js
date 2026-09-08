'use strict';

// ─────────────────────────────────────────────
// FLAG GLOBAL DE ESTADOS VAZIOS
// ─────────────────────────────────────────────
let _dashboardVazio = false;
let _estabelecimentosVazio = false;
let _eventosVazio = false;
let _vendasVazio = false;
let _notificacoesVazio = false;

// ─────────────────────────────────────────────
// DADOS REAIS CARREGADOS DO BACKEND
// ─────────────────────────────────────────────
let _eventosReais = [];
let _estabsReais = [];
let _vendasReais = [];
let _vendidosPorEventoReais = {};   // { evento_id: { qtd, receita } } — a partir de vendas aprovadas
let _ingressosPorEventoReais = {};  // { evento_id: totalIngressos } — a partir da tabela `ingressos`

// ─────────────────────────────────────────────
// CARREGAMENTO CONSOLIDADO DE DADOS REAIS
// ─────────────────────────────────────────────
async function carregarDashboard() {
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  if (!userId || !token) {
    _mostrarVazioTodos();
    return;
  }

  const headers = { 'Authorization': 'Bearer ' + token };

  try {
    const [resEventos, resEstabs, resVendas, resIngressos] = await Promise.all([
      fetch(`${window.API_BASE}/eventos?criador_id=${userId}`, { headers }),
      fetch(`${window.API_BASE}/estabelecimentos/meus`, { headers }),
      fetch(`${window.API_BASE}/pedidos/vendas/${userId}`, { headers }),
      // Rota nova (ingressosDashboard.js). Se ainda não estiver no ar no backend,
      // resIngressos.ok vai ser false e seguimos com ocupação = 0, sem quebrar o resto.
      fetch(`${window.API_BASE}/ingressos/totais/${userId}`, { headers }).catch(() => null)
    ]);

    const eventos = resEventos.ok ? await resEventos.json() : [];
    const estabs = resEstabs.ok ? await resEstabs.json() : [];
    const vendas = resVendas.ok ? await resVendas.json() : [];
    const ingressosTotais = (resIngressos && resIngressos.ok) ? await resIngressos.json() : [];

    _eventosReais = Array.isArray(eventos) ? eventos : (eventos.data || []);
    _estabsReais = Array.isArray(estabs) ? estabs : (estabs.data || []);
    _vendasReais = Array.isArray(vendas) ? vendas : (vendas.data || []);

    _ingressosPorEventoReais = {};
    (Array.isArray(ingressosTotais) ? ingressosTotais : []).forEach(row => {
      _ingressosPorEventoReais[row.evento_id] = Number(row.total) || 0;
    });

    const vendidosPorEvento = calcularVendidosPorEvento(_vendasReais);
    _vendidosPorEventoReais = vendidosPorEvento;
    const vendasAprovadas = _vendasReais.filter(v => (v.status || '').toLowerCase() === 'aprovado');

    processarEstadosVazios(_eventosReais, _estabsReais, vendidosPorEvento);

    renderizarVendas(_vendasReais);
    renderizarVendasRecentes(_vendasReais);
    atualizarKPIs(vendasAprovadas, _eventosReais, _estabsReais, vendidosPorEvento, _ingressosPorEventoReais);
    prepararGraficos(_eventosReais, vendasAprovadas, vendidosPorEvento, _ingressosPorEventoReais);
    renderizarProximosEventos(_eventosReais, vendidosPorEvento, _ingressosPorEventoReais);
    renderizarReceitaPorLocal(_eventosReais, vendasAprovadas);
    renderizarNotificacoesReais(_vendasReais);

    if (!_dashboardVazio) criarGraficos();

  } catch (e) {
    console.warn('Erro ao carregar dados do dashboard:', e);
    _mostrarVazioTodos();
  }
}

// Conta pedidos aprovados por evento_id (proxy de "vendidos" — a query
// vendasDoDono não traz quantidade de ingressos por pedido, só o total
// em dinheiro, então aqui 1 pedido aprovado = 1 unidade "vendida".
// Isso fica impreciso se algum pedido tiver mais de 1 ingresso —
// pra corrigir de verdade, precisa de uma coluna quantidade em pedidos
// ou uma tabela pedido_itens).
function calcularVendidosPorEvento(vendas) {
  const mapa = {};
  vendas.forEach(v => {
    if ((v.status || '').toLowerCase() !== 'aprovado') return;
    if (!mapa[v.evento_id]) mapa[v.evento_id] = { qtd: 0, receita: 0 };
    mapa[v.evento_id].qtd += 1;
    mapa[v.evento_id].receita += parseFloat(v.valor_total) || 0;
  });
  return mapa;
}

// ─────────────────────────────────────────────
// ESTADOS VAZIOS DO DASHBOARD
// ─────────────────────────────────────────────
function processarEstadosVazios(eventos, estabs, vendidosPorEvento) {
  try {
    const qtdEventos = Array.isArray(eventos) ? eventos.length : 0;
    const qtdEstabs = Array.isArray(estabs) ? estabs.length : 0;

    if (qtdEventos === 0 && qtdEstabs === 0) {
      _dashboardVazio = true;
      _mostrarVazio('dashboard', 'visao-geral');
      document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row').forEach(el => el.style.display = 'none');
      const banner = document.getElementById('alertBanner');
      if (banner) banner.style.display = 'none';
    } else {
      _dashboardVazio = false;
    }

    if (qtdEstabs === 0) {
      _estabelecimentosVazio = true;
      _mostrarVazio('estabelecimentos', 'estabelecimentos');
    } else {
      _estabelecimentosVazio = false;
      renderizarEstabelecimentos(estabs);
    }

    if (qtdEventos === 0) {
      _eventosVazio = true;
      _mostrarVazio('eventos', 'eventos');
    } else {
      _eventosVazio = false;
      renderizarEventos(eventos, vendidosPorEvento);
    }

    if (_vendasReais.length === 0) {
      _vendasVazio = true;
      _mostrarVazio('vendas', 'vendas');
      const tableWrap = document.querySelector('#vendas .table-wrap');
      if (tableWrap) tableWrap.style.display = 'none';
    } else {
      _vendasVazio = false;
    }

    if (qtdEventos === 0 && qtdEstabs === 0) {
      _notificacoesVazio = true;
      _mostrarVazio('notificacoes', 'notificacoes');
    } else {
      _notificacoesVazio = false;
    }

  } catch (e) {
    console.warn('Erro ao processar estados vazios:', e);
  }
}

// Mostra estado vazio em todas as abas (fallback de erro de rede)
function _mostrarVazioTodos() {
  _dashboardVazio = true;
  _estabelecimentosVazio = true;
  _eventosVazio = true;
  _vendasVazio = true;
  _notificacoesVazio = true;

  ['dashboard', 'estabelecimentos', 'eventos', 'vendas', 'notificacoes'].forEach(id => {
    _mostrarVazio(id, id);
  });
  document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row, .table-wrap, #notifList, .loading-placeholder').forEach(el => el.style.display = 'none');
  const banner = document.getElementById('alertBanner');
  if (banner) banner.style.display = 'none';
  document.querySelectorAll('.ev-card').forEach(el => el.style.display = 'none');
}

// Configurações por aba
const _configVazio = {
  'visao-geral': {
    icone: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
    titulo: 'Seu dashboard está vazio',
    descricao: 'Crie um evento ou cadastre um estabelecimento para começar a ver seus relatórios, vendas e métricas aqui.',
    botoes: true
  },
  'estabelecimentos': {
    icone: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    titulo: 'Nenhum estabelecimento cadastrado',
    descricao: 'Cadastre seu primeiro estabelecimento para gerenciar seu negócio, receber avaliações e acompanhar as métricas.',
    botoes: false,
    botaoUnico: { label: 'Cadastrar estabelecimento', href: '/frontend/criarEstabelecimentos/criarEstabelecimentos.html' }
  },
  'eventos': {
    icone: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    titulo: 'Nenhum evento criado',
    descricao: 'Crie seu primeiro evento para começar a vender ingressos e acompanhar as métricas de ocupação.',
    botoes: false,
    botaoUnico: { label: 'Criar meu primeiro evento', href: '/frontend/criareventos/criareventos.html' }
  },
  'vendas': {
    icone: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
    titulo: 'Nenhuma venda ainda',
    descricao: 'Quando seus ingressos começarem a ser vendidos, todas as transações aparecerão aqui.',
    botoes: true
  },
  'notificacoes': {
    icone: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
    titulo: 'Nenhuma notificação',
    descricao: 'Você receberá notificações de vendas, avaliações e atualizações do seu negócio aqui.',
    botoes: false
  }
};

function _mostrarVazio(secaoId, tipo) {
  const secao = document.getElementById(secaoId);
  if (!secao || secao.querySelector('.empty-state-box')) return;

  secao.querySelectorAll('.loading-placeholder').forEach(el => el.remove());

  const cfg = _configVazio[tipo] || _configVazio['visao-geral'];

  let botoesHTML = '';
  if (cfg.botoes) {
    botoesHTML = `
            <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:center;">
                <a href="/frontend/criareventos/criareventos.html" style="
                    display:inline-flex; align-items:center; gap:8px;
                    background:var(--p);
                    color:#241A02; text-decoration:none;
                    padding:12px 24px; border-radius:10px;
                    font-family:'Inter',sans-serif; font-size:14px; font-weight:600;
                    box-shadow:0 4px 14px rgba(255,182,39,.3);"
                    onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Criar evento
                </a>
                <a href="/frontend/criarEstabelecimentos/criarEstabelecimentos.html" style="
                    display:inline-flex; align-items:center; gap:8px;
                    background:var(--card); color:var(--p); text-decoration:none;
                    padding:12px 24px; border-radius:10px;
                    border:1.5px solid var(--p-border);
                    font-family:'Inter',sans-serif; font-size:14px; font-weight:600;"
                    onmouseover="this.style.background='var(--p-bg)'" onmouseout="this.style.background='var(--card)'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Cadastrar estabelecimento
                </a>
            </div>`;
  } else if (cfg.botaoUnico) {
    botoesHTML = `
            <a href="${cfg.botaoUnico.href}" style="
                display:inline-flex; align-items:center; gap:8px;
                background:var(--p);
                color:#241A02; text-decoration:none;
                padding:12px 28px; border-radius:10px;
                font-family:'Inter',sans-serif; font-size:14px; font-weight:600;
                box-shadow:0 4px 14px rgba(255,182,39,.3);"
                onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                ${cfg.botaoUnico.label}
            </a>`;
  }

  const vazio = document.createElement('div');
  vazio.className = 'empty-state-box';
  vazio.innerHTML = `
        <div style="
            width:80px; height:80px; border-radius:50%;
            background:var(--p-bg); display:flex; align-items:center;
            justify-content:center; margin-bottom:24px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--p)" stroke-width="1.8">
                ${cfg.icone}
            </svg>
        </div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700;
                   color:var(--text); margin:0 0 8px;">${cfg.titulo}</h2>
        <p style="font-family:'Inter',sans-serif; font-size:14px; color:var(--text-3);
                  max-width:420px; line-height:1.7; margin:0 0 40px;">${cfg.descricao}</p>
        ${botoesHTML}
    `;

  secao.appendChild(vazio);
}

// ─────────────────────────────────────────────
// KPIs (VISÃO GERAL) — 6 cards, todos com dado real
// ─────────────────────────────────────────────
function atualizarKPIs(vendasAprovadas, eventos, estabs, vendidosPorEvento, ingressosPorEvento) {
  const receitaTotal = vendasAprovadas.reduce((s, v) => s + (parseFloat(v.valor_total) || 0), 0);
  const ingressosVendidos = vendasAprovadas.length; // proxy — ver nota em calcularVendidosPorEvento

  // Eventos "ativos" = data_inicio ainda não passou (ou sem data definida)
  const agora = new Date();
  const eventosAtivos = eventos.filter(e => !e.data_inicio || new Date(e.data_inicio) >= agora).length;

  let somaNotas = 0, somaAvaliacoes = 0;
  estabs.forEach(es => {
    const n = Number(es.avaliacoes) || 0;
    somaNotas += (Number(es.nota) || 0) * n;
    somaAvaliacoes += n;
  });
  const avaliacaoMedia = somaAvaliacoes > 0 ? (somaNotas / somaAvaliacoes).toFixed(1) : '—';

  const ticketMedio = ingressosVendidos > 0 ? receitaTotal / ingressosVendidos : 0;

  // Ocupação média: soma de vendidos / soma de capacidade total, entre eventos que já têm ingressos cadastrados
  let somaVendidos = 0, somaCapacidade = 0;
  eventos.forEach(e => {
    const total = ingressosPorEvento[e.id] || 0;
    if (total > 0) {
      somaCapacidade += total;
      somaVendidos += (vendidosPorEvento[e.id] && vendidosPorEvento[e.id].qtd) || 0;
    }
  });
  const ocupacaoMedia = somaCapacidade > 0 ? Math.round((somaVendidos / somaCapacidade) * 100) : null;

  const elReceita = document.getElementById('total-vendas');
  if (elReceita) elReceita.textContent = formatarMoeda(receitaTotal);

  const elIngressos = document.getElementById('ingressos-vendidos');
  if (elIngressos) elIngressos.textContent = ingressosVendidos;

  const elEventosAtivos = document.getElementById('eventos-ativos');
  if (elEventosAtivos) elEventosAtivos.textContent = eventosAtivos;

  const elNota = document.getElementById('avaliacao-media');
  if (elNota) elNota.textContent = avaliacaoMedia === '—' ? '—' : avaliacaoMedia + ' ⭐';

  const elDescNota = document.getElementById('avaliacao-desc');
  if (elDescNota) elDescNota.textContent = somaAvaliacoes + ' avaliações no total';

  const elTicket = document.getElementById('ticket-medio');
  if (elTicket) elTicket.textContent = formatarMoeda(ticketMedio);

  const elOcupacao = document.getElementById('taxa-ocupacao');
  if (elOcupacao) elOcupacao.textContent = ocupacaoMedia === null ? '—' : ocupacaoMedia + '%';
}

// ─────────────────────────────────────────────
// INSTÂNCIAS DOS GRÁFICOS
// ─────────────────────────────────────────────
let salesChartInst = null;
let ratingChartInst = null;
let chartData = { '6m': { labels: [], data: [] }, '3m': { labels: [], data: [] }, '1m': { labels: [], data: [] } };
let currentPeriod = '6m';
let eventosData = { labels: [], vendidos: [], disponiveis: [] };

function prepararGraficos(eventos, vendasAprovadas, vendidosPorEvento, ingressosPorEvento) {
  chartData = construirDadosReceitaMensal(vendasAprovadas);
  eventosData = construirDadosIngressosPorEvento(eventos, vendidosPorEvento, ingressosPorEvento);
}

function construirDadosReceitaMensal(vendasAprovadas) {
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const receitaPorChave = {};
  vendasAprovadas.forEach(v => {
    if (!v.criado_em) return;
    const d = new Date(v.criado_em);
    const chave = d.getFullYear() + '-' + d.getMonth();
    receitaPorChave[chave] = (receitaPorChave[chave] || 0) + (parseFloat(v.valor_total) || 0);
  });

  const gerarPeriodoMeses = (qtd) => {
    const labels = [];
    const data = [];
    const hoje = new Date();
    for (let i = qtd - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = d.getFullYear() + '-' + d.getMonth();
      labels.push(nomesMeses[d.getMonth()]);
      data.push(receitaPorChave[chave] || 0);
    }
    return { labels, data };
  };

  // "1M" quebra o mês corrente em 4 semanas
  const hoje = new Date();
  const semanas = [0, 0, 0, 0];
  vendasAprovadas.forEach(v => {
    if (!v.criado_em) return;
    const d = new Date(v.criado_em);
    if (d.getFullYear() !== hoje.getFullYear() || d.getMonth() !== hoje.getMonth()) return;
    const idx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
    semanas[idx] += parseFloat(v.valor_total) || 0;
  });

  return {
    '6m': gerarPeriodoMeses(6),
    '3m': gerarPeriodoMeses(3),
    '1m': { labels: ['S1', 'S2', 'S3', 'S4'], data: semanas }
  };
}

function construirDadosIngressosPorEvento(eventos, vendidosPorEvento, ingressosPorEvento) {
  const comVendas = eventos
    .map(e => ({
      nome: e.nome,
      vendidos: (vendidosPorEvento[e.id] && vendidosPorEvento[e.id].qtd) || 0,
      total: ingressosPorEvento[e.id] || 0
    }))
    .sort((a, b) => b.vendidos - a.vendidos)
    .slice(0, 6);

  return {
    labels: comVendas.map(e => e.nome),
    vendidos: comVendas.map(e => e.vendidos),
    disponiveis: comVendas.map(e => Math.max(0, e.total - e.vendidos))
  };
}

// ─────────────────────────────────────────────
// CRIAR / RECRIAR GRÁFICOS
// Paleta alinhada ao tema escuro dourado/coral do resto do produto
// ─────────────────────────────────────────────
const CHART_FONT = "'Inter', sans-serif";
const CHART_COLORS = {
  gold: '#FFB627',
  goldSoft: 'rgba(255,182,39,0.14)',
  coral: '#FF5C7A',
  coralSoft: 'rgba(255,92,122,0.35)',
  grid: 'rgba(255,255,255,0.06)',
  tick: '#9689B8',
  tooltipBg: '#1C1834',
  tooltipBorder: '#322850',
  tooltipText: '#F1EDFA'
};

function criarGraficos() {
  const salesCanvas = document.getElementById('salesChart');
  const ratingCanvas = document.getElementById('ratingChart');
  if (!salesCanvas || !ratingCanvas) return;

  if (salesChartInst) { salesChartInst.destroy(); salesChartInst = null; }
  if (ratingChartInst) { ratingChartInst.destroy(); ratingChartInst = null; }

  const periodo = chartData[currentPeriod];

  salesChartInst = new Chart(salesCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: periodo.labels,
      datasets: [{
        label: 'Receita (R$)',
        data: periodo.data,
        borderColor: CHART_COLORS.gold,
        backgroundColor: CHART_COLORS.goldSoft,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: CHART_COLORS.gold,
        pointBorderColor: CHART_COLORS.tooltipBg,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: CHART_COLORS.tooltipBg,
          borderColor: CHART_COLORS.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART_COLORS.tooltipText,
          bodyColor: CHART_COLORS.tooltipText,
          titleFont: { family: CHART_FONT, size: 12, weight: '600' },
          bodyFont: { family: CHART_FONT, size: 13 },
          padding: 12, cornerRadius: 8, displayColors: false,
          callbacks: {
            title: items => 'Mês: ' + items[0].label,
            label: ctx => ' R$ ' + ctx.parsed.y.toLocaleString('pt-BR')
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: CHART_FONT, size: 11 }, color: CHART_COLORS.tick } },
        y: {
          grid: { color: CHART_COLORS.grid },
          border: { display: false },
          ticks: {
            font: { family: CHART_FONT, size: 11 }, color: CHART_COLORS.tick,
            callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        }
      }
    }
  });

  ratingChartInst = new Chart(ratingCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: eventosData.labels,
      datasets: [
        { label: 'Vendidos', data: eventosData.vendidos, backgroundColor: CHART_COLORS.gold, borderRadius: 6, barPercentage: 0.6 },
        { label: 'Disponíveis', data: eventosData.disponiveis, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, barPercentage: 0.6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', font: { family: CHART_FONT, size: 12 }, color: CHART_COLORS.tick, padding: 20 }
        },
        tooltip: {
          backgroundColor: CHART_COLORS.tooltipBg,
          borderColor: CHART_COLORS.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART_COLORS.tooltipText,
          bodyColor: CHART_COLORS.tooltipText,
          titleFont: { family: CHART_FONT, size: 12, weight: '600' },
          bodyFont: { family: CHART_FONT, size: 13 },
          padding: 12, cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: CHART_FONT, size: 11 }, color: CHART_COLORS.tick } },
        y: {
          grid: { color: CHART_COLORS.grid },
          border: { display: false },
          min: 0,
          ticks: { font: { family: CHART_FONT, size: 11 }, color: CHART_COLORS.tick, precision: 0 }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────
// PERÍODO DOS GRÁFICOS
// ─────────────────────────────────────────────
function setPeriod(btn, period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!salesChartInst) return;
  const d = chartData[period];
  salesChartInst.data.labels = d.labels;
  salesChartInst.data.datasets[0].data = d.data;
  salesChartInst.update('active');
}

// ─────────────────────────────────────────────
// NAVEGAÇÃO ENTRE SEÇÕES
// ─────────────────────────────────────────────
function showSection(sectionId, btn) {
  document.querySelectorAll('.dsection').forEach(s => s.classList.remove('active-section'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active-section');

  document.querySelectorAll('.dnav-tab').forEach(t => t.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.dnav-tab').forEach(t => {
      const m = t.getAttribute('onclick')?.match(/'([^']+)'/);
      if (m && m[1] === sectionId) t.classList.add('active');
    });
  }

  if (sectionId === 'dashboard') {
    if (_dashboardVazio) {
      document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row').forEach(el => el.style.display = 'none');
      const banner = document.getElementById('alertBanner');
      if (banner) banner.style.display = 'none';
      if (!document.querySelector('#dashboard .empty-state-box')) {
        _mostrarVazio('dashboard', 'visao-geral');
      }
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { criarGraficos(); });
      });
    }
  }

  if (sectionId === 'estabelecimentos' && _estabelecimentosVazio) {
    if (!document.querySelector('#estabelecimentos .empty-state-box')) {
      _mostrarVazio('estabelecimentos', 'estabelecimentos');
    }
  }

  if (sectionId === 'eventos' && _eventosVazio) {
    if (!document.querySelector('#eventos .empty-state-box')) {
      _mostrarVazio('eventos', 'eventos');
    }
  }

  if (sectionId === 'vendas' && _vendasVazio) {
    const tableWrap = document.querySelector('#vendas .table-wrap');
    if (tableWrap) tableWrap.style.display = 'none';
    if (!document.querySelector('#vendas .empty-state-box')) {
      _mostrarVazio('vendas', 'vendas');
    }
  }

  if (sectionId === 'notificacoes' && _notificacoesVazio) {
    if (!document.querySelector('#notificacoes .empty-state-box')) {
      _mostrarVazio('notificacoes', 'notificacoes');
    }
  }
}

// ─────────────────────────────────────────────
// MODAL DE INGRESSOS — POR TIPO
//
// Substitui o antigo modal (1 total/vendido/disponível por evento
// inteiro) por uma lista dos tipos de ingresso cadastrados
// (GET /ingressos/tipos/:evento_id), cada um editável e excluível
// individualmente, mais um formulário pra criar tipos novos.
// ─────────────────────────────────────────────
let _ticketModalEventoId = null;
let _tiposIngressoAtuais = [];

async function openTicketModal(eventoId) {
  const evento = _eventosReais.find(e => String(e.id) === String(eventoId));
  if (!evento) return;

  _ticketModalEventoId = evento.id;

  const subtitulo = document.getElementById('ticketModalSubtitle');
  if (subtitulo) subtitulo.textContent = `${evento.nome || 'Evento'} · ${evento.local_nome || evento.cidade || 'Local não informado'}`;

  const dataEl = document.getElementById('ticketModalData');
  if (dataEl) dataEl.textContent = formatarDataCurta(evento.data_inicio);

  const horaEl = document.getElementById('ticketModalHorario');
  if (horaEl) horaEl.textContent = formatarHora(evento.data_inicio);

  esconderFormNovoTipo();

  const m = document.getElementById('ticketModal');
  if (m) m.style.display = 'flex';

  await carregarTiposIngressoModal(evento.id);
}

function closeTicketModal() {
  const m = document.getElementById('ticketModal');
  if (m) m.style.display = 'none';
  _ticketModalEventoId = null;
  _tiposIngressoAtuais = [];
  esconderFormNovoTipo();
}

async function carregarTiposIngressoModal(eventoId) {
  const lista = document.getElementById('tiposIngressoList');
  if (!lista) return;
  lista.innerHTML = `<p class="loading-placeholder" style="font-size:13px; color:var(--text-3); text-align:center; padding:20px 0;">Carregando tipos de ingresso...</p>`;

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': 'Bearer ' + token };

  try {
    const res = await fetch(`${window.API_BASE}/ingressos/tipos/${eventoId}`, { headers });
    const tipos = res.ok ? await res.json() : [];
    _tiposIngressoAtuais = Array.isArray(tipos) ? tipos : [];
    renderizarTiposIngressoModal(_tiposIngressoAtuais);
  } catch (e) {
    console.warn('Erro ao carregar tipos de ingresso:', e);
    lista.innerHTML = `<p style="font-size:13px; color:var(--coral); text-align:center; padding:20px 0;">Não foi possível carregar os tipos de ingresso.</p>`;
  }
}

function renderizarTiposIngressoModal(tipos) {
  const lista = document.getElementById('tiposIngressoList');
  if (!lista) return;
  lista.innerHTML = '';

  if (!tipos || tipos.length === 0) {
    lista.innerHTML = `<p style="font-size:13px; color:var(--text-3); text-align:center; padding:20px 0;">Nenhum tipo de ingresso cadastrado ainda. Clique em "Adicionar tipo" para criar o primeiro.</p>`;
    return;
  }

  tipos.forEach(tipo => lista.appendChild(_linhaTipoIngresso(tipo)));
}

function _linhaTipoIngresso(tipo) {
  const vendidos = Number(tipo.vendidos) || 0;
  const cortesia = Number(tipo.cortesia) || 0;
  const total = Number(tipo.quantidade_total) || 0;
  const ocupados = vendidos + cortesia;
  const disponiveis = Math.max(0, total - ocupados);
  const podeExcluir = ocupados === 0;

  const row = document.createElement('div');
  row.className = 'tipo-row';
  row.dataset.id = tipo.id;

  row.innerHTML = `
    <div class="tipo-row-fields">
      <div class="tf">
        <label>Nome</label>
        <input type="text" class="tipo-titulo" value="${tipo.titulo || ''}">
      </div>
      <div class="tf">
        <label>Categoria</label>
        <input type="text" class="tipo-categoria" value="${tipo.tipo || ''}" placeholder="ex: Pista, VIP...">
      </div>
      <div class="tf">
        <label>Valor (R$)</label>
        <input type="number" step="0.01" min="0" class="tipo-valor" value="${Number(tipo.valor) || 0}">
      </div>
      <div class="tf">
        <label>Quantidade total</label>
        <input type="number" min="${ocupados}" class="tipo-total" value="${total}">
      </div>
    </div>
    <div class="tipo-row-stats">
      <div class="tipo-stat"><span>${vendidos}</span><small>vendidos</small></div>
      <div class="tipo-stat"><span>${cortesia}</span><small>cortesia</small></div>
      <div class="tipo-stat"><span>${disponiveis}</span><small>disponíveis</small></div>
    </div>
    <div class="tipo-row-actions">
      <button class="btn-tipo-save" onclick="salvarTipoIngressoExistente(${tipo.id})">Salvar</button>
      <button class="btn-tipo-delete" onclick="excluirTipoIngressoExistente(${tipo.id})" ${podeExcluir ? '' : 'disabled title="Não é possível excluir: já há vendas/cortesias neste tipo"'}>Excluir</button>
    </div>
  `;
  return row;
}

async function salvarTipoIngressoExistente(id) {
  const row = document.querySelector(`.tipo-row[data-id="${id}"]`);
  if (!row) return;

  const titulo = row.querySelector('.tipo-titulo').value.trim();
  const tipoCategoria = row.querySelector('.tipo-categoria').value.trim();
  const valor = parseFloat(row.querySelector('.tipo-valor').value) || 0;
  const quantidade_total = parseInt(row.querySelector('.tipo-total').value) || 0;

  if (!titulo) {
    showToast('Dê um nome para o tipo de ingresso.', 'error');
    return;
  }

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`${window.API_BASE}/ingressos/tipos/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ titulo, tipo: tipoCategoria || null, valor, quantidade_total })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao salvar tipo de ingresso.');

    showToast('Tipo de ingresso atualizado!', 'success');
    await carregarTiposIngressoModal(_ticketModalEventoId);
    carregarDashboard();
  } catch (e) {
    console.error('[salvarTipoIngressoExistente] erro:', e);
    showToast('Não foi possível salvar: ' + e.message, 'error');
  }
}

async function excluirTipoIngressoExistente(id) {
  if (!confirm('Excluir este tipo de ingresso? Essa ação não pode ser desfeita.')) return;

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': 'Bearer ' + token };

  try {
    const res = await fetch(`${window.API_BASE}/ingressos/tipos/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao excluir tipo de ingresso.');

    showToast('Tipo de ingresso excluído.', 'success');
    await carregarTiposIngressoModal(_ticketModalEventoId);
    carregarDashboard();
  } catch (e) {
    console.error('[excluirTipoIngressoExistente] erro:', e);
    showToast('Não foi possível excluir: ' + e.message, 'error');
  }
}

function mostrarFormNovoTipo() {
  const form = document.getElementById('novoTipoForm');
  if (!form) return;
  form.innerHTML = `
    <div class="tipo-row-fields">
      <div class="tf">
        <label>Nome</label>
        <input type="text" id="novoTipoTitulo" placeholder="ex: Pista, VIP, Camarote...">
      </div>
      <div class="tf">
        <label>Categoria</label>
        <input type="text" id="novoTipoCategoria" placeholder="opcional">
      </div>
      <div class="tf">
        <label>Valor (R$)</label>
        <input type="number" step="0.01" min="0" id="novoTipoValor" value="0">
      </div>
      <div class="tf">
        <label>Quantidade total</label>
        <input type="number" min="0" id="novoTipoTotal" value="0">
      </div>
    </div>
    <div class="tipo-row-actions">
      <button class="btn-tipo-save" onclick="criarNovoTipoIngresso()">Criar tipo</button>
      <button class="btn-tipo-delete" onclick="esconderFormNovoTipo()">Cancelar</button>
    </div>
  `;
  form.style.display = 'flex';
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function esconderFormNovoTipo() {
  const form = document.getElementById('novoTipoForm');
  if (!form) return;
  form.style.display = 'none';
  form.innerHTML = '';
}

async function criarNovoTipoIngresso() {
  const titulo = document.getElementById('novoTipoTitulo')?.value.trim();
  const tipoCategoria = document.getElementById('novoTipoCategoria')?.value.trim();
  const valor = parseFloat(document.getElementById('novoTipoValor')?.value) || 0;
  const quantidade_total = parseInt(document.getElementById('novoTipoTotal')?.value) || 0;

  if (!titulo) {
    showToast('Dê um nome para o novo tipo de ingresso.', 'error');
    return;
  }
  if (!_ticketModalEventoId) return;

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`${window.API_BASE}/ingressos/tipos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        evento_id: _ticketModalEventoId,
        titulo,
        tipo: tipoCategoria || null,
        valor,
        quantidade_total
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao criar tipo de ingresso.');

    showToast('Tipo de ingresso criado!', 'success');
    esconderFormNovoTipo();
    await carregarTiposIngressoModal(_ticketModalEventoId);
    carregarDashboard();
  } catch (e) {
    console.error('[criarNovoTipoIngresso] erro:', e);
    showToast('Não foi possível criar: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO DE VENDAS REAIS
// ─────────────────────────────────────────────
function iniciais(nome) {
  if (!nome) return '??';
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}

function criarLinhaVenda(venda) {
  const tr = document.createElement('tr');

const statusBackend = (venda.status || '').toLowerCase();
let statusExibicao, statusClasse, statusIcone;
if (statusBackend === 'aprovado') {
  statusExibicao = 'confirmado'; statusClasse = 'confirmed'; statusIcone = '●';
} else if (statusBackend === 'cortesia') {
  statusExibicao = 'cortesia'; statusClasse = 'courtesy'; statusIcone = '★';
} else {
  statusExibicao = 'pendente'; statusClasse = 'pending'; statusIcone = '○';
}

  tr.dataset.status = statusExibicao;
  tr.dataset.name = (venda.nome_comprador || '').toLowerCase();
  tr.dataset.event = (venda.nome_evento || '').toLowerCase();

  const dataFormatada = venda.criado_em
    ? new Date(venda.criado_em).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : '—';

  tr.innerHTML = `
    <td><span class="td-av">${iniciais(venda.nome_comprador)}</span> ${venda.nome_comprador || '—'}</td>
    <td>${venda.nome_evento || '—'}</td>
    <td>—</td>
    <td>${formatarMoeda(venda.valor_total)}</td>
    <td>${dataFormatada}</td>
    <td><span class="status-badge ${statusClasse}">${statusIcone} ${statusExibicao}</span></td>
  `;
  return tr;
}

function atualizarRodapeVendas(qtd, total) {
  const countEl = document.getElementById('tableCount');
  const totalEl = document.getElementById('tableTotal');
  if (countEl) countEl.textContent = qtd + ' transaç' + (qtd === 1 ? 'ão' : 'ões');
  if (totalEl) totalEl.textContent = 'R$ ' + total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function renderizarVendas(lista) {
  const tbody = document.getElementById('salesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!lista || lista.length === 0) {
    atualizarRodapeVendas(0, 0);
    return;
  }

  let total = 0;
  lista.forEach(venda => {
    tbody.appendChild(criarLinhaVenda(venda));
    total += parseFloat(venda.valor_total) || 0;
  });

  atualizarRodapeVendas(lista.length, total);
}

// Painel "Vendas Recentes" da Visão Geral
function renderizarVendasRecentes(vendas) {
  const feed = document.getElementById('salesFeedRecent');
  if (!feed) return;

  feed.innerHTML = '';

  const recentes = [...(vendas || [])]
    .filter(v => v.criado_em)
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, 5);

  if (recentes.length === 0) {
    feed.innerHTML = `<p style="font-size:13px; color:var(--text-3);">Nenhuma venda registrada ainda.</p>`;
    return;
  }

  recentes.forEach(v => {
    const aprovado = (v.status || '').toLowerCase() === 'aprovado';
    const row = document.createElement('div');
    row.className = 'sf-row';
    row.innerHTML = `
      <div class="sf-av">${iniciais(v.nome_comprador)}</div>
      <div class="sf-info">
        <span>${v.nome_comprador || '—'}</span>
        <small>${v.nome_evento || '—'}</small>
      </div>
      <div class="sf-right">
        <strong>${formatarMoeda(v.valor_total)}</strong>
        <span class="chip ${aprovado ? 'chip--green' : 'chip--orange'}">${aprovado ? 'Pago' : 'Pendente'}</span>
      </div>
    `;
    feed.appendChild(row);
  });
}

// ─────────────────────────────────────────────
// FILTRO DA TABELA DE VENDAS
// ─────────────────────────────────────────────
function filterSales() {
  const query = (document.getElementById('salesSearch')?.value || '').toLowerCase();
  const status = (document.getElementById('statusFilter')?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#salesTableBody tr');

  let visible = 0;
  let totalVal = 0;

  rows.forEach(row => {
    const matchQuery = !query || (row.dataset.name || '').includes(query) || (row.dataset.event || '').includes(query);
    const matchStatus = !status || (row.dataset.status || '') === status;

    if (matchQuery && matchStatus) {
      row.style.display = '';
      visible++;
      const valCell = row.querySelectorAll('td')[3]?.innerText || '';
      const num = parseFloat(valCell.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      totalVal += num;
    } else {
      row.style.display = 'none';
    }
  });

  const countEl = document.getElementById('tableCount');
  const totalEl = document.getElementById('tableTotal');
  if (countEl) countEl.textContent = visible + ' transaç' + (visible === 1 ? 'ão' : 'ões');
  if (totalEl) totalEl.textContent = 'R$ ' + totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// ─────────────────────────────────────────────
// FILTROS E BUSCA — EVENTOS E ESTABELECIMENTOS
// ─────────────────────────────────────────────
function filterEventos() {
  const query = (document.getElementById('eventosSearch')?.value || '').toLowerCase();
  const status = (document.getElementById('eventosStatusFilter')?.value || '').toLowerCase();
  document.querySelectorAll('#eventos .ev-card').forEach(card => {
    const matchQuery = !query || (card.dataset.nome || '').includes(query);
    const matchStatus = !status || (card.dataset.status || '') === status;
    card.style.display = (matchQuery && matchStatus) ? '' : 'none';
  });
}

function filterEstabelecimentos() {
  const query = (document.getElementById('estabsSearch')?.value || '').toLowerCase();
  document.querySelectorAll('#estabelecimentos .ev-card').forEach(card => {
    const matchQuery = !query || (card.dataset.nome || '').includes(query);
    card.style.display = matchQuery ? '' : 'none';
  });
}

// ─────────────────────────────────────────────
// RENDERIZAÇÃO DE EVENTOS REAIS
// ─────────────────────────────────────────────
function formatarDataCurta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Bloco de imagem reaproveitado por evento e estabelecimento.
// Sem imagem cadastrada -> fundo com ícone, nunca imagem quebrada.
// Se a URL for relativa (/uploads/...), completa com API_BASE, já que
// o frontend roda em uma porta (Live Server) diferente do backend.
function _resolverUrlImagem(url) {
  if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${window.API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function _blocoImagem(url, iconePathSvg) {
  const urlFinal = _resolverUrlImagem(url);
  if (urlFinal) {
    return `<div class="ev-image" style="background-image:url('${urlFinal}')"></div>`;
  }
  return `
    <div class="ev-image ev-image--placeholder">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        ${iconePathSvg}
      </svg>
    </div>`;
}

function criarCardEvento(evento, vendidos) {
  const total = _ingressosPorEventoReais[evento.id] || 0;
  const disponiveis = Math.max(0, total - vendidos);
  const ocupacao = total > 0 ? Math.round((vendidos / total) * 100) : 0;
  const receita = (evento._receita || 0);

  const agora = new Date();
  const dataEvento = evento.data_inicio ? new Date(evento.data_inicio) : null;
  const status = dataEvento && dataEvento < agora ? 'encerrado' : 'ativo';

  const card = document.createElement('div');
  card.className = 'ev-card';
  card.dataset.id = evento.id;
  card.dataset.tipo = 'evento';
  card.dataset.nome = (evento.nome || '').toLowerCase();
  card.dataset.status = status;

  card.innerHTML = `
    ${_blocoImagem(evento.imagem, `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`)}
    <div class="ev-top">
      <div class="ev-info">
        <h3 class="ev-title">${evento.nome || 'Sem nome'}</h3>
        <span class="ev-chip ${status === 'ativo' ? 'ev-chip--on' : 'ev-chip--sched'}">${status}</span>
      </div>
      <div class="ev-revenue">${formatarMoeda(receita)}<br><small>receita</small></div>
    </div>
    <div class="ev-meta">
      <span class="ev-mi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>${evento.local_nome || evento.cidade || 'Local não informado'}
      </span>
      <span class="ev-mi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>${formatarDataCurta(evento.data_inicio)}
      </span>
      <span class="ev-mi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>${formatarHora(evento.data_inicio)}
      </span>
    </div>
    <div class="ev-stats">
      <div class="ev-stat"><h4>${vendidos}</h4><p>vendidos</p></div>
      <div class="ev-stat"><h4>${disponiveis}</h4><p>disponíveis</p></div>
      <div class="ev-stat"><h4>${ocupacao}%</h4><p>ocupação</p></div>
    </div>
    <div class="ev-prog">
      <div class="ev-bar"><div class="ev-fill" style="width:${ocupacao}%"></div></div>
      <p class="ev-bar-txt">${vendidos} / ${total} ingressos</p>
    </div>
    <div class="ev-actions">
      <button class="ev-btn ev-btn--purple">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>Editar
      </button>
      <button class="ev-btn ev-btn--gray" onclick="showSection('vendas', null)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>Relatório
      </button>
      <button class="ev-btn ev-btn--orange" onclick="openTicketModal(${evento.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2"/>
          <path d="M2 15v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/>
          <line x1="12" y1="5" x2="12" y2="19"/>
        </svg>Ingressos
      </button>
    </div>
  `;
  return card;
}

function renderizarEventos(lista, vendidosPorEvento) {
  const secao = document.getElementById('eventos');
  if (!secao) return;

  secao.querySelectorAll('.ev-card, .empty-state-box, .loading-placeholder').forEach(el => el.remove());

  if (!lista || lista.length === 0) {
    _eventosVazio = true;
    _mostrarVazio('eventos', 'eventos');
    return;
  }

  lista.forEach(evento => {
    const info = vendidosPorEvento[evento.id] || { qtd: 0, receita: 0 };
    evento._receita = info.receita;
    secao.appendChild(criarCardEvento(evento, info.qtd));
  });
}

// ─────────────────────────────────────────────
// PRÓXIMOS EVENTOS
// ─────────────────────────────────────────────
function renderizarProximosEventos(eventos, vendidosPorEvento, ingressosPorEvento) {
  const lista = document.querySelector('.upcoming-list');
  if (!lista) return;

  const agora = new Date();
  const proximos = eventos
    .filter(e => e.data_inicio && new Date(e.data_inicio) >= agora)
    .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
    .slice(0, 3);

  lista.innerHTML = '';

  if (proximos.length === 0) {
    lista.innerHTML = `<p style="font-size:13px; color:var(--text-3);">Nenhum evento agendado nos próximos dias.</p>`;
    return;
  }

  const nomesMeses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  proximos.forEach(evento => {
    const d = new Date(evento.data_inicio);
    const total = ingressosPorEvento[evento.id] || 0;
    const vendidos = (vendidosPorEvento[evento.id] && vendidosPorEvento[evento.id].qtd) || 0;
    const pct = total > 0 ? Math.round((vendidos / total) * 100) : 0;
    const cor = pct === 0 ? '#4A3B6E' : (pct >= 75 ? '#FFB627' : '#35D399');

    const item = document.createElement('div');
    item.className = 'upcoming-item';
    item.innerHTML = `
      <div class="up-date"><span>${d.getDate()}</span><small>${nomesMeses[d.getMonth()]}</small></div>
      <div class="up-info">
        <span>${evento.nome || 'Sem nome'}</span>
        <small>${evento.local_nome || evento.cidade || ''} · ${formatarHora(evento.data_inicio)}</small>
      </div>
      <div class="up-occ">
        <div class="occ-bar"><div style="width:${pct}%; background:${cor}"></div></div>
        <small ${pct === 0 ? 'class="occ-empty"' : ''}>${total === 0 ? 'Sem ingressos cadastrados' : (pct + '%')}</small>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ─────────────────────────────────────────────
// RECEITA POR LOCAL
// ─────────────────────────────────────────────
function renderizarReceitaPorLocal(eventos, vendasAprovadas) {
  const lista = document.querySelector('.perf-list');
  if (!lista) return;

  const eventoLocal = {};
  eventos.forEach(e => { eventoLocal[e.id] = e.local_nome || e.cidade || 'Local não informado'; });

  const porLocal = {};
  vendasAprovadas.forEach(v => {
    const local = eventoLocal[v.evento_id] || 'Local não informado';
    porLocal[local] = (porLocal[local] || 0) + (parseFloat(v.valor_total) || 0);
  });

  const ordenado = Object.entries(porLocal).sort((a, b) => b[1] - a[1]).slice(0, 5);

  lista.innerHTML = '';

  if (ordenado.length === 0) {
    lista.innerHTML = `<p style="font-size:13px; color:var(--text-3);">Nenhuma receita registrada ainda.</p>`;
    return;
  }

  const max = ordenado[0][1] || 1;
  const cores = ['#FFB627', '#FFCE73', '#FF8A3D', '#35D399', '#6AA9FF'];

  ordenado.forEach(([nome, valor], i) => {
    const pct = Math.round((valor / max) * 100);
    const row = document.createElement('div');
    row.className = 'perf-row';
    row.innerHTML = `
      <span class="perf-dot" style="background:${cores[i % cores.length]}"></span>
      <span class="perf-name">${nome}</span>
      <div class="perf-bar"><div style="width:${pct}%; background:${cores[i % cores.length]}"></div></div>
      <span class="perf-val">${formatarMoeda(valor)}</span>
    `;
    lista.appendChild(row);
  });
}

// ─────────────────────────────────────────────
// NOTIFICAÇÕES SIMULADAS A PARTIR DE VENDAS REAIS
// ─────────────────────────────────────────────
function tempoRelativo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Agora mesmo';
  if (min < 60) return `Há ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Há ${h} hora${h === 1 ? '' : 's'}`;
  const dias = Math.floor(h / 24);
  return `Há ${dias} dia${dias === 1 ? '' : 's'}`;
}

function renderizarNotificacoesReais(vendas) {
  const container = document.getElementById('notifList');
  if (!container) return;

  const ordenadas = [...vendas]
    .filter(v => v.criado_em)
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, 10);

  container.innerHTML = '';

  if (ordenadas.length === 0) {
    setUnreadCount(0);
    return;
  }

  const naoLidas = ordenadas.slice(0, 3);
  const anteriores = ordenadas.slice(3);

  const label1 = document.createElement('p');
  label1.className = 'notif-group-label';
  label1.textContent = 'Recentes · ' + naoLidas.length;
  container.appendChild(label1);

  naoLidas.forEach(v => container.appendChild(criarItemNotificacao(v, true)));

  if (anteriores.length > 0) {
    const label2 = document.createElement('p');
    label2.className = 'notif-group-label';
    label2.style.marginTop = '24px';
    label2.textContent = 'Anteriores';
    container.appendChild(label2);
    anteriores.forEach(v => container.appendChild(criarItemNotificacao(v, false)));
  }

  setUnreadCount(naoLidas.length);
  initNotifClicks();
}

function criarItemNotificacao(venda, novo) {
  const aprovado = (venda.status || '').toLowerCase() === 'aprovado';
  const div = document.createElement('div');
  div.className = 'notif-item' + (novo ? ' notif-unread' : '');
  div.dataset.cat = 'venda';
  div.innerHTML = `
    <div class="ni-icon ${aprovado ? 'ni-green' : 'ni-gray'}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2"/>
        <path d="M2 15v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/>
        <line x1="12" y1="5" x2="12" y2="19"/>
      </svg>
    </div>
    <div class="ni-body">
      <p class="ni-title">${aprovado ? 'Nova venda realizada' : 'Pagamento pendente'}</p>
      <p class="ni-desc">${venda.nome_comprador || 'Cliente'} — <strong>${venda.nome_evento || 'Evento'}</strong> · ${formatarMoeda(venda.valor_total)}</p>
      <span class="ni-time">${tempoRelativo(venda.criado_em)}</span>
    </div>
    ${novo ? '<span class="ni-new">Nova</span>' : ''}
  `;
  return div;
}

function filterNotif(btn, cat) {
  document.querySelectorAll('.nf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#notifList .notif-item').forEach(item => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
  });
}

function markAllRead() {
  document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
  document.querySelectorAll('.ni-new').forEach(el => el.remove());
  setUnreadCount(0);
  showToast('Todas as notificações foram marcadas como lidas.', 'success');
}

function initNotifClicks() {
  document.querySelectorAll('#notifList .notif-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      if (item.classList.contains('notif-unread')) {
        item.classList.remove('notif-unread');
        const tag = item.querySelector('.ni-new');
        if (tag) tag.remove();
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    });
  });
}

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE NOTIFICAÇÕES
// ─────────────────────────────────────────────
let unreadCount = 0;

function setUnreadCount(n) {
  unreadCount = Math.max(0, n);
  const badge = document.querySelector('.dnav-badge');
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
  }
  const banner = document.getElementById('alertBanner');
  if (banner) {
    if (unreadCount === 0) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
      const strong = banner.querySelector('strong');
      if (strong) strong.textContent = unreadCount + ' notificaç' + (unreadCount === 1 ? 'ão não lida' : 'ões não lidas');
    }
  }
}

// ─────────────────────────────────────────────
// LISTAS DE OPÇÕES — COPIADAS DIRETO DO CADASTRO
// (criareventos.js e criarEstabelecimentos.js)
// para manter os mesmos textos/valores usados na
// criação, evitando divergência entre cadastro e edição.
// ─────────────────────────────────────────────

// Copiado 1:1 de criareventos.js → categoriasPorAssunto
const CATEGORIAS_POR_ASSUNTO = {
  "Festa e Balada": ["Aniversário", "Formatura", "Open Bar", "Festa Universitária", "Baile", "After", "Happy Hour"],
  "Shows e Música": ["Sertanejo", "Funk", "Pagode", "Rock", "Eletrônica", "Rap / Trap", "DJ", "K-pop"],
  "Gastronomia": ["Festival gastronômico", "Rodízio", "Degustação", "Churrasco", "Food Truck"],
  "Esportes": ["Futebol", "Corrida", "Treino funcional", "Campeonato", "Torneio"],
  "Cultura e Arte": ["Teatro", "Cinema", "Exposição", "Stand-up", "Dança"],
  "Cursos e Workshops": ["Curso", "Workshop", "Palestra", "Oficina", "Mentoria"],
  "Infantil e Família": ["Festa infantil", "Parque", "Teatro infantil", "Brincadeiras"],
  "Tecnologia": ["Hackathon", "Meetup", "Conferência", "Workshop Tech"],
  "Religião e Espiritualidade": ["Culto", "Retiro", "Congresso", "Meditação"],
  "Networking e Negócios": ["Networking", "Palestra", "Summit", "Feira"],
  "Saúde e Bem-estar": ["Yoga", "Meditação", "Corrida", "Palestra de saúde"],
  "Festivais": ["Festival de música", "Festival gastronômico", "Festival cultural"],
};
const OPCOES_ASSUNTO_EVENTO = Object.keys(CATEGORIAS_POR_ASSUNTO);

// Copiado 1:1 de criarEstabelecimentos.js → especialidadesPorTipo
const ESPECIALIDADES_POR_TIPO = {
  "Restaurante": ["Brasileiro", "Italiano", "Árabe", "Japonês", "Chinês", "Mexicano", "Francês", "Vegetariano/Vegano", "Frutos do mar", "Fusion"],
  "Bar e Boteco": ["Petiscos", "Cervejas especiais", "Drinks e coquetéis", "Bar temático", "Esportivo"],
  "Café e Cafeteria": ["Café especial", "Brunch", "Torradas e pães", "Bolos e doces", "Vegano"],
  "Lanchonete e Fast Food": ["Hambúrguer", "Hot dog", "Batata frita", "Tacos", "Wraps"],
  "Pizzaria": ["Tradicional", "Gourmet", "Sem glúten", "Por metro", "Pizza no forno a lenha"],
  "Churrascaria": ["Rodízio", "À la carte", "Assado na brasa", "Costela"],
  "Doceria e Confeitaria": ["Bolos personalizados", "Brigadeiros", "Tortas", "Macarons", "Chocolates"],
  "Padaria": ["Pão artesanal", "Café da manhã", "Salgados", "Doces"],
  "Sorveteria": ["Sorvete artesanal", "Açaí", "Frozen", "Sorvete vegano"],
  "Sushi e Japonês": ["Sushi", "Temaki", "Ramen", "Udon", "Teppanyaki"],
  "Food Truck": ["Hambúrguer", "Tacos", "Churrasco", "Vegano", "Comida de rua"],
  "Hamburgueria": ["Smash burger", "Artesanal", "Vegano", "Gourmet"],
  // ⚠️ Aparecem em mapearCategoria() do cadastro mas sem lista própria
  // de especialidades ainda — confirme comigo se existem no <select id="tipo">
  // do HTML e o que faz sentido colocar aqui.
  "Bistrô": [],
  "Pub": [],
  "Enoteca": [],
};
const OPCOES_TIPO_ESTAB = Object.keys(ESPECIALIDADES_POR_TIPO);

// ⚠️ PENDENTE: não encontrei o <select id="faixa-preco"> no HTML de
// criarEstabelecimentos.html enviado até agora, só a validação no JS.
// Os values abaixo são um placeholder — ajuste para os values reais
// assim que tiver o HTML do step 1 do cadastro.
const OPCOES_FAIXA_PRECO = [
  { value: 'economico', label: '$ · Econômico' },
  { value: 'moderado',  label: '$$ · Moderado' },
  { value: 'alto',      label: '$$$ · Alto' },
  { value: 'premium',   label: '$$$$ · Premium' }
];

// Dias da semana usados pelo campo de horário de funcionamento
// estruturado (ver bloco "HORÁRIO DE FUNCIONAMENTO" abaixo).
const DIAS_SEMANA = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

// ─────────────────────────────────────────────
// MODAL DE EDIÇÃO COMPLETO (evento OU estabelecimento)
//
// PENDENTE DE BACKEND: a função salvarEdicao() abaixo já monta o
// FormData certo (com upload de imagem via Supabase Storage, se um
// arquivo novo for escolhido) e chama PUT em /eventos/:id ou
// /estabelecimentos/:id. Assim que vocês me passarem essas rotas,
// eu só confirmo/ajusto o nome exato dos campos do body — a UI e o
// fluxo já ficam prontos agora.
// ─────────────────────────────────────────────
let _editModalItem = null;
let _editModalTipo = null; // 'evento' | 'estabelecimento'
let _editModalNovoArquivoImagem = null;

function _campoTexto(label, id, valor, placeholder) {
  return `
    <div class="edit-field">
      <label>${label}</label>
      <input type="text" id="${id}" value="${valor != null ? valor : ''}" placeholder="${placeholder || ''}">
    </div>`;
}

function _campoTextarea(label, id, valor) {
  return `
    <div class="edit-field edit-field--full">
      <label>${label}</label>
      <textarea id="${id}" rows="3">${valor || ''}</textarea>
    </div>`;
}

function _campoData(label, id, valorISO) {
  const valor = valorISO ? _paraDatetimeLocal(valorISO) : '';
  return `
    <div class="edit-field">
      <label>${label}</label>
      <input type="datetime-local" id="${id}" value="${valor}">
    </div>`;
}
// Converte uma data vinda do banco (ex: "2026-10-31 20:00:00") para o
// formato que <input type="datetime-local"> espera (AAAA-MM-DDTHH:mm),
// SEM aplicar conversão de fuso horário (evita o bug de +3h do toISOString).
function _paraDatetimeLocal(valorISO) {
  const d = new Date(valorISO);
  const pad = n => String(n).padStart(2, '0');
  const ano = d.getFullYear();
  const mes = pad(d.getMonth() + 1);
  const dia = pad(d.getDate());
  const hora = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${ano}-${mes}-${dia}T${hora}:${min}`;
}


function _campoNumero(label, id, valor, min) {
  return `
    <div class="edit-field">
      <label>${label}</label>
      <input type="number" id="${id}" value="${valor != null ? valor : ''}" ${min != null ? `min="${min}"` : ''}>
    </div>`;
}

// Select "simples" — opções fixas, não dependem de outro campo
// (ex: assunto do evento, tipo do estabelecimento)
function _campoSelectSimples(label, id, valorAtual, opcoes) {
  const valoresConhecidos = opcoes.map(op => typeof op === 'string' ? op : op.value);

  // Se o valor salvo não bater com nenhuma opção da lista, mantém ele
  // como opção extra selecionada — assim a edição nunca "apaga" um
  // dado antigo que não está no padrão atual.
  const extra = (valorAtual && !valoresConhecidos.includes(valorAtual))
    ? `<option value="${valorAtual}" selected>${valorAtual} (atual)</option>`
    : '';

  const opts = opcoes.map(op => {
    const val = typeof op === 'string' ? op : op.value;
    const lbl = typeof op === 'string' ? op : op.label;
    const selecionado = valorAtual === val ? 'selected' : '';
    return `<option value="${val}" ${selecionado}>${lbl}</option>`;
  }).join('');

  return `
    <div class="edit-field">
      <label>${label}</label>
      <select id="${id}">
        <option value="">Selecione...</option>
        ${extra}
        ${opts}
      </select>
    </div>`;
}

// Select "dependente" — nasce só com o valor atual (se existir); as
// opções de verdade são preenchidas via JS depois que o modal entra
// no DOM, com base no que estiver selecionado no campo "pai"
// (assunto → categoria | tipo → especialidade)
function _campoSelectDependente(label, id, valorAtual) {
  const atual = valorAtual
    ? `<option value="${valorAtual}" selected>${valorAtual}</option>`
    : '<option value="">Selecione o campo anterior primeiro</option>';
  return `
    <div class="edit-field">
      <label>${label}</label>
      <select id="${id}">${atual}</select>
    </div>`;
}

// Popula um <select> dependente com uma nova lista de opções,
// preservando o valor atual quando ele ainda existir na lista nova.
function _popularDependente(selectEl, opcoes, valorAtual) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Selecione...</option>';
  opcoes.forEach(op => {
    const opt = document.createElement('option');
    opt.textContent = op;
    if (op === valorAtual) opt.selected = true;
    selectEl.appendChild(opt);
  });
  // Se o valor salvo não existir mais na lista nova, mantém como opção extra
  if (valorAtual && !opcoes.includes(valorAtual)) {
    const opt = document.createElement('option');
    opt.value = valorAtual;
    opt.textContent = valorAtual + ' (atual)';
    opt.selected = true;
    selectEl.insertBefore(opt, selectEl.firstChild.nextSibling);
  }
}

// ─────────────────────────────────────────────
// HORÁRIO DE FUNCIONAMENTO (estabelecimento)
//
// A coluna `horario` no banco continua sendo TEXT — não mexemos no
// schema. O que muda é o "conteúdo": em vez de texto livre, salvamos
// uma string JSON com abre/fecha/fechado por dia da semana. Se o
// valor salvo já for um texto antigo (formato livre), ele é
// preservado como aviso e nunca apagado silenciosamente — o usuário
// só substitui ao configurar os dias e salvar.
// ─────────────────────────────────────────────
function _injectHorarioStyle() {
  if (document.getElementById('horarioStyle')) return;
  const s = document.createElement('style');
  s.id = 'horarioStyle';
  s.textContent = `
    .horario-grid { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
    .horario-row {
      display:grid; grid-template-columns:90px auto 1fr 12px 1fr; align-items:center; gap:10px;
      background:var(--card-alt); border:1px solid var(--border); border-radius:8px;
      padding:9px 12px;
    }
    .horario-row label.horario-dia { font-size:12px; font-weight:600; color:var(--text-2); }
    .horario-row .horario-fechado-wrap { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-3); white-space:nowrap; }
    .horario-row input[type="time"] {
      width:100%; padding:6px 8px; border:1px solid var(--border); border-radius:6px;
      background:var(--bg); color:var(--text); font-size:12px; font-family:var(--font-body);
    }
    .horario-row input[type="time"]:disabled { opacity:.4; }
    .horario-row .horario-sep { color:var(--text-4); font-size:11px; text-align:center; }
    .horario-legado-aviso {
      font-size:11.5px; color:var(--orange); background:#3A2712; border:1px solid #5A3A1E;
      border-radius:8px; padding:9px 12px; margin-bottom:10px; line-height:1.5;
    }
  `;
  document.head.appendChild(s);
}

// Tenta interpretar o valor salvo como JSON estruturado.
// Se for texto antigo (formato livre), devolve null + guarda o texto
// original pra mostrar como aviso, sem perder o dado.
function _parseHorarioSalvo(valor) {
  if (!valor) return { estruturado: null, legado: '' };
  try {
    const obj = JSON.parse(valor);
    if (obj && typeof obj === 'object') return { estruturado: obj, legado: '' };
  } catch { /* não é JSON — é texto legado */ }
  return { estruturado: null, legado: valor };
}

function _campoHorarioEstruturado(valorAtual) {
  const { estruturado, legado } = _parseHorarioSalvo(valorAtual);

  const avisoLegado = legado
    ? `<div class="horario-legado-aviso">⚠️ O horário salvo estava em formato livre: "<strong>${legado}</strong>". Configure abaixo dia a dia — ao salvar, isso substitui o texto antigo.</div>`
    : '';

  const linhas = DIAS_SEMANA.map(({ key, label }) => {
    const dia = (estruturado && estruturado[key]) || { abre: '', fecha: '', fechado: !estruturado };
    return `
      <div class="horario-row" data-dia="${key}">
        <label class="horario-dia">${label}</label>
        <span class="horario-fechado-wrap">
          <input type="checkbox" id="horario-fechado-${key}" ${dia.fechado ? 'checked' : ''}>
          Fechado
        </span>
        <input type="time" id="horario-abre-${key}" value="${dia.abre || ''}" ${dia.fechado ? 'disabled' : ''}>
        <span class="horario-sep">–</span>
        <input type="time" id="horario-fecha-${key}" value="${dia.fecha || ''}" ${dia.fechado ? 'disabled' : ''}>
      </div>`;
  }).join('');

  return `
    <div class="edit-field edit-field--full">
      <label>Horário de funcionamento</label>
      ${avisoLegado}
      <div class="horario-grid">${linhas}</div>
    </div>`;
}

// Liga os checkboxes "Fechado" pra desabilitar os inputs de hora do próprio dia
function _initHorarioToggles() {
  DIAS_SEMANA.forEach(({ key }) => {
    const chk = document.getElementById(`horario-fechado-${key}`);
    const abre = document.getElementById(`horario-abre-${key}`);
    const fecha = document.getElementById(`horario-fecha-${key}`);
    if (!chk || !abre || !fecha) return;
    chk.addEventListener('change', () => {
      abre.disabled = chk.checked;
      fecha.disabled = chk.checked;
    });
  });
}

// Lê os 7 dias do formulário e devolve como string JSON, pronta pra
// ir direto no campo `horario` (que continua sendo TEXT no banco).
function _lerHorarioDoFormulario() {
  const resultado = {};
  DIAS_SEMANA.forEach(({ key }) => {
    const fechado = document.getElementById(`horario-fechado-${key}`)?.checked ?? true;
    const abre = document.getElementById(`horario-abre-${key}`)?.value || '';
    const fecha = document.getElementById(`horario-fecha-${key}`)?.value || '';
    resultado[key] = { fechado, abre: fechado ? '' : abre, fecha: fechado ? '' : fecha };
  });
  return JSON.stringify(resultado);
}

function openEditModal(tipo, id) {
  const item = tipo === 'evento'
    ? _eventosReais.find(e => String(e.id) === String(id))
    : _estabsReais.find(e => String(e.id) === String(id));
  if (!item) return;

  _editModalItem = item;
  _editModalTipo = tipo;
  _editModalNovoArquivoImagem = null;

  const imagemAtual = tipo === 'evento' ? item.imagem : item.img_capa;

  let overlay = document.getElementById('editModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editModalOverlay';
    overlay.className = 'edit-ov';
    document.body.appendChild(overlay);
  }

  const camposHTML = tipo === 'evento' ? `
    <div class="edit-grid">
      ${_campoTexto('Nome do evento', 'edit-nome', item.nome)}
      ${_campoSelectSimples('Assunto', 'edit-assunto', item.assunto, OPCOES_ASSUNTO_EVENTO)}
      ${_campoSelectDependente('Categoria', 'edit-categoria', item.categoria)}
      ${_campoTexto('Nome do local', 'edit-local_nome', item.local_nome)}
      ${_campoTexto('Cidade', 'edit-cidade', item.cidade)}
      ${_campoTexto('Estado', 'edit-estado', item.estado)}
      ${_campoData('Início', 'edit-data_inicio', item.data_inicio)}
      ${_campoData('Fim', 'edit-data_fim', item.data_fim)}
    </div>
    ${_campoTextarea('Descrição', 'edit-descricao', item.descricao)}
  ` : `
    <div class="edit-grid">
      ${_campoTexto('Nome do estabelecimento', 'edit-nome', item.nome)}
      ${_campoSelectSimples('Tipo', 'edit-tipo', item.tipo, OPCOES_TIPO_ESTAB)}
      ${_campoSelectDependente('Especialidade', 'edit-especialidade', item.especialidade)}
      ${_campoSelectSimples('Faixa de preço', 'edit-faixa_preco', item.faixa_preco, OPCOES_FAIXA_PRECO)}
      ${_campoNumero('Capacidade', 'edit-capacidade', item.capacidade, 0)}
      ${_campoTexto('Cidade', 'edit-cidade', item.cidade)}
      ${_campoTexto('Telefone', 'edit-telefone', item.telefone)}
    </div>
    ${_campoHorarioEstruturado(item.horario)}
    ${_campoTextarea('Descrição', 'edit-descricao', item.descricao)}
  `;

  overlay.innerHTML = `
    <div class="edit-box">
      <div class="edit-head">
        <div>
          <h2>Editar ${tipo === 'evento' ? 'evento' : 'estabelecimento'}</h2>
          <p>${item.nome || ''}</p>
        </div>
        <button class="edit-close-btn" onclick="closeEditModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="edit-image-block">
        <label>Imagem de capa</label>
        <div class="edit-image-row">
          <div id="editImagemPreview" class="edit-image-preview" style="${_resolverUrlImagem(imagemAtual) ? `background-image:url('${_resolverUrlImagem(imagemAtual)}')` : ''}"></div>
          <div>
            <label class="edit-file-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Escolher arquivo
              <input type="file" id="editImagemInput" accept="image/*">
            </label>
            <p class="edit-file-hint">Enviada para o Supabase Storage ao salvar.</p>
          </div>
        </div>
      </div>

      ${camposHTML}

      <div class="edit-foot">
        <button class="edit-btn-cancel" onclick="closeEditModal()">Cancelar</button>
        <button class="edit-btn-save" onclick="salvarEdicao()">Salvar alterações</button>
      </div>
    </div>
  `;

  const inputImagem = document.getElementById('editImagemInput');
  if (inputImagem) {
    inputImagem.addEventListener('change', () => {
      const file = inputImagem.files[0];
      if (!file) return;
      _editModalNovoArquivoImagem = file;
      const preview = document.getElementById('editImagemPreview');
      if (preview) preview.style.backgroundImage = `url('${URL.createObjectURL(file)}')`;
    });
  }

  // ── Cascata entre selects dependentes (assunto→categoria | tipo→especialidade) ──
  if (tipo === 'evento') {
    const selAssunto = document.getElementById('edit-assunto');
    const selCategoria = document.getElementById('edit-categoria');
    if (selAssunto && selCategoria) {
      // popula a categoria já na abertura, com base no assunto atual salvo
      _popularDependente(selCategoria, CATEGORIAS_POR_ASSUNTO[item.assunto] || [], item.categoria);
      selAssunto.addEventListener('change', () => {
        _popularDependente(selCategoria, CATEGORIAS_POR_ASSUNTO[selAssunto.value] || [], null);
      });
    }
  } else {
    const selTipo = document.getElementById('edit-tipo');
    const selEspecialidade = document.getElementById('edit-especialidade');
    if (selTipo && selEspecialidade) {
      _popularDependente(selEspecialidade, ESPECIALIDADES_POR_TIPO[item.tipo] || [], item.especialidade);
      selTipo.addEventListener('change', () => {
        _popularDependente(selEspecialidade, ESPECIALIDADES_POR_TIPO[selTipo.value] || [], null);
      });
    }

    // Estilo e comportamento (fechado desativa os horários) do bloco de horário
    _injectHorarioStyle();
    _initHorarioToggles();
  }

  overlay.style.display = 'flex';
}

function closeEditModal() {
  const overlay = document.getElementById('editModalOverlay');
  if (overlay) overlay.style.display = 'none';
  _editModalItem = null;
  _editModalTipo = null;
  _editModalNovoArquivoImagem = null;
}

// ─────────────────────────────────────────────
// SALVAR EDIÇÃO — evento ou estabelecimento
//
// Correções aplicadas (evitando os dois bugs mapeados com o backend real):
//
// 1) Upload de imagem NUNCA mais viaja junto do PUT como multipart —
//    a rota PUT de estabelecimentos não tem multer no middleware, então
//    um FormData chegaria com req.body vazio e apagaria o registro.
//    Agora, se houver arquivo novo, ele sobe sozinho primeiro via
//    POST /upload-imagem (rota que já tem multer) e só a URL resultante
//    entra no PUT, que vai sempre como JSON puro.
//
// 2) O PUT do backend faz UPDATE de todas as colunas da tabela usando
//    o que vier em req.body — campos ausentes viram null. Por isso o
//    payload final é sempre { ..._editModalItem (dado completo do GET),
//    ...camposEditados (só o que mudou no formulário) }, garantindo que
//    nenhuma coluna fora do modal (cnpj, comodidades, cep, nome_produtor,
//    fotos_galeria, pratos, etc.) seja apagada.
// ─────────────────────────────────────────────
async function salvarEdicao() {
  if (!_editModalItem || !_editModalTipo) return;

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': 'Bearer ' + token };
  const base = _editModalTipo === 'evento' ? `${window.API_BASE}/eventos` : `${window.API_BASE}/estabelecimentos`;
  const campoImagem = _editModalTipo === 'evento' ? 'imagem' : 'img_capa';

  // Campos que NUNCA devem ser reenviados no PUT — ou porque são
  // calculados no frontend (não existem na tabela) ou porque
  // reenviar o id/criador_id pode confundir o WHERE da query do backend.
  const CAMPOS_PROIBIDOS = ['_receita', 'id', 'criador_id', 'criado_em', 'atualizado_em'];

  try {
    let novaUrlImagem = null;
    if (_editModalNovoArquivoImagem) {
      const fd = new FormData();
      fd.append('imagem', _editModalNovoArquivoImagem);
      const respUpload = await fetch(`${base}/upload-imagem`, { method: 'POST', headers, body: fd });
      const uploadTexto = await respUpload.text();
      console.log('[upload-imagem] status:', respUpload.status, 'resposta:', uploadTexto);
      if (!respUpload.ok) throw new Error('Falha ao enviar imagem: ' + uploadTexto);
      novaUrlImagem = JSON.parse(uploadTexto).url;
    }

    const camposComuns = { nome: 'edit-nome', descricao: 'edit-descricao', cidade: 'edit-cidade' };
    const camposEvento = { categoria: 'edit-categoria', assunto: 'edit-assunto', local_nome: 'edit-local_nome', estado: 'edit-estado', data_inicio: 'edit-data_inicio', data_fim: 'edit-data_fim' };
    const camposEstab = { tipo: 'edit-tipo', especialidade: 'edit-especialidade', faixa_preco: 'edit-faixa_preco', capacidade: 'edit-capacidade', telefone: 'edit-telefone' };
    const mapaCampos = { ...camposComuns, ...(_editModalTipo === 'evento' ? camposEvento : camposEstab) };

    const editados = {};
    Object.entries(mapaCampos).forEach(([chave, inputId]) => {
      const el = document.getElementById(inputId);
      if (el) editados[chave] = el.value;
    });

    if (_editModalTipo === 'estabelecimento') {
      editados.horario = _lerHorarioDoFormulario();
    }

    if (novaUrlImagem) {
      editados[campoImagem] = novaUrlImagem;
    }

    // Merge: item original + editado, mas removendo os campos proibidos
    const dados = { ..._editModalItem, ...editados };
    CAMPOS_PROIBIDOS.forEach(campo => delete dados[campo]);

    const url = `${base}/${_editModalItem.id}`;
    console.log('[salvarEdicao] PUT', url);
    console.log('[salvarEdicao] payload enviado:', JSON.stringify(dados, null, 2));

    const resposta = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    // Lê o corpo como texto SEMPRE, mesmo em erro — pra logar o que o backend realmente disse
    const textoResposta = await resposta.text();
    console.log('[salvarEdicao] status:', resposta.status, 'resposta do servidor:', textoResposta);

    if (!resposta.ok) {
      throw new Error(`Servidor respondeu ${resposta.status}: ${textoResposta}`);
    }

    // Tenta interpretar a resposta como JSON pra conferir se o backend
    // devolveu o registro atualizado (sinal forte de que salvou de verdade)
    let corpoJson = null;
    try { corpoJson = JSON.parse(textoResposta); } catch { /* resposta não é JSON, tudo bem */ }
    if (corpoJson) {
      console.log('[salvarEdicao] registro retornado pelo backend:', corpoJson);
    } else {
      console.warn('[salvarEdicao] backend respondeu 200 mas sem corpo/JSON — não dá pra confirmar se salvou de fato. Confira no banco.');
    }

    showToast('Alterações salvas com sucesso!', 'success');
    closeEditModal();
    carregarDashboard();
  } catch (erro) {
    console.error('[salvarEdicao] ERRO:', erro);
    showToast('Não foi possível salvar: ' + erro.message, 'error');
  }
}
// ─────────────────────────────────────────────
// SISTEMA DE TOAST (feedback visual)
// ─────────────────────────────────────────────
function showToast(msg, tipo) {
  document.querySelectorAll('.dash-toast').forEach(t => t.remove());

  const colors = { success: '#35D399', error: '#FF5C7A', info: '#FFB627', warn: '#FF8A3D' };
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };

  const toast = document.createElement('div');
  toast.className = 'dash-toast';
  toast.style.cssText = `
    position:fixed; bottom:28px; right:28px; z-index:99999;
    background:#1C1834; color:#F1EDFA; padding:14px 20px;
    border-radius:10px; font-family:'Inter',sans-serif; font-size:13px; font-weight:500;
    display:flex; align-items:center; gap:10px;
    border:1px solid #322850;
    box-shadow:0 8px 24px rgba(0,0,0,.4);
    animation:toastIn .25s ease; max-width:360px; line-height:1.4;
  `;

  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-flex; align-items:center; justify-content:center;
    width:22px; height:22px; border-radius:50%; background:${colors[tipo] || colors.info}; color:#160f28;
    font-size:12px; font-weight:700; flex-shrink:0;`;
  dot.textContent = icons[tipo] || 'ℹ';

  toast.appendChild(dot);
  toast.appendChild(document.createTextNode(msg));
  document.body.appendChild(toast);

  if (!document.getElementById('toastStyle')) {
    const s = document.createElement('style');
    s.id = 'toastStyle';
    s.textContent = `
      @keyframes toastIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      @keyframes toastOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(12px)} }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut .25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// ─────────────────────────────────────────────
// FECHAR MODAIS COM ESC
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeTicketModal();
    closeEditModal();
  }
});

document.addEventListener('click', e => {
  const modalOv = document.getElementById('ticketModal');
  if (e.target === modalOv) closeTicketModal();
  const editOv = document.getElementById('editModalOverlay');
  if (e.target === editOv) closeEditModal();
});

// ─────────────────────────────────────────────
// BOTÕES DE EDITAR (delegação de eventos)
// ─────────────────────────────────────────────
function initEditButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.ev-btn--purple');
    if (!btn) return;
    const card = btn.closest('.ev-card');
    if (!card) return;
    const tipo = card.dataset.tipo; // 'evento' | 'estabelecimento'
    const id = card.dataset.id;
    if (!tipo || !id) return;
    openEditModal(tipo, id);
  });
}

// ─────────────────────────────────────────────
// EXPORTAÇÃO EXCEL
// ─────────────────────────────────────────────
function initExport() {
  const btn = document.getElementById('btnExport');
  if (!btn) return;

  btn.addEventListener('click', e => {
    e.preventDefault();
    const wb = XLSX.utils.book_new();

    const resumo = [
      { Indicador: 'Total de Vendas', Valor: document.getElementById('total-vendas')?.innerText || '' },
      { Indicador: 'Eventos Ativos', Valor: document.getElementById('eventos-ativos')?.innerText || '' },
      { Indicador: 'Ticket Médio', Valor: document.getElementById('ticket-medio')?.innerText || '' },
      { Indicador: 'Taxa de Ocupação', Valor: document.getElementById('taxa-ocupacao')?.innerText || '' },
      { Indicador: 'Avaliação Média', Valor: document.getElementById('avaliacao-media')?.innerText || '' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');

    const vendas = [];
    document.querySelectorAll('#salesTableBody tr').forEach(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length < 6) return;
      vendas.push({
        Cliente: cols[0]?.innerText.trim() || '',
        Evento: cols[1]?.innerText || '',
        Quantidade: cols[2]?.innerText || '',
        Total: cols[3]?.innerText || '',
        Data: cols[4]?.innerText || '',
        Status: cols[5]?.innerText.trim() || ''
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendas), 'Histórico de Vendas');

    const info = [{ Informação: 'Relatório gerado em', Valor: new Date().toLocaleString('pt-BR') }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), 'Informações');

    XLSX.writeFile(wb, 'relatorio_dashboard_completo.xlsx');
    showToast('Relatório exportado com sucesso!', 'success');
  });
}

// ─────────────────────────────────────────────
// BOTÕES DE NAVEGAÇÃO (Criar Evento / Novo Estabelecimento)
// ─────────────────────────────────────────────
function initNavButtons() {
  const PATHS = {
    criarEvento: '/frontend/criareventos/criareventos.html',
    criarEstabelecimento: '/frontend/criarEstabelecimentos/criarEstabelecimentos.html',
  };

  const setupClickEvents = (selector) => {
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => {
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('evento')) {
        btn.addEventListener('click', () => { window.location.href = PATHS.criarEvento; });
      } else if (txt.includes('estabelecimento')) {
        btn.addEventListener('click', () => { window.location.href = PATHS.criarEstabelecimento; });
      }
    });
  };

  setupClickEvents('.btn-quick');
  setupClickEvents('.btn-create');
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initExport();
  initNavButtons();
  initEditButtons();

  carregarDashboard();
});

// ─────────────────────────────────────────────
// RENDERIZAÇÃO DE ESTABELECIMENTOS REAIS
// ─────────────────────────────────────────────

function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function criarCardEstabelecimento(estab) {
  const nome = estab.nome || 'Sem nome';
  const nota = estab.nota != null ? Number(estab.nota).toFixed(1) : '—';
  const avaliacoes = estab.avaliacoes || 0;
  const capacidade = estab.capacidade || '—';
  const enderecoTxt = [estab.rua, estab.numero, estab.bairro, estab.cidade]
    .filter(Boolean).join(', ') || estab.endereco || 'Endereço não informado';
  const aberto = estab.visibilidade !== 'oculto';

  const card = document.createElement('div');
  card.className = 'ev-card';
  card.dataset.id = estab.id;
  card.dataset.tipo = 'estabelecimento';
  card.dataset.nome = (estab.nome || '').toLowerCase();

  card.innerHTML = `
    ${_blocoImagem(estab.img_capa, `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`)}
    <div class="ev-top">
      <div class="ev-info">
        <h3 class="ev-title">${nome}</h3>
        <span class="ev-chip ${aberto ? 'ev-chip--on' : 'ev-chip--sched'}">${aberto ? 'aberto' : 'oculto'}</span>
      </div>
    </div>
    <div class="ev-meta">
      <span class="ev-mi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>${enderecoTxt}
      </span>
      <span class="ev-mi">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>${nota} · ${avaliacoes} avaliações
      </span>
      ${estab.tipo ? `<span class="ev-mi">${estab.tipo}${estab.especialidade ? ' · ' + estab.especialidade : ''}</span>` : ''}
    </div>
    <div class="ev-stats">
      <div class="ev-stat"><h4>${nota} ⭐</h4><p>avaliação</p></div>
      <div class="ev-stat"><h4>${avaliacoes}</h4><p>avaliações</p></div>
      <div class="ev-stat"><h4>${capacidade}</h4><p>capacidade</p></div>
    </div>
    <div class="ev-actions">
      <button class="ev-btn ev-btn--purple">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>Editar
      </button>
      <button class="ev-btn" onclick="window.location.href='/frontend/eventos/VerPerfil.html?id=${estab.id}'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>Visualizar
      </button>
      <button class="ev-btn ev-btn--gray" onclick="showSection('vendas', null)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>Relatório
      </button>
    </div>
  `;
  return card;
}

function renderizarEstabelecimentos(lista) {
  const secao = document.getElementById('estabelecimentos');
  if (!secao) return;

  secao.querySelectorAll('.ev-card, .empty-state-box, .loading-placeholder').forEach(el => el.remove());

  if (!lista || lista.length === 0) {
    _estabelecimentosVazio = true;
    _mostrarVazio('estabelecimentos', 'estabelecimentos');
    return;
  }

  lista.forEach(estab => {
    secao.appendChild(criarCardEstabelecimento(estab));
  });
}