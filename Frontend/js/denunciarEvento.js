/* ============================================================
   denunciarEvento.js
   Botão "Denunciar evento" (detalheevento.html)
   Envia POST /denuncias  -> mesma tabela e mesmo e-mail dos locais.
   Arquivo independente: cria o próprio modal e o próprio CSS
   (classes com prefixo "dnc-" para não colidir com o denuncia.css).
   ============================================================ */
(function () {
  'use strict';

  // Evita rodar duas vezes se o script for carregado por mais de um lugar
  if (window.__denunciaEventoCarregado) return;
  window.__denunciaEventoCarregado = true;

  function iniciar() {

    const eventoId = new URLSearchParams(window.location.search).get('id');

    // Usa o API_BASE do config.js; se ele não carregou, cai no mesmo domínio da página
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const API_BASE = window.API_BASE || (isLocal ? 'http://localhost:3000' : window.location.origin);
    const ENDPOINT = API_BASE + '/denuncias';

    /* ---------- CSS ---------- */
    const css = `
    body.dnc-aberta{overflow:hidden}
    .dnc-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,10,45,.55);backdrop-filter:blur(3px);font-family:'Inter',sans-serif}
    .dnc-overlay[hidden]{display:none}
    .dnc-modal{position:relative;width:100%;max-width:480px;max-height:calc(100vh - 40px);overflow-y:auto;background:#fff;border-radius:20px;padding:28px 28px 24px;box-shadow:0 16px 56px rgba(60,30,140,.18);color:#1e1b2e;font-size:14px;line-height:1.5}
    .dnc-fechar{position:absolute;top:14px;right:14px;width:32px;height:32px;border:0;border-radius:50%;background:#f7f6fb;color:#4b4660;font-size:16px;cursor:pointer}
    .dnc-fechar:hover{background:#ede9fe;color:#5b21b6}
    .dnc-cab{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-right:28px}
    .dnc-icone{flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:#7c3aed;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center}
    .dnc-cab h3{margin:0;font-size:18px}
    .dnc-cab p{margin:2px 0 0;font-size:12.5px;color:#9ca3af}
    .dnc-motivos{border:0;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:8px}
    .dnc-motivos legend{font-size:13px;font-weight:700;margin-bottom:10px;padding:0}
    .dnc-opcao{display:flex;align-items:center;gap:10px;padding:11px 14px;border:1.5px solid #e5e2f0;border-radius:10px;font-size:13px;font-weight:500;color:#4b4660;cursor:pointer}
    .dnc-opcao:hover{border-color:#a78bfa;background:#f5f3ff}
    .dnc-opcao input{accent-color:#7c3aed;width:16px;height:16px;margin:0;flex-shrink:0}
    .dnc-opcao.dnc-marcada{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6;font-weight:600}
    .dnc-label{display:block;font-size:13px;font-weight:700;margin-bottom:8px}
    .dnc-label span{font-weight:500;color:#9ca3af}
    .dnc-modal textarea{width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid #e5e2f0;border-radius:10px;font:inherit;font-size:13px;resize:vertical;outline:none}
    .dnc-modal textarea:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.1)}
    .dnc-contador{text-align:right;font-size:11px;color:#9ca3af;margin-top:4px}
    .dnc-erro{margin:12px 0 0;padding:10px 14px;border-radius:10px;background:#fef2f2;border:1.5px solid #fecaca;color:#b91c1c;font-size:12.5px;font-weight:600}
    .dnc-erro[hidden]{display:none}
    .dnc-acoes{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
    .dnc-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
    .dnc-cancelar{background:#fff;color:#4b4660;border:1.5px solid #e5e2f0}
    .dnc-cancelar:hover{background:#f7f6fb}
    .dnc-enviar{background:linear-gradient(135deg,#4c1d95,#7c3aed);color:#fff;border:0;box-shadow:0 4px 14px rgba(91,33,182,.28)}
    .dnc-enviar:disabled{opacity:.7;cursor:not-allowed}
    .dnc-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(120px);background:#1e1b2e;color:#fff;padding:12px 26px;border-radius:99px;font:600 13px 'Inter',sans-serif;transition:transform .3s;z-index:100001;pointer-events:none;white-space:nowrap}
    @media (max-width:480px){.dnc-modal{padding:22px 18px 18px}.dnc-acoes{flex-direction:column-reverse}.dnc-btn{width:100%;justify-content:center}.dnc-toast{white-space:normal;width:calc(100% - 32px);text-align:center;border-radius:16px}}
    `;
    const estilo = document.createElement('style');
    estilo.textContent = css;
    document.head.appendChild(estilo);

    /* ---------- Modal ---------- */
    const overlay = document.createElement('div');
    overlay.className = 'dnc-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="dnc-modal" role="dialog" aria-modal="true" aria-labelledby="dnc-titulo">
        <button type="button" class="dnc-fechar" id="dnc-fechar" aria-label="Fechar">&times;</button>
        <div class="dnc-cab">
          <div class="dnc-icone"><i class="fa-regular fa-flag"></i></div>
          <div>
            <h3 id="dnc-titulo">Denunciar evento</h3>
            <p id="dnc-nome">Conte o que está errado com este evento.</p>
          </div>
        </div>
        <form id="dnc-form" novalidate>
          <fieldset class="dnc-motivos">
            <legend>Qual é o problema?</legend>
            <label class="dnc-opcao"><input type="radio" name="dnc-motivo" value="informacoes_incorretas"><span>Informações incorretas (data, local, preço)</span></label>
            <label class="dnc-opcao"><input type="radio" name="dnc-motivo" value="evento_cancelado"><span>Evento cancelado ou que não vai acontecer</span></label>
            <label class="dnc-opcao"><input type="radio" name="dnc-motivo" value="conteudo_improprio"><span>Imagem ou conteúdo impróprio</span></label>
            <label class="dnc-opcao"><input type="radio" name="dnc-motivo" value="golpe_fraude"><span>Golpe ou fraude</span></label>
            <label class="dnc-opcao"><input type="radio" name="dnc-motivo" value="outro"><span>Outro motivo</span></label>
          </fieldset>
          <label class="dnc-label" for="dnc-desc">Detalhes <span>(opcional)</span></label>
          <textarea id="dnc-desc" rows="4" maxlength="500" placeholder="Descreva o que aconteceu para nos ajudar a analisar."></textarea>
          <div class="dnc-contador"><span id="dnc-cont">0</span>/500</div>
          <p class="dnc-erro" id="dnc-erro" role="alert" hidden></p>
          <div class="dnc-acoes">
            <button type="button" class="dnc-btn dnc-cancelar" id="dnc-cancelar">Cancelar</button>
            <button type="submit" class="dnc-btn dnc-enviar" id="dnc-enviar"><i class="fas fa-paper-plane"></i> Enviar denúncia</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    const toast = document.createElement('div');
    toast.className = 'dnc-toast';
    document.body.appendChild(toast);

    const $ = (id) => document.getElementById(id);
    const form = $('dnc-form'), erroEl = $('dnc-erro'), desc = $('dnc-desc');
    const btnEnviar = $('dnc-enviar'), btnFechar = $('dnc-fechar'), btnCancelar = $('dnc-cancelar');
    let enviando = false;
    let timerToast = null;

    function mostrarToast(msg) {
      toast.textContent = msg;
      toast.style.transform = 'translateX(-50%) translateY(0)';
      clearTimeout(timerToast);
      timerToast = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(120px)';
      }, 3500);
    }
    const mostrarErro = (m) => { erroEl.textContent = m; erroEl.hidden = false; };
    const limparErro = () => { erroEl.hidden = true; erroEl.textContent = ''; };

    // Destaque da opção marcada (sem depender de :has(), que não existe em navegadores mais antigos)
    function atualizarDestaque() {
      form.querySelectorAll('.dnc-opcao').forEach((lab) => {
        const input = lab.querySelector('input');
        lab.classList.toggle('dnc-marcada', !!(input && input.checked));
      });
    }
    form.addEventListener('change', atualizarDestaque);

    // Lê o payload do JWT (base64url -> base64) sem quebrar com "-" e "_"
    function lerPayloadToken(token) {
      try {
        let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
      } catch (err) {
        return null;
      }
    }

    function abrir() {
      const nome = document.querySelector('.titulo-evento')?.textContent?.trim();
      if (nome && !/^carregando|^erro ao carregar|^evento não encontrado/i.test(nome)) {
        $('dnc-nome').textContent = 'Evento: ' + nome;
      }
      overlay.hidden = false;
      document.body.classList.add('dnc-aberta');
      form.querySelector('input[name="dnc-motivo"]')?.focus();
    }
    function fechar() {
      overlay.hidden = true;
      document.body.classList.remove('dnc-aberta');
      form.reset();
      atualizarDestaque();
      $('dnc-cont').textContent = '0';
      limparErro();
    }

    btnFechar.addEventListener('click', fechar);
    btnCancelar.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) fechar(); });
    desc.addEventListener('input', () => { $('dnc-cont').textContent = String(desc.value.length); });

    /* ---------- Envio ---------- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (enviando) return;
      limparErro();

      const motivo = form.querySelector('input[name="dnc-motivo"]:checked')?.value;
      if (!motivo) return mostrarErro('Selecione o motivo da denúncia.');
      if (!eventoId || isNaN(Number(eventoId))) return mostrarErro('Não foi possível identificar o evento.');

      const token = localStorage.getItem('token');
      if (!token || localStorage.getItem('userIsLoggedIn') !== 'true') {
        return mostrarErro('Você precisa estar logado para denunciar.');
      }
      const payload = lerPayloadToken(token);
      if (payload && payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return mostrarErro('Sua sessão expirou. Saia e faça login novamente.');
      }

      enviando = true;
      btnEnviar.disabled = true;
      const textoOriginal = btnEnviar.innerHTML;
      btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

      try {
        const resp = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            tipo: 'evento',
            alvo_id: Number(eventoId),
            motivo,
            descricao: desc.value.trim()
          })
        });

        // Qualquer 2xx (200, 201...) conta como sucesso
        if (!resp.ok) {
          const texto = await resp.text();
          let dados = {};
          try { dados = JSON.parse(texto); } catch (err) { /* não era JSON */ }
          console.error('[denúncia evento] falhou:', resp.status, texto.slice(0, 300));
          if (resp.status === 401) return mostrarErro('Você precisa estar logado para denunciar.');
          const msg = dados.erro || dados.message || dados.mensagem || dados.error;
          return mostrarErro((msg || 'Não foi possível enviar.') + ' (código ' + resp.status + ')');
        }

        fechar();
        mostrarToast('Denúncia enviada. Obrigado por ajudar!');
      } catch (err) {
        console.error('Erro ao enviar denúncia:', err);
        mostrarErro('Erro de conexão. Tente novamente.');
      } finally {
        enviando = false;
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = textoOriginal;
      }
    });

    /* ---------- Botão "Denunciar evento" ----------
       Escuta o clique no documento inteiro, em fase de captura. Assim funciona mesmo que o
       botão seja recriado por outro script, e bloqueia qualquer clique antigo (denuncia.js)
       que ainda esteja ligado nele. */
    document.addEventListener('click', (e) => {
      const alvo = e.target.closest && e.target.closest('#btn-denunciar-evento');
      if (!alvo) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      abrir();
    }, true);

    console.log('[denúncia evento] script carregado | id do evento =', eventoId, '| endpoint =', ENDPOINT);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();