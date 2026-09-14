'use strict';

// ─────────────────────────────────────────────
// FLAG GLOBAL DE ESTADOS VAZIOS
// ─────────────────────────────────────────────
let _dashboardVazio       = false;
let _estabelecimentosVazio = false;
let _eventosVazio          = false;
let _vendasVazio           = false;
let _notificacoesVazio     = false;

// ─────────────────────────────────────────────
// ESTADOS VAZIOS DO DASHBOARD
// ─────────────────────────────────────────────
async function verificarEstadosVazios() {
    const userId = localStorage.getItem('userId');
    const token  = localStorage.getItem('token');
    if (!userId || !token) {
        _mostrarVazioTodos();
        return;
    }

    const headers = { 'Authorization': 'Bearer ' + token };

    try {
        const [resEventos, resEstabs] = await Promise.all([
            fetch(`/eventos?criador_id=${userId}`, { headers }),
            fetch(`${API_URL}/estabelecimentos/meus`, { headers })  
        ]);

        const eventos = resEventos.ok ? await resEventos.json() : [];
        const estabs  = resEstabs.ok  ? await resEstabs.json()  : [];

        const qtdEventos = Array.isArray(eventos) ? eventos.length : (eventos.data?.length || 0);
        const qtdEstabs  = Array.isArray(estabs)  ? estabs.length  : (estabs.data?.length  || 0);

        // Visão Geral — vazio se não tiver nenhum dos dois
        if (qtdEventos === 0 && qtdEstabs === 0) {
            _dashboardVazio = true;
            _mostrarVazio('dashboard', 'visao-geral');
            document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row').forEach(el => el.style.display = 'none');
            const banner = document.getElementById('alertBanner');
            if (banner) banner.style.display = 'none';
        }

        // Estabelecimentos — vazio se não tiver nenhum
        if (qtdEstabs === 0) {
            _estabelecimentosVazio = true;
            _mostrarVazio('estabelecimentos', 'estabelecimentos');
            document.querySelectorAll('#estabelecimentos .ev-card').forEach(el => el.style.display = 'none');
        }

        // Eventos — vazio se não tiver nenhum
        if (qtdEventos === 0) {
            _eventosVazio = true;
            _mostrarVazio('eventos', 'eventos');
            document.querySelectorAll('#eventos .ev-card').forEach(el => el.style.display = 'none');
        }

        // Vendas — vazio se não tiver nenhum evento (sem evento = sem venda)
        if (qtdEventos === 0 && qtdEstabs === 0) {
            _vendasVazio = true;
            _mostrarVazio('vendas', 'vendas');
            const tableWrap = document.querySelector('#vendas .table-wrap');
            if (tableWrap) tableWrap.style.display = 'none';
        }

        // Notificações — vazio se não tiver nenhum dos dois
        if (qtdEventos === 0 && qtdEstabs === 0) {
            _notificacoesVazio = true;
            _mostrarVazio('notificacoes', 'notificacoes');
            document.querySelector('#notifList')?.querySelectorAll('.notif-item, .notif-group-label').forEach(el => el.style.display = 'none');
        }

    } catch (e) {
        console.warn('Erro ao verificar estados vazios:', e);
        _mostrarVazioTodos();
    }
}

