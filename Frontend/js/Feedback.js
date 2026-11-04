/*
 * feedback.js - Avisos de confirmação (sucesso/erro) automáticos para o site Rolês.
 *
 * COMO USAR: salve este arquivo em /frontend/js/feedback.js e coloque esta linha
 * logo depois do config.js em cada página:
 *   <script src="/frontend/js/feedback.js"></script>
 *
 * O QUE FAZ SOZINHO:
 *   1) Toda chamada fetch com POST/PUT/PATCH/DELETE mostra um aviso:
 *        resposta OK -> verde | resposta com erro -> vermelho | servidor fora -> vermelho
 *   2) Todo alert("...") do site vira um aviso bonito (não bloqueia a tela):
 *        "✅ ..." ou "sucesso" -> verde | "❌ ..." ou "erro" -> vermelho | resto -> laranja
 *   3) Se a página redireciona logo depois do aviso (ex.: publicar e ir para a lista),
 *      o aviso é mostrado de novo na página seguinte, para o usuário conseguir ler.
 *
 * USO MANUAL (opcional):
 *   mostrarAviso('Rolê criado!', 'sucesso');   // 'sucesso' | 'erro' | 'aviso' | 'info'
 *
 * Para um fetch específico NÃO mostrar aviso:
 *   fetch(url, { method: 'POST', headers: { 'X-Sem-Aviso': '1' }, ... })
 */
