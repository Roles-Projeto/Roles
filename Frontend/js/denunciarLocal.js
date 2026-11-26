/* ============================================================
   denunciarLocal.js
   Botão "Denunciar local" + modal (detalheslocais.html)
   Envia POST /denuncias  (backend/routes/denuncias.js)
   ============================================================ */
(function () {
  'use strict';

  const btnAbrir   = document.getElementById('btn-denunciar-local');
  const overlay    = document.getElementById('denuncia-overlay');
  const form       = document.getElementById('form-denuncia');
  const btnFechar  = document.getElementById('denuncia-fechar');
  const btnCancel  = document.getElementById('denuncia-cancelar');
  const btnEnviar  = document.getElementById('denuncia-enviar');
  const descricao  = document.getElementById('denuncia-descricao');
  const contador   = document.getElementById('denuncia-contador-valor');
  const erroEl     = document.getElementById('denuncia-erro');
  const nomeLocal  = document.getElementById('denuncia-nome-local');

  if (!btnAbrir || !overlay || !form) return;

  const localId = new URLSearchParams(window.location.search).get('id');

  // URL da API vem do config.js (window.API_BASE: localhost em dev, Render em produção)
  const API_BASE = window.API_BASE || 'http://localhost:3000';

  // POST /denuncias (backend/routes/denuncias.js)
  const ENDPOINT = API_BASE + '/denuncias';

  function mostrarToast(msg) {
    const t = document.getElementById('toast-notification');
    if (!t) return;
    t.textContent = msg;
    t.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      t.style.transform = 'translateX(-50%) translateY(80px)';
    }, 3000);
  }

  function mostrarErro(msg) {
    erroEl.textContent = msg;
    erroEl.hidden = false;
  }

  function limparErro() {
    erroEl.hidden = true;
    erroEl.textContent = '';
  }

  function abrir() {
    // mostra o nome do local no modal (preenchido pelo detalheslocais.js)
    const nome = document.getElementById('local-name')?.textContent?.trim();
    if (nome && nome !== 'Nome do Local') {
      nomeLocal.textContent = 'Local: ' + nome;
    }
    overlay.hidden = false;
    document.body.classList.add('denuncia-aberta');
    form.querySelector('input[name="motivo"]')?.focus();
  }

  function fechar() {
    overlay.hidden = true;
    document.body.classList.remove('denuncia-aberta');
    form.reset();
    contador.textContent = '0';
    limparErro();
    btnAbrir.focus();
  }

  btnAbrir.addEventListener('click', abrir);
  btnFechar.addEventListener('click', fechar);
  btnCancel.addEventListener('click', fechar);

  // clicar fora do modal fecha
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  // ESC fecha
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) fechar();
  });

  descricao.addEventListener('input', () => {
    contador.textContent = String(descricao.value.length);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErro();

    const motivo = form.querySelector('input[name="motivo"]:checked')?.value;
    if (!motivo) {
      mostrarErro('Selecione o motivo da denúncia.');
      return;
    }
    if (!localId) {
      mostrarErro('Não foi possível identificar o local.');
      return;
    }

    const payload = {
      tipo: 'local',
      alvo_id: Number(localId),
      motivo,
      descricao: descricao.value.trim()
    };

    // Mesmo token que o auth.js usa (localStorage 'token')
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('userIsLoggedIn') !== 'true') {
      mostrarErro('Você precisa estar logado para denunciar.');
      return;
    }
    try {
      const exp = JSON.parse(atob(token.split('.')[1])).exp;
      if (exp && exp < Math.floor(Date.now() / 1000)) {
        mostrarErro('Sua sessão expirou. Saia e faça login novamente.');
        return;
      }
    } catch (e) { /* token em formato inesperado: deixa o servidor decidir */ }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };
    console.log('[denúncia] enviando para', ENDPOINT);

    btnEnviar.disabled = true;
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const texto = await resp.text();
        let dados = {};
        try { dados = JSON.parse(texto); } catch (e) { /* resposta não era JSON */ }
        console.error('[denúncia] falhou:', resp.status, texto.slice(0, 300));

        if (resp.status === 401) {
          mostrarErro('Você precisa estar logado para denunciar.');
          return;
        }
        const msg = dados.erro || dados.message || dados.mensagem || dados.error;
        mostrarErro((msg || 'Não foi possível enviar.') + ' (código ' + resp.status + ')');
        return;
      }

      fechar();
      mostrarToast('Denúncia enviada. Obrigado por ajudar!');
    } catch (err) {
      console.error('Erro ao enviar denúncia:', err);
      mostrarErro('Erro de conexão. Tente novamente.');
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginal;
    }
  });
})();