// Mostra estado vazio em todas as abas (fallback de erro de rede)
function _mostrarVazioTodos() {
    _dashboardVazio        = true;
    _estabelecimentosVazio = true;
    _eventosVazio          = true;
    _vendasVazio           = true;
    _notificacoesVazio     = true;

    ['dashboard', 'estabelecimentos', 'eventos', 'vendas', 'notificacoes'].forEach(id => {
        _mostrarVazio(id, id);
    });
    document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row, .table-wrap, #notifList').forEach(el => el.style.display = 'none');
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

    const cfg = _configVazio[tipo] || _configVazio['visao-geral'];

    // Monta os botões
    let botoesHTML = '';
    if (cfg.botoes) {
        botoesHTML = `
            <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:center;">
                <a href="/frontend/criareventos/criareventos.html" style="
                    display:inline-flex; align-items:center; gap:8px;
                    background:linear-gradient(135deg,#a78bfa,#7c3aed);
                    color:#fff; text-decoration:none;
                    padding:12px 24px; border-radius:10px;
                    font-family:'Poppins',sans-serif; font-size:14px; font-weight:600;
                    box-shadow:0 4px 14px rgba(124,58,237,0.3);"
                    onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Criar evento
                </a>
                <a href="/frontend/criarEstabelecimentos/criarEstabelecimentos.html" style="
                    display:inline-flex; align-items:center; gap:8px;
                    background:#fff; color:#7c3aed; text-decoration:none;
                    padding:12px 24px; border-radius:10px;
                    border:1.5px solid #7c3aed;
                    font-family:'Poppins',sans-serif; font-size:14px; font-weight:600;"
                    onmouseover="this.style.background='#f5f0ff'" onmouseout="this.style.background='#fff'">
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
                background:linear-gradient(135deg,#a78bfa,#7c3aed);
                color:#fff; text-decoration:none;
                padding:12px 28px; border-radius:10px;
                font-family:'Poppins',sans-serif; font-size:14px; font-weight:600;
                box-shadow:0 4px 14px rgba(124,58,237,0.3);"
                onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                ${cfg.botaoUnico.label}
            </a>`;
    }

    const vazio = document.createElement('div');
    vazio.className = 'empty-state-box';
    vazio.style.cssText = `
        display:flex; flex-direction:column; align-items:center;
        justify-content:center; padding:80px 24px; text-align:center;
    `;
    vazio.innerHTML = `
        <div style="
            width:80px; height:80px; border-radius:50%;
            background:#f5f0ff; display:flex; align-items:center;
            justify-content:center; margin-bottom:24px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8">
                ${cfg.icone}
            </svg>
        </div>
        <h2 style="font-family:'Poppins',sans-serif; font-size:22px; font-weight:700;
                   color:#111827; margin:0 0 8px;">${cfg.titulo}</h2>
        <p style="font-family:'Poppins',sans-serif; font-size:14px; color:#6b7280;
                  max-width:420px; line-height:1.7; margin:0 0 40px;">${cfg.descricao}</p>
        ${botoesHTML}
    `;

    secao.appendChild(vazio);
}

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE NOTIFICAÇÕES
// ─────────────────────────────────────────────
let unreadCount = 3;

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
  const groupLabel = document.querySelector('#notifList .notif-group-label');
  if (groupLabel) {
    groupLabel.textContent = 'Não lidas · ' + unreadCount;
  }
}

// ─────────────────────────────────────────────
// INSTÂNCIAS DOS GRÁFICOS
// ─────────────────────────────────────────────
let salesChartInst  = null;
let ratingChartInst = null;

const chartData = {
  '6m': { labels: ['Mai','Jun','Jul','Ago','Set','Out'], data: [8200,11500,15800,22400,31000,45780] },
  '3m': { labels: ['Ago','Set','Out'],                  data: [22400,31000,45780] },
  '1m': { labels: ['S1','S2','S3','S4'],                data: [8900,12400,14200,10280] }
};
let currentPeriod = '6m';

const eventosData = {
  labels:      ['Live Jazz Night','Festival Eletrônico','Happy Hour'],
  vendidos:    [156, 186, 0],
  disponiveis: [44,  114, 100]
};

