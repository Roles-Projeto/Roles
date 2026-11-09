/**
 * Cliente da fila de espera — Rolês  (colocar em /frontend/js/filaEspera.js)
 *
 * Uso:
 *   FilaEspera.entrar(eventoId, () => { window.location.href = '/frontend/detalheseventos/finalizarcompra.html'; });
 *
 * Se há vaga, chama o callback na hora. Se não, mostra a tela de fila com
 * posição e tempo estimado, e chama o callback quando chegar a vez.
 * O ticket fica em sessionStorage e é enviado ao backend no header X-Fila-Ticket.
 */
(function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const BASE = typeof API_BASE !== 'undefined' ? API_BASE : (isLocal ? 'http://localhost:3000' : window.location.origin);
  const INTERVALO_MS = 2000;

  let timer = null;
  let overlay = null;

  const chave = (id) => `filaTicket_${id}`;

  function injetarEstilo() {
    if (document.getElementById('fila-estilo')) return;
    const s = document.createElement('style');
    s.id = 'fila-estilo';
    s.textContent = `
      .fila-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(13,12,20,.92);font-family:'Inter',sans-serif}
      .fila-caixa{width:100%;max-width:440px;background:#fff;border-radius:20px;padding:32px 28px;text-align:center;color:#14121f}
      .fila-rotulo{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#6c2bd9}
      .fila-caixa h2{margin:8px 0 6px;font-size:22px;font-weight:800}
      .fila-caixa p{margin:0;font-size:14px;color:#55506b;line-height:1.6}
      .fila-posicao{margin:22px 0 6px;font-size:64px;font-weight:800;line-height:1;color:#2e1065;letter-spacing:-2px}
      .fila-sub{font-size:13px;color:#94909f}
      .fila-barra{height:8px;border-radius:99px;background:#ede9fe;margin:22px 0 18px;overflow:hidden}
      .fila-barra>span{display:block;height:100%;width:0;background:#6c2bd9;border-radius:99px;transition:width .6s ease}
      .fila-aviso{font-size:12.5px;background:#f7f5fd;border-radius:10px;padding:10px 12px;margin-bottom:18px}
      .fila-sair{background:none;border:1px solid #e9e7f0;border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#14121f}
      .fila-sair:hover{background:#f7f5fd}`;
    document.head.appendChild(s);
  }

  function formatarTempo(seg) {
    if (seg < 60) return 'menos de 1 minuto';
    const m = Math.round(seg / 60);
    return `cerca de ${m} minuto${m > 1 ? 's' : ''}`;
  }

  function mostrarOverlay(eventoId) {
    injetarEstilo();
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'fila-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="fila-caixa">
        <span class="fila-rotulo">Fila de espera</span>
        <h2>Muita gente comprando agora</h2>
        <p>Para garantir que tudo funcione bem, estamos liberando a compra por ordem de chegada. Não feche esta página.</p>
        <div class="fila-posicao" id="fila-posicao">—</div>
        <div class="fila-sub" id="fila-sub">Calculando sua posição...</div>
        <div class="fila-barra"><span id="fila-progresso"></span></div>
        <div class="fila-aviso" id="fila-estimativa">Tempo estimado: —</div>
        <button type="button" class="fila-sair" id="fila-sair">Sair da fila</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    overlay.querySelector('#fila-sair').addEventListener('click', () => sair(eventoId));
  }

  function fecharOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.body.style.overflow = '';
  }

  function atualizarOverlay(st, posicaoInicial) {
    if (!overlay) return;
    overlay.querySelector('#fila-posicao').textContent = st.posicao;
    overlay.querySelector('#fila-sub').textContent = `de ${st.totalNaFila} pessoas na fila`;
    overlay.querySelector('#fila-estimativa').textContent = `Tempo estimado: ${formatarTempo(st.estimativaSeg)}`;
    const inicio = Math.max(posicaoInicial, st.posicao);
    const pct = inicio > 1 ? ((inicio - st.posicao) / (inicio - 1)) * 100 : 0;
    overlay.querySelector('#fila-progresso').style.width = Math.max(4, pct) + '%';
  }

  async function post(path, corpo) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    return res.json();
  }

  async function entrar(eventoId, onLiberado) {
    const anterior = sessionStorage.getItem(chave(eventoId));
    let st;
    try {
      st = await post('/fila/entrar', { evento_id: eventoId, ticket: anterior });
    } catch (_) {
      // Se a fila estiver fora do ar, não bloqueia a compra
      console.warn('[FilaEspera] backend da fila indisponível (rotas /fila não encontradas?). Liberando a compra sem fila.');
      onLiberado();
      return;
    }
    sessionStorage.setItem(chave(eventoId), st.ticket);

    if (st.estado === 'ativo') { onLiberado(); return; }

    mostrarOverlay(eventoId);
    const posicaoInicial = st.posicao || 1;
    atualizarOverlay(st, posicaoInicial);

    clearInterval(timer);
    timer = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/fila/status/${encodeURIComponent(eventoId)}/${st.ticket}`);
        const novo = await r.json();
        if (novo.estado === 'ativo') {
          clearInterval(timer);
          fecharOverlay();
          onLiberado();
        } else if (novo.estado === 'expirado') {
          clearInterval(timer);
          sessionStorage.removeItem(chave(eventoId));
          fecharOverlay();
          entrar(eventoId, onLiberado); // perdeu o lugar: volta ao fim da fila
        } else {
          atualizarOverlay(novo, posicaoInicial);
        }
      } catch (_) { /* tenta de novo no próximo ciclo */ }
    }, INTERVALO_MS);
  }

  function sair(eventoId) {
    const ticket = sessionStorage.getItem(chave(eventoId));
    clearInterval(timer);
    fecharOverlay();
    if (ticket) {
      sessionStorage.removeItem(chave(eventoId));
      post('/fila/sair', { evento_id: eventoId, ticket }).catch(() => {});
    }
  }

  window.addEventListener('pagehide', () => {
    // fechou a aba enquanto esperava: libera o lugar
    if (!overlay) return;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('filaTicket_')) {
        const eventoId = k.replace('filaTicket_', '');
        navigator.sendBeacon(`${BASE}/fila/sair`,
          new Blob([JSON.stringify({ evento_id: eventoId, ticket: sessionStorage.getItem(k) })], { type: 'application/json' }));
      }
    }
  });

  window.FilaEspera = {
    entrar,
    sair,
    ticket: (eventoId) => sessionStorage.getItem(chave(eventoId)),
    headers: (eventoId) => ({ 'X-Fila-Ticket': sessionStorage.getItem(chave(eventoId)) || '' })
  };
})();