(function () {
  'use strict';

  // ---------- Configurações ----------
  var METODOS_COM_AVISO = ['POST', 'PUT', 'PATCH', 'DELETE'];
  var DURACAO_MS = 4500;
  var DURACAO_ERRO_MS = 7000;

  // true = todo alert() do site vira aviso na tela. Mude para false para manter o alert() normal.
  var SUBSTITUIR_ALERT = true;

  // Requisições que NÃO mostram aviso automático (a página já avisa por conta própria).
  // Sem prefixo: "o endereço contém o trecho". Com "$" no início: "o endereço termina com".
  var IGNORAR_URLS = [
    '/api/chat',          // chat do assistente (um POST a cada mensagem)
    '/contato',           // tela de contato já tem toast próprio
    '/upload-imagem',     // upload de imagem é só uma etapa interna da publicação
    '$/estabelecimentos'  // criar estabelecimento já avisa via alert (que vira aviso)
  ];

  // Mensagem de sucesso específica por endereço (usada quando a API não devolve texto)
  var SUCESSO_POR_URL = [
    ['$/eventos', 'Evento publicado com sucesso!']
  ];

  var PADRAO_SUCESSO = {
    POST: 'Salvo com sucesso!',
    PUT: 'Atualizado com sucesso!',
    PATCH: 'Atualizado com sucesso!',
    DELETE: 'Removido com sucesso!'
  };
  var PADRAO_ERRO = 'Não foi possível concluir a ação. Tente novamente.';
  var ERRO_REDE = 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.';

  // ---------- Estilos (injetados automaticamente) ----------
  var css =
    '#feedback-container{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:calc(100vw - 40px);}' +
    '.feedback-aviso{display:flex;align-items:center;gap:10px;min-width:260px;max-width:380px;padding:14px 16px;border-radius:10px;color:#fff;font:500 15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transform:translateX(30px);transition:opacity .3s,transform .3s;cursor:pointer;white-space:pre-line;word-break:break-word;}' +
    '.feedback-aviso.visivel{opacity:1;transform:translateX(0);}' +
    '.feedback-aviso.sucesso{background:#2e9e5b;}' +
    '.feedback-aviso.erro{background:#d64545;}' +
    '.feedback-aviso.aviso{background:#d9822b;}' +
    '.feedback-aviso.info{background:#3b6fd4;}' +
    '.feedback-icone{font-size:20px;font-weight:700;flex-shrink:0;}' +
    '.feedback-modal-fundo{position:fixed;inset:0;z-index:100000;background:rgba(10,8,20,.65);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s;}' +
    '.feedback-modal-fundo.visivel{opacity:1;}' +
    '.feedback-modal{width:100%;max-width:420px;background:#1a1530;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.5);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;transform:translateY(12px) scale(.97);transition:transform .2s;}' +
    '.feedback-modal-fundo.visivel .feedback-modal{transform:none;}' +
    '.feedback-modal h3{margin:0 0 8px;font-size:18px;font-weight:700;}' +
    '.feedback-modal p{margin:0 0 22px;font-size:14.5px;line-height:1.5;color:rgba(255,255,255,.78);white-space:pre-line;}' +
    '.feedback-modal-acoes{display:flex;gap:10px;justify-content:flex-end;}' +
    '.feedback-modal button{font:600 14px system-ui,sans-serif;padding:10px 18px;border-radius:9px;border:1px solid transparent;cursor:pointer;}' +
    '.feedback-modal .fb-cancelar{background:transparent;border-color:rgba(255,255,255,.25);color:#fff;}' +
    '.feedback-modal .fb-cancelar:hover{background:rgba(255,255,255,.08);}' +
    '.feedback-modal .fb-ok{background:#7c3aed;color:#fff;}' +
    '.feedback-modal .fb-ok:hover{background:#6c2bd9;}' +
    '.feedback-modal .fb-ok.perigo{background:#d64545;}' +
    '.feedback-modal .fb-ok.perigo:hover{background:#b83a3a;}' +
    '.feedback-modal button:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +
    '@media(max-width:480px){#feedback-container{left:20px;right:20px;}.feedback-aviso{min-width:0;max-width:none;}}';
  var estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);

  // ---------- Container ----------
  function obterContainer() {
    var c = document.getElementById('feedback-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'feedback-container';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  // ---------- Função pública ----------
  var ativos = []; // avisos na tela: { el, tipo, msg, criado, fechar }
  var CHAVE_PENDENTES = 'feedback_pendentes';

  function mostrarAviso(mensagem, tipo) {
    tipo = tipo || 'info';
    mensagem = String(mensagem == null ? '' : mensagem);
    if (!mensagem) return;
    var icones = { sucesso: '✓', erro: '✕', aviso: '!', info: 'ℹ' };

    function criar() {
      // Se já existe um aviso do mesmo tipo criado há instantes, o novo substitui o antigo
      // (evita "Erro" da API + alert da página aparecendo juntos).
      var agora = Date.now();
      ativos.slice().forEach(function (a) {
        if (a.tipo === tipo && agora - a.criado < 2000) a.fechar(true);
      });

      var aviso = document.createElement('div');
      aviso.className = 'feedback-aviso ' + tipo;

      var icone = document.createElement('span');
      icone.className = 'feedback-icone';
      icone.textContent = icones[tipo] || icones.info;

      var texto = document.createElement('span');
      texto.textContent = mensagem; // textContent evita injeção de HTML

      aviso.appendChild(icone);
      aviso.appendChild(texto);
      obterContainer().appendChild(aviso);

      requestAnimationFrame(function () { aviso.classList.add('visivel'); });

      var item = { el: aviso, tipo: tipo, msg: mensagem, criado: agora };
      item.fechar = function (imediato) {
        var i = ativos.indexOf(item);
        if (i !== -1) ativos.splice(i, 1);
        if (imediato) {
          if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
          return;
        }
        aviso.classList.remove('visivel');
        setTimeout(function () { if (aviso.parentNode) aviso.parentNode.removeChild(aviso); }, 300);
      };
      ativos.push(item);

      aviso.addEventListener('click', function () { item.fechar(); });
      setTimeout(function () { item.fechar(); }, tipo === 'erro' ? DURACAO_ERRO_MS : DURACAO_MS);
    }

    if (document.body) criar();
    else document.addEventListener('DOMContentLoaded', criar);
  }
  window.mostrarAviso = mostrarAviso;

  // ---------- Avisos que sobrevivem a um redirecionamento ----------
  // Se a página sai logo depois de mostrar o aviso, guardamos para mostrar na próxima.
  window.addEventListener('pagehide', function () {
    try {
      var agora = Date.now();
      var lista = ativos
        .filter(function (a) { return agora - a.criado < 3000; })
        .map(function (a) { return { m: a.msg, t: a.tipo }; });
      if (lista.length) sessionStorage.setItem(CHAVE_PENDENTES, JSON.stringify({ quando: agora, lista: lista }));
    } catch (e) { /* sessionStorage indisponível: sem problema */ }
  });

  try {
    var bruto = sessionStorage.getItem(CHAVE_PENDENTES);
    if (bruto) {
      sessionStorage.removeItem(CHAVE_PENDENTES);
      var pendentes = JSON.parse(bruto);
      if (pendentes && Date.now() - pendentes.quando < 10000) {
        pendentes.lista.forEach(function (p) { mostrarAviso(p.m, p.t); });
      }
    }
  } catch (e) { /* ignora */ }

  // ---------- Confirmação no estilo do site (substitui confirm()) ----------
  // Uso (dentro de uma função async):
  //   if (!(await confirmarAviso('Excluir este estabelecimento?', { titulo: 'Excluir', confirmar: 'Excluir' }))) return;
  // Devolve true (confirmou) ou false (cancelou, Esc ou clique fora).
  function confirmarAviso(mensagem, opcoes) {
    opcoes = opcoes || {};
    var texto = String(mensagem == null ? '' : mensagem);
    var perigo = opcoes.perigo !== undefined ? !!opcoes.perigo : /exclu|remov|apag|delet|cancel/i.test(texto);

    return new Promise(function (resolve) {
      function montar() {
        var fundo = document.createElement('div');
        fundo.className = 'feedback-modal-fundo';

        var caixa = document.createElement('div');
        caixa.className = 'feedback-modal';
        caixa.setAttribute('role', 'alertdialog');
        caixa.setAttribute('aria-modal', 'true');

        var titulo = document.createElement('h3');
        titulo.textContent = opcoes.titulo || 'Confirmar ação';
        var corpo = document.createElement('p');
        corpo.textContent = texto;

        var acoes = document.createElement('div');
        acoes.className = 'feedback-modal-acoes';
        var btnCancelar = document.createElement('button');
        btnCancelar.type = 'button';
        btnCancelar.className = 'fb-cancelar';
        btnCancelar.textContent = opcoes.cancelar || 'Cancelar';
        var btnOk = document.createElement('button');
        btnOk.type = 'button';
        btnOk.className = 'fb-ok' + (perigo ? ' perigo' : '');
        btnOk.textContent = opcoes.confirmar || 'Confirmar';

        acoes.appendChild(btnCancelar);
        acoes.appendChild(btnOk);
        caixa.appendChild(titulo);
        caixa.appendChild(corpo);
        caixa.appendChild(acoes);
        fundo.appendChild(caixa);
        document.body.appendChild(fundo);
        requestAnimationFrame(function () { fundo.classList.add('visivel'); });

        function fechar(resposta) {
          document.removeEventListener('keydown', tecla, true);
          fundo.classList.remove('visivel');
          setTimeout(function () { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); }, 200);
          resolve(resposta);
        }
        function tecla(e) {
          if (e.key === 'Escape') { e.preventDefault(); fechar(false); }
        }
        document.addEventListener('keydown', tecla, true);
        btnOk.addEventListener('click', function () { fechar(true); });
        btnCancelar.addEventListener('click', function () { fechar(false); });
        fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(false); });

        // Em ações perigosas o foco começa em "Cancelar", para um Enter sem querer não excluir
        (perigo ? btnCancelar : btnOk).focus();
      }

      if (document.body) montar();
      else document.addEventListener('DOMContentLoaded', montar);
    });
  }
  window.confirmarAviso = confirmarAviso;

  // ---------- alert() vira aviso ----------
  function classificarAlert(texto) {
    var t = texto.toLowerCase();
    var temErro = /erro|falha|n[aã]o foi poss|inv[aá]lid/.test(t);
    if (texto.indexOf('\u274C') === 0 || temErro) return 'erro';
    if (texto.indexOf('\u2705') === 0 || /sucesso|publicado|conclu[ií]d/.test(t)) return 'sucesso';
    return 'aviso';
  }

  window.alertOriginal = window.alert;
  if (SUBSTITUIR_ALERT) {
    window.alert = function (mensagem) {
      var texto = String(mensagem == null ? '' : mensagem).trim();
      var tipo = classificarAlert(texto);
      mostrarAviso(texto.replace(/^[\u2705\u274C\u26A0\uFE0F\u2139\s]+/, ''), tipo);
    };
  }

  // ---------- Interceptação automática do fetch ----------
  var fetchOriginal = window.fetch;
  if (!fetchOriginal) return;

  function pegarUrl(entrada) {
    return typeof entrada === 'string' ? entrada : (entrada && entrada.url) || String(entrada || '');
  }

  function urlCasa(url, padrao) {
    var caminho = String(url).split('?')[0].split('#')[0].replace(/\/+$/, '');
    if (padrao.charAt(0) === '$') {
      var fim = padrao.slice(1);
      return caminho.length >= fim.length && caminho.indexOf(fim, caminho.length - fim.length) !== -1;
    }
    return caminho.indexOf(padrao) !== -1;
  }

  function urlIgnorada(url) {
    for (var i = 0; i < IGNORAR_URLS.length; i++) {
      if (urlCasa(url, IGNORAR_URLS[i])) return true;
    }
    return false;
  }

  function sucessoPorUrl(url) {
    for (var i = 0; i < SUCESSO_POR_URL.length; i++) {
      if (urlCasa(url, SUCESSO_POR_URL[i][0])) return SUCESSO_POR_URL[i][1];
    }
    return null;
  }

  function pegarMetodo(entrada, opcoes) {
    var m = (opcoes && opcoes.method) || (entrada && entrada.method) || 'GET';
    return String(m).toUpperCase();
  }

  function temHeaderIgnorar(entrada, opcoes) {
    try {
      var h = new Headers((opcoes && opcoes.headers) || (entrada && entrada.headers) || {});
      return h.has('X-Sem-Aviso');
    } catch (e) {
      return false;
    }
  }

  function extrairMensagem(dados) {
    if (!dados) return null;
    if (typeof dados === 'string') return dados;
    return dados.mensagem || dados.message || dados.msg || dados.erro || dados.error || null;
  }

  window.fetch = function (entrada, opcoes) {
    var url = pegarUrl(entrada);
    var metodo = pegarMetodo(entrada, opcoes);
    var deveAvisar = METODOS_COM_AVISO.indexOf(metodo) !== -1 &&
                     !temHeaderIgnorar(entrada, opcoes) &&
                     !urlIgnorada(url);

    return fetchOriginal.apply(this, arguments).then(
      function (resposta) {
        if (!deveAvisar) return resposta;

        var padraoOk = sucessoPorUrl(url) || PADRAO_SUCESSO[metodo] || 'Ação concluída!';

        // clone() para não consumir o corpo que o seu código ainda vai ler
        resposta.clone().text().then(function (corpo) {
          var dados = null;
          try { dados = JSON.parse(corpo); } catch (e) { dados = null; }
          var msgApi = extrairMensagem(dados);

          if (resposta.ok) {
            mostrarAviso(msgApi || padraoOk, 'sucesso');
          } else {
            mostrarAviso(msgApi || PADRAO_ERRO, 'erro');
          }
        }).catch(function () {
          mostrarAviso(resposta.ok ? padraoOk : PADRAO_ERRO, resposta.ok ? 'sucesso' : 'erro');
        });

        return resposta;
      },
      function (erro) {
        if (deveAvisar) mostrarAviso(ERRO_REDE, 'erro');
        throw erro; // mantém o comportamento original para o seu catch
      }
    );
  };
})();