/**
 * Cliente da fila de espera — Rolês  (colocar em /frontend/js/filaEspera.js)
 *
 * Uso:
 *   FilaEspera.entrar(eventoId, () => { window.location.href = '/frontend/detalheseventos/finalizarcompra.html'; });
 *
 * - Se há vaga, chama o callback na hora. Se não, mostra a tela da fila com a
 *   SENHA da pessoa, a posição e o tempo estimado.
 * - Sair/fechar a página NÃO tira ninguém da fila. A senha fica salva no
 *   navegador (localStorage); ao voltar e clicar em "Comprar", a pessoa
 *   continua na mesma posição. Também dá para digitar a senha manualmente.
 * - Só sai da fila quem clicar em "Sair da fila" (ou ficar ausente além do
 *   prazo definido no servidor).
 */
(function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const BASE = typeof API_BASE !== 'undefined' ? API_BASE : (isLocal ? 'http://localhost:3000' : window.location.origin);
  const INTERVALO_MS = 2000;

  let timer = null;
  let overlay = null;

  const chave = (id) => `filaTicket_${id}`;
  const guardar = (id, t) => { try { localStorage.setItem(chave(id), t); } catch (_) {} };
  const lembrar = (id) => { try { return localStorage.getItem(chave(id)); } catch (_) { return null; } };
  const esquecer = (id) => { try { localStorage.removeItem(chave(id)); } catch (_) {} };

  const formatarSenha = (t) => (t && t.length === 8 ? `${t.slice(0, 4)}-${t.slice(4)}` : (t || '—'));

  function injetarEstilo() {
    if (document.getElementById('fila-estilo')) return;
    const s = document.createElement('style');
    s.id = 'fila-estilo';
    s.textContent = `
      .fila-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(13,12,20,.92);font-family:'Inter',sans-serif;overflow:auto}
      .fila-caixa{box-sizing:border-box;width:100%;max-width:440px;background:#fff;border-radius:20px;padding:30px 28px;text-align:center;color:#14121f}
      .fila-rotulo{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#6c2bd9}
      .fila-caixa h2{margin:8px 0 6px;font-size:22px;font-weight:800}
      .fila-caixa p{margin:0;font-size:14px;color:#55506b;line-height:1.6}
      .fila-senha{margin:18px 0 4px;padding:12px;overflow:hidden;box-sizing:border-box;border:2px dashed #a78bfa;border-radius:14px;background:#f7f5fd}
      .fila-senha small{display:block;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6c2bd9}
      .fila-senha strong{display:block;max-width:100%;font-size:clamp(20px,6vw,30px);letter-spacing:2px;font-weight:800;color:#2e1065;margin-top:2px;overflow-wrap:anywhere;word-break:break-all;line-height:1.25}
      .fila-senha button{margin-top:6px;background:none;border:none;color:#6c2bd9;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
      .fila-dica{font-size:12.5px;color:#55506b;margin:8px 0 0}
      .fila-posicao{margin:16px 0 4px;font-size:56px;font-weight:800;line-height:1;color:#2e1065;letter-spacing:-2px}
      .fila-sub{font-size:13px;color:#94909f}
      .fila-barra{height:8px;border-radius:99px;background:#ede9fe;margin:18px 0 14px;overflow:hidden}
      .fila-barra>span{display:block;height:100%;width:0;background:#6c2bd9;border-radius:99px;transition:width .6s ease}
      .fila-aviso{font-size:12.5px;background:#f7f5fd;border-radius:10px;padding:10px 12px;margin-bottom:16px}
      .fila-acoes{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
      .fila-btn{background:none;border:1px solid #e9e7f0;border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#14121f}
      .fila-btn:hover{background:#f7f5fd}
      .fila-btn.fila-btn-p{background:#0d0c14;color:#fff;border-color:#0d0c14}
      .fila-ja{margin-top:14px;font-size:12.5px}
      .fila-ja a{color:#6c2bd9;font-weight:700;cursor:pointer;text-decoration:underline}
      .fila-ja-form{display:none;margin-top:10px;gap:8px;justify-content:center}
      .fila-ja-form input{width:150px;padding:9px 10px;border:1px solid #d8d5e6;border-radius:10px;font:inherit;font-size:14px;text-transform:uppercase;text-align:center;letter-spacing:1px}
      .fila-erro{color:#991b1b;font-size:12.5px;font-weight:600;margin-top:8px;min-height:16px}`;
    document.head.appendChild(s);
  }

  function formatarTempo(seg) {
    if (seg < 60) return 'menos de 1 minuto';
    const m = Math.round(seg / 60);
    return `cerca de ${m} minuto${m > 1 ? 's' : ''}`;
  }

  function mostrarOverlay(eventoId, onLiberado) {
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
        <p>Estamos liberando a compra por ordem de chegada.</p>

        <div class="fila-senha">
          <small>Sua senha</small>
          <strong id="fila-senha">—</strong>
          <button type="button" id="fila-copiar">Copiar senha</button>
        </div>
        <p class="fila-dica" id="fila-dica">Você pode fechar esta página: seu lugar fica guardado. Para voltar, abra o evento e clique em comprar, ou use a senha.</p>

        <div class="fila-posicao" id="fila-posicao">—</div>
        <div class="fila-sub" id="fila-sub">Calculando sua posição...</div>
        <div class="fila-barra"><span id="fila-progresso"></span></div>
        <div class="fila-aviso" id="fila-estimativa">Tempo estimado: —</div>

        <div class="fila-acoes">
          <button type="button" class="fila-btn" id="fila-minimizar">Fechar e voltar depois</button>
          <button type="button" class="fila-btn" id="fila-sair">Sair da fila</button>
        </div>

        <div class="fila-ja">Já tem uma senha? <a id="fila-ja-link">Usar minha senha</a></div>
        <div class="fila-ja-form" id="fila-ja-form">
          <input id="fila-ja-input" maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" />
          <button type="button" class="fila-btn fila-btn-p" id="fila-ja-ok">Entrar</button>
        </div>
        <div class="fila-erro" id="fila-erro"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelector('#fila-sair').addEventListener('click', () => {
      if (confirm('Se sair, você perde o seu lugar na fila. Deseja sair mesmo?')) sair(eventoId);
    });
    overlay.querySelector('#fila-minimizar').addEventListener('click', () => {
      // Só esconde a tela; a senha continua valendo no servidor.
      clearInterval(timer);
      fecharOverlay();
    });
    overlay.querySelector('#fila-copiar').addEventListener('click', () => {
      const t = lembrar(eventoId);
      if (t && navigator.clipboard) navigator.clipboard.writeText(formatarSenha(t));
      overlay.querySelector('#fila-copiar').textContent = 'Senha copiada!';
    });
    overlay.querySelector('#fila-ja-link').addEventListener('click', () => {
      overlay.querySelector('#fila-ja-form').style.display = 'flex';
      overlay.querySelector('#fila-ja-input').focus();
    });
    overlay.querySelector('#fila-ja-ok').addEventListener('click', async () => {
      const digitada = overlay.querySelector('#fila-ja-input').value;
      const msg = overlay.querySelector('#fila-erro');
      msg.textContent = '';
      try {
        const r = await fetch(`${BASE}/fila/status/${encodeURIComponent(eventoId)}/${encodeURIComponent(digitada)}`);
        const st = await r.json();
        if (st.estado === 'expirado') { msg.textContent = 'Senha não encontrada ou expirada.'; return; }
        // troca a senha nova pela digitada (descarta a recém-criada)
        const atual = lembrar(eventoId);
        if (atual && atual !== st.ticket) post('/fila/sair', { evento_id: eventoId, ticket: atual }).catch(() => {});
        guardar(eventoId, st.ticket);
        clearInterval(timer);
        fecharOverlay();
        entrar(eventoId, onLiberado);
      } catch (_) { msg.textContent = 'Não foi possível verificar a senha. Tente de novo.'; }
    });
  }

  function fecharOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.body.style.overflow = '';
  }

  function atualizarOverlay(st, posicaoInicial) {
    if (!overlay) return;
    overlay.querySelector('#fila-senha').textContent = formatarSenha(st.ticket);
    overlay.querySelector('#fila-posicao').textContent = st.posicao;
    overlay.querySelector('#fila-sub').textContent = `de ${st.totalNaFila} pessoas na fila`;
    overlay.querySelector('#fila-estimativa').textContent = `Tempo estimado: ${formatarTempo(st.estimativaSeg)}`;
    if (st.guardadoPorMin) {
      overlay.querySelector('#fila-dica').textContent =
        `Você pode fechar esta página: seu lugar fica guardado por ${st.guardadoPorMin} min. Para voltar, abra o evento e clique em comprar, ou use a senha.`;
    }
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
    let st;
    try {
      // Se já existe uma senha guardada, o servidor devolve o mesmo lugar na fila
      st = await post('/fila/entrar', { evento_id: eventoId, ticket: lembrar(eventoId) });
    } catch (_) {
      // Se a fila estiver fora do ar, não bloqueia a compra
      console.warn('[FilaEspera] backend da fila indisponível (rotas /fila não encontradas?). Liberando a compra sem fila.');
      onLiberado();
      return;
    }
    guardar(eventoId, st.ticket);

    if (st.estado === 'ativo') { onLiberado(); return; }

    mostrarOverlay(eventoId, onLiberado);
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
          esquecer(eventoId);
          fecharOverlay();
          entrar(eventoId, onLiberado); // perdeu o lugar: volta ao fim da fila
        } else {
          atualizarOverlay(novo, posicaoInicial);
        }
      } catch (_) { /* tenta de novo no próximo ciclo */ }
    }, INTERVALO_MS);
  }

  /** Saída explícita: libera o lugar para os próximos. */
  function sair(eventoId) {
    const ticket = lembrar(eventoId);
    clearInterval(timer);
    fecharOverlay();
    if (ticket) {
      esquecer(eventoId);
      post('/fila/sair', { evento_id: eventoId, ticket }).catch(() => {});
    }
  }

  // Importante: NÃO existe saída automática ao fechar a página (pagehide/beforeunload).
  // A senha continua valendo no servidor até a pessoa sair de propósito ou o prazo acabar.

  window.FilaEspera = {
    entrar,
    sair,
    ticket: lembrar,
    headers: (eventoId) => ({ 'X-Fila-Ticket': lembrar(eventoId) || '' })
  };
})();