// ─────────────────────────────────────────────
// CRIAR / RECRIAR GRÁFICOS
// ─────────────────────────────────────────────
function criarGraficos() {
  const salesCanvas  = document.getElementById('salesChart');
  const ratingCanvas = document.getElementById('ratingChart');
  if (!salesCanvas || !ratingCanvas) return;

  if (salesChartInst)  { salesChartInst.destroy();  salesChartInst  = null; }
  if (ratingChartInst) { ratingChartInst.destroy(); ratingChartInst = null; }

  const periodo = chartData[currentPeriod];

  salesChartInst = new Chart(salesCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: periodo.labels,
      datasets: [{
        label: 'Receita (R$)',
        data: periodo.data,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.45,
        pointBackgroundColor: '#7c3aed',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          titleFont: { family:'Poppins', size:12 },
          bodyFont:  { family:'Poppins', size:13 },
          padding: 12, cornerRadius: 8, displayColors: false,
          callbacks: {
            title: items => 'Mês: ' + items[0].label,
            label: ctx  => ' R$ ' + ctx.parsed.y.toLocaleString('pt-BR')
          }
        }
      },
      scales: {
        x: { grid:{display:false}, ticks:{font:{family:'Poppins',size:11},color:'#9ca3af'} },
        y: { grid:{color:'#f3f4f6'}, ticks:{font:{family:'Poppins',size:11},color:'#9ca3af',callback:v=>'R$ '+(v/1000).toFixed(0)+'k'} }
      }
    }
  });

  ratingChartInst = new Chart(ratingCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: eventosData.labels,
      datasets: [
        { label:'Vendidos',    data:eventosData.vendidos,    backgroundColor:'#7c3aed', borderRadius:6, barPercentage:0.6 },
        { label:'Disponíveis', data:eventosData.disponiveis, backgroundColor:'#e9e9ea', borderRadius:6, barPercentage:0.6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: {
          display: true, position:'bottom',
          labels: { usePointStyle:true, pointStyle:'circle', font:{family:'Poppins',size:12}, color:'#6b7280', padding:20 }
        },
        tooltip: { backgroundColor:'#111827', titleFont:{family:'Poppins',size:12}, bodyFont:{family:'Poppins',size:13}, padding:12, cornerRadius:8 }
      },
      scales: {
        x: { grid:{display:false}, ticks:{font:{family:'Poppins',size:11},color:'#9ca3af'} },
        y: { grid:{color:'#f3f4f6'}, min:0, ticks:{font:{family:'Poppins',size:11},color:'#9ca3af',stepSize:50} }
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
  salesChartInst.data.labels           = d.labels;
  salesChartInst.data.datasets[0].data = d.data;
  salesChartInst.update('active');
}

// ─────────────────────────────────────────────
// NAVEGAÇÃO ENTRE SEÇÕES
// BUG FIX: ao voltar para dashboard, restaura corretamente
// o estado vazio (se aplicável) sem duplicar elementos,
// e só recria gráficos quando há dados para exibir.
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
      // ── ESTADO VAZIO: garante que os elementos continuam ocultos
      // e que o empty-state-box não seja inserido duplicado
      document.querySelectorAll('.kpi-grid, .charts-row, .bottom-row').forEach(el => el.style.display = 'none');
      const banner = document.getElementById('alertBanner');
      if (banner) banner.style.display = 'none';
      // Só insere o empty-state-box se ainda não existir
      if (!document.querySelector('#dashboard .empty-state-box')) {
        _mostrarVazio('dashboard', 'visao-geral');
      }
    } else {
      // ── COM DADOS: aguarda o DOM pintar antes de recriar os gráficos
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { criarGraficos(); });
      });
    }
  }

  // Restaura estado vazio nas outras abas ao navegar de volta
  if (sectionId === 'estabelecimentos' && _estabelecimentosVazio) {
    document.querySelectorAll('#estabelecimentos .ev-card').forEach(el => el.style.display = 'none');
    if (!document.querySelector('#estabelecimentos .empty-state-box')) {
      _mostrarVazio('estabelecimentos', 'estabelecimentos');
    }
  }

  if (sectionId === 'eventos' && _eventosVazio) {
    document.querySelectorAll('#eventos .ev-card').forEach(el => el.style.display = 'none');
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
    document.querySelector('#notifList')?.querySelectorAll('.notif-item, .notif-group-label').forEach(el => el.style.display = 'none');
    if (!document.querySelector('#notificacoes .empty-state-box')) {
      _mostrarVazio('notificacoes', 'notificacoes');
    }
  }
}

// ─────────────────────────────────────────────
// MODAL DE INGRESSOS
// ─────────────────────────────────────────────
function openTicketModal() {
  const m = document.getElementById('ticketModal');
  if (m) m.style.display = 'flex';
}
function closeTicketModal() {
  const m = document.getElementById('ticketModal');
  if (m) m.style.display = 'none';
}
function initTicketInput() {
  const total = document.getElementById('totalTickets');
  const avail = document.getElementById('availableTickets');
  if (!total || !avail) return;
  const sold = 156;
  total.addEventListener('input', () => {
    avail.value = Math.max(0, (parseInt(total.value) || 0) - sold);
  });
}

// ─────────────────────────────────────────────
// FILTRO DA TABELA DE VENDAS
// ─────────────────────────────────────────────
function filterSales() {
  const query  = (document.getElementById('salesSearch')?.value  || '').toLowerCase();
  const status = (document.getElementById('statusFilter')?.value || '').toLowerCase();
  const rows   = document.querySelectorAll('#salesTableBody tr');

  let visible = 0;
  let totalVal = 0;

  rows.forEach(row => {
    const matchQuery  = !query  || (row.dataset.name  || '').includes(query) || (row.dataset.event || '').includes(query);
    const matchStatus = !status || (row.dataset.status || '') === status;

    if (matchQuery && matchStatus) {
      row.style.display = '';
      visible++;
      const valCell = row.querySelectorAll('td')[3]?.innerText || '';
      const num = parseFloat(valCell.replace(/[^\d,]/g,'').replace(',','.')) || 0;
      totalVal += num;
    } else {
      row.style.display = 'none';
    }
  });

  const countEl = document.getElementById('tableCount');
  const totalEl = document.getElementById('tableTotal');
  if (countEl) countEl.textContent = visible + ' transaç' + (visible === 1 ? 'ão' : 'ões');
  if (totalEl) totalEl.textContent = 'R$ ' + totalVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
}

// ─────────────────────────────────────────────
// FILTRO DE NOTIFICAÇÕES
// ─────────────────────────────────────────────
function filterNotif(btn, cat) {
  document.querySelectorAll('.nf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#notifList .notif-item').forEach(item => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
  });
}

// ─────────────────────────────────────────────
// MARCAR TODAS COMO LIDAS
// ─────────────────────────────────────────────
function markAllRead() {
  document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
  document.querySelectorAll('.ni-new').forEach(el => el.remove());
  setUnreadCount(0);
  showToast('Todas as notificações foram marcadas como lidas.', 'success');
}

// ─────────────────────────────────────────────
// NOTIFICAÇÕES INDIVIDUAIS CLICÁVEIS
// ─────────────────────────────────────────────
function initNotifClicks() {
  document.querySelectorAll('#notifList .notif-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      if (item.classList.contains('notif-unread')) {
        item.classList.remove('notif-unread');
        const tag = item.querySelector('.ni-new');
        if (tag) tag.remove();
        setUnreadCount(unreadCount - 1);
        if (unreadCount === 0) {
          showToast('Todas as notificações foram lidas!', 'success');
        }
      }
    });
  });
}

// ─────────────────────────────────────────────
// MODAL DE EDIÇÃO GENÉRICO
// ─────────────────────────────────────────────
function openEditModal(tipo, nome) {
  let overlay = document.getElementById('editModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editModalOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.5);
      display:flex; justify-content:center; align-items:center; z-index:9999;
    `;
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:16px; padding:32px; width:480px; max-width:94vw;
                box-shadow:0 20px 60px rgba(0,0,0,.2); font-family:'Poppins',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h2 style="font-size:18px; font-weight:700; margin:0;">Editar ${tipo}</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0;">${nome}</p>
        </div>
        <button onclick="closeEditModal()" style="background:#f3f4f6; border:none; width:32px; height:32px;
          border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">✕</button>
      </div>
      <div style="background:#f5f0ff; border:1px solid #e9d5ff; border-left:4px solid #7c3aed;
                  border-radius:8px; padding:14px 16px; margin-bottom:24px;
                  font-size:13px; color:#374151; line-height:1.6;">
        <strong style="color:#7c3aed;">📋 Funcionalidade em implementação</strong><br>
        A edição completa de ${tipo.toLowerCase()}s será conectada ao banco de dados na próxima sprint.
        Por enquanto você pode ajustar os campos abaixo (simulação local).
      </div>
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; display:block; margin-bottom:6px;">
            Nome do ${tipo}
          </label>
          <input type="text" value="${nome}" style="width:100%; padding:10px 14px; border:1px solid #e5e7eb;
            border-radius:8px; font-size:14px; font-family:'Poppins',sans-serif; outline:none; box-sizing:border-box;"
            onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'">
        </div>
        <div>
          <label style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; display:block; margin-bottom:6px;">
            Status
          </label>
          <select style="width:100%; padding:10px 14px; border:1px solid #e5e7eb; border-radius:8px;
            font-size:14px; font-family:'Poppins',sans-serif; outline:none; background:#fff; box-sizing:border-box;">
            <option>Ativo / Aberto</option>
            <option>Agendado</option>
            <option>Pausado</option>
            <option>Encerrado</option>
          </select>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
        <button onclick="closeEditModal()" style="background:#f3f4f6; color:#374151; border:none;
          padding:10px 22px; border-radius:8px; font-size:13px; font-weight:600;
          font-family:'Poppins',sans-serif; cursor:pointer;">Cancelar</button>
        <button onclick="saveEditModal('${nome}')" style="background:linear-gradient(135deg,#a78bfa,#7c3aed); color:#fff; border:none;
          padding:10px 22px; border-radius:8px; font-size:13px; font-weight:600;
          font-family:'Poppins',sans-serif; cursor:pointer;">Salvar alterações</button>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
}

function closeEditModal() {
  const overlay = document.getElementById('editModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function saveEditModal(nome) {
  closeEditModal();
  showToast('"' + nome + '" atualizado com sucesso! (simulação local)', 'success');
}

// ─────────────────────────────────────────────
// SISTEMA DE TOAST (feedback visual)
// ─────────────────────────────────────────────
function showToast(msg, tipo) {
  document.querySelectorAll('.dash-toast').forEach(t => t.remove());

  const colors = { success:'#16a34a', error:'#ef4444', info:'#7c3aed', warn:'#f59e0b' };
  const icons  = { success:'✓', error:'✕', info:'ℹ', warn:'⚠' };

  const toast = document.createElement('div');
  toast.className = 'dash-toast';
  toast.style.cssText = `
    position:fixed; bottom:28px; right:28px; z-index:99999;
    background:#111827; color:#fff; padding:14px 20px;
    border-radius:10px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:500;
    display:flex; align-items:center; gap:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.25);
    animation:toastIn .25s ease; max-width:360px; line-height:1.4;
  `;

  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-flex; align-items:center; justify-content:center;
    width:22px; height:22px; border-radius:50%; background:${colors[tipo]||colors.info};
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

// Fechar modal clicando no overlay
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
    const titulo = card.querySelector('.ev-title')?.textContent?.trim() || 'Item';
    const secao = card.closest('#eventos') ? 'Evento' : 'Estabelecimento';
    openEditModal(secao, titulo);
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
      { Indicador:'Total de Vendas',   Valor: document.getElementById('total-vendas')?.innerText    || '' },
      { Indicador:'Visualizações',     Valor: document.getElementById('eventos-ativos')?.innerText  || '' },
      { Indicador:'Avaliação Média',   Valor: document.getElementById('avaliacao-media')?.innerText || '' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');

    const vendas = [];
    document.querySelectorAll('#salesTableBody tr').forEach(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length < 6) return;
      vendas.push({
        Cliente:    cols[0]?.innerText.trim() || '',
        Evento:     cols[1]?.innerText || '',
        Quantidade: cols[2]?.innerText || '',
        Total:      cols[3]?.innerText || '',
        Data:       cols[4]?.innerText || '',
        Status:     cols[5]?.innerText.trim() || ''
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendas), 'Histórico de Vendas');

    const info = [{ Informação:'Relatório gerado em', Valor: new Date().toLocaleString('pt-BR') }];
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
// BOTÃO SALVAR INGRESSOS no modal
// ─────────────────────────────────────────────
function initSaveTickets() {
  const btn = document.querySelector('.btn-save-m');
  if (!btn) return;
  btn.addEventListener('click', () => {
    closeTicketModal();
    showToast('Quantidade de ingressos atualizada com sucesso!', 'success');
  });
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    criarGraficos();
    initTicketInput();
    initExport();
    initNavButtons();
    initEditButtons();
    initNotifClicks();
    initSaveTickets();
    setUnreadCount(3);

    verificarEstadosVazios();
});