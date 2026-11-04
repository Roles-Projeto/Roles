/* =========================================================
   Rolês - Menu de Acessibilidade
   Arquivo único (CSS + HTML + JS). Salve em:
   Frontend/frontend/js/acessibilidade.js

   Como usar: adicione no index.html, depois do loadHeader.js:
   <script src="/frontend/js/acessibilidade.js"></script>

   - Tenta se encaixar na <nav>/<ul> do header carregado
     em #header-container.
   - Se não achar o menu, aparece como botão flutuante.
   - Preferências ficam salvas no localStorage.
========================================================= */
(function () {
  "use strict";

  var KEY = "roles-a11y-v1";
  var DEFAULTS = {
    font: 0,          // 0..3
    contrast: false,
    gray: false,
    links: false,
    readable: false,
    spacing: false,
    noAnim: false,
    cursor: false,
    narrator: false,  // narrador (leitura em voz alta)
    rate: 1,          // velocidade da voz: índice 0..3 em RATES
  };
  var MAX_FONT = 3;
  var STEP = 0.12; // +12% por nível

  var state = load();

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      return Object.assign({}, DEFAULTS, saved || {});
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- CSS ---------------- */
  var css = `
  #a11y-root, #a11y-root *:not(i) { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
  #a11y-root i {
    font-family: "Font Awesome 6 Free" !important; font-weight: 900 !important;
    font-style: normal; display: inline-block; line-height: 1;
  }

  .a11y-item { list-style: none; display: inline-flex; align-items: center; }
  .a11y-trigger {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: inherit; border: 2px solid transparent;
    padding: 8px 12px; border-radius: 999px; cursor: pointer;
    font-size: 15px; font-weight: 600; line-height: 1;
  }
  .a11y-trigger:hover { background: rgba(127,127,127,.18); }
  .a11y-trigger:focus-visible { outline: 3px solid #ffbf00; outline-offset: 2px; }
  .a11y-trigger.a11y-floating {
    position: fixed; left: 16px; bottom: 16px; z-index: 10000;
    background: #5b2bd6; color: #fff; border-color: #fff;
    box-shadow: 0 6px 18px rgba(0,0,0,.3); padding: 12px 16px;
  }

  .a11y-panel {
    position: fixed; top: 76px; right: 16px; z-index: 10001;
    width: 340px; max-width: calc(100vw - 32px); max-height: calc(100vh - 100px);
    overflow-y: auto; background: #fff; color: #1b1b1f;
    border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.28);
    padding: 18px; display: none;
  }
  .a11y-panel.open { display: block; }
  .a11y-panel.a11y-from-floating { top: auto; right: auto; left: 16px; bottom: 72px; }

  .a11y-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .a11y-head h2 { font-size: 18px; margin: 0; }
  .a11y-close {
    background: #eee; border: 0; width: 34px; height: 34px; border-radius: 50%;
    font-size: 20px; line-height: 1; cursor: pointer; color: #1b1b1f;
  }

  .a11y-size {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: #f3f0ff; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px;
  }
  .a11y-size span { font-size: 14px; font-weight: 700; }
  .a11y-size .a11y-level { font-weight: 400; color: #555; min-width: 44px; text-align: center; }
  .a11y-size button {
    width: 40px; height: 40px; border-radius: 10px; border: 2px solid #5b2bd6;
    background: #fff; color: #5b2bd6; font-size: 16px; font-weight: 700; cursor: pointer;
  }
  .a11y-size button:disabled { opacity: .4; cursor: not-allowed; }

  .a11y-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .a11y-opt {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    min-height: 82px; padding: 10px 6px; text-align: center;
    background: #fff; color: #1b1b1f; border: 2px solid #d7d2ee; border-radius: 12px;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .a11y-opt i { font-size: 20px; color: #5b2bd6; }
  .a11y-opt:hover { border-color: #5b2bd6; }
  .a11y-opt[aria-pressed="true"] { background: #5b2bd6; color: #fff; border-color: #5b2bd6; }
  .a11y-opt[aria-pressed="true"] i { color: #fff; }

  .a11y-trigger:focus-visible, .a11y-panel button:focus-visible { outline: 3px solid #ffbf00; outline-offset: 2px; }

  .a11y-reset {
    width: 100%; margin-top: 14px; padding: 12px; border-radius: 12px; border: 0;
    background: #1b1b1f; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer;
  }

  /* ---------- narrador ---------- */
  .a11y-narrator {
    background: #f3f0ff; border-radius: 12px; padding: 12px; margin-bottom: 12px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .a11y-narr-toggle {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; min-height: 48px; padding: 10px;
    border: 2px solid #5b2bd6; border-radius: 12px; background: #fff; color: #5b2bd6;
    font-size: 15px; font-weight: 700; cursor: pointer;
  }
  .a11y-narr-toggle i { font-size: 18px; }
  .a11y-narr-toggle[aria-pressed="true"] { background: #5b2bd6; color: #fff; }
  .a11y-narr-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .a11y-narr-actions button {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 42px; border-radius: 10px; border: 2px solid #5b2bd6;
    background: #fff; color: #5b2bd6; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  .a11y-narrator button:disabled { opacity: .4; cursor: not-allowed; }
  .a11y-narrator .a11y-size { margin-bottom: 0; background: #fff; }
  .a11y-note { margin: 0; font-size: 12px; color: #555; }
  .a11y-note:empty { display: none; }

  /* elemento que o narrador está lendo agora */
  .a11y-speaking {
    outline: 3px solid #5b2bd6 !important; outline-offset: 2px;
    background-color: rgba(91,43,214,.12) !important;
  }
  html.a11y-contrast .a11y-speaking { outline-color: #ffe600 !important; }

  /* ---------- efeitos aplicados no site ---------- */
  html.a11y-gray { filter: grayscale(1); }

  html.a11y-contrast body,
  html.a11y-contrast body *:not(#a11y-root):not(#a11y-root *) {
    background-color: #000 !important; background-image: none !important;
    color: #fff !important; border-color: #fff !important; text-shadow: none !important;
  }
  html.a11y-contrast body a:not(#a11y-root *),
  html.a11y-contrast body a *:not(#a11y-root *) { color: #ffe600 !important; }
  html.a11y-contrast body img { filter: contrast(1.1); }

  html.a11y-links body a:not(#a11y-root *) {
    text-decoration: underline !important; text-underline-offset: 3px;
    outline: 2px solid #ffbf00; outline-offset: 2px; background-color: rgba(255,191,0,.18);
  }

  html.a11y-readable body *:not(#a11y-root):not(#a11y-root *):not(i):not(.fa):not(.fas):not(.fab):not(.far):not(.fa-solid) {
    font-family: Verdana, Tahoma, Arial, sans-serif !important;
  }

  html.a11y-spacing body *:not(#a11y-root):not(#a11y-root *) {
    letter-spacing: .08em !important; word-spacing: .16em !important; line-height: 1.7 !important;
  }

  html.a11y-noanim *, html.a11y-noanim *::before, html.a11y-noanim *::after {
    animation: none !important; transition: none !important; scroll-behavior: auto !important;
  }

  html.a11y-cursor, html.a11y-cursor body, html.a11y-cursor body * {
    cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'><path d='M4 2l16 9-7 2 4 8-3 1-4-8-6 5z' fill='black' stroke='white' stroke-width='1.5'/></svg>") 4 2, auto !important;
  }
  `;

  function injectCss() {
    var s = document.createElement("style");
    s.id = "a11y-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------------- Aplicação das preferências ---------------- */
  var CLASS_MAP = {
    contrast: "a11y-contrast",
    gray: "a11y-gray",
    links: "a11y-links",
    readable: "a11y-readable",
    spacing: "a11y-spacing",
    noAnim: "a11y-noanim",
    cursor: "a11y-cursor",
  };

  function applyClasses() {
    var html = document.documentElement;
    Object.keys(CLASS_MAP).forEach(function (k) {
      html.classList.toggle(CLASS_MAP[k], !!state[k]);
    });
  }

  // Escala de fonte: funciona mesmo com tamanhos em px.
  var scaleTimer = null;
  function scaleFonts() {
    var factor = 1 + state.font * STEP;
    var els = document.body.querySelectorAll("*");
    // 1ª passada: lê tudo (evita reflow a cada elemento)
    var jobs = [];
    els.forEach(function (el) {
      if (el.closest("#a11y-root")) return;
      var tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "svg" || tag === "path") return;
      if (el.dataset.a11yOrig === undefined) {
        el.dataset.a11yInline = el.style.fontSize || "";
        el.dataset.a11yOrig = parseFloat(getComputedStyle(el).fontSize) || 0;
      }
      jobs.push(el);
    });
    // 2ª passada: escreve
    jobs.forEach(function (el) {
      if (state.font === 0) {
        if (el.dataset.a11yInline) el.style.fontSize = el.dataset.a11yInline;
        else el.style.removeProperty("font-size");
        delete el.dataset.a11yOrig;
        delete el.dataset.a11yInline;
      } else {
        var o = parseFloat(el.dataset.a11yOrig);
        if (o) el.style.fontSize = (o * factor).toFixed(2) + "px";
      }
    });
  }
  function scheduleScale() {
    clearTimeout(scaleTimer);
    scaleTimer = setTimeout(scaleFonts, 150);
  }

  // Conteúdo criado depois (cards do Home.js, header etc.) também é escalado
  function observeNewContent() {
    var mo = new MutationObserver(function (muts) {
      if (state.font === 0) return;
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.closest && t.closest("#a11y-root")) continue;
        scheduleScale();
        return;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------- Narrador (leitura em voz alta) ----------------
     Usa a voz do próprio navegador (Web Speech API), em português.
     - Lê cada elemento ao receber foco (Tab) e ao passar o mouse.
     - "Ler a página" lê o conteúdo inteiro, em ordem.
     - Atalhos: Alt+N liga/desliga; Esc interrompe a leitura.
  ----------------------------------------------------------------- */
  var synth = window.speechSynthesis || null;
  var RATES = [0.8, 1, 1.25, 1.5];
  var RATE_LABELS = ["Lenta", "Normal", "Rápida", "Muito rápida"];
  var TARGETS = "a, button, input, select, textarea, img, h1, h2, h3, h4, h5, h6, label, p, li, summary, [role='button'], [role='link']";
  var voice = null;
  var queueToken = 0;
  var speakingEl = null;
  var hoverTimer = null;
  var lastHover = null;
  var lastFocusEl = null;
  var lastFocusTime = 0;
  var narrToggle, readBtn, stopBtn, rateMinus, ratePlus, rateLevel, narrNote;

  function clean(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  function pickVoice() {
    if (!synth) return;
    var list = synth.getVoices() || [];
    var br = list.filter(function (v) { return /^pt[-_]BR/i.test(v.lang); });
    var pt = list.filter(function (v) { return /^pt/i.test(v.lang); });
    voice = br[0] || pt[0] || null;
  }

  function labelOf(el) {
    var t = clean(el.getAttribute("aria-label"));
    if (t) return t;
    var by = el.getAttribute("aria-labelledby");
    if (by) {
      t = clean(by.split(/\s+/).map(function (id) {
        var n = document.getElementById(id);
        return n ? n.textContent : "";
      }).join(" "));
      if (t) return t;
    }
    if (el.id) {
      var id = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id;
      var l = document.querySelector('label[for="' + id + '"]');
      if (l) return clean(l.textContent);
    }
    var wrap = el.closest ? el.closest("label") : null;
    if (wrap) return clean(wrap.textContent);
    return clean(el.getAttribute("title") || el.getAttribute("placeholder"));
  }

  function imgAlt(el) {
    var img = el.querySelector ? el.querySelector("img[alt]") : null;
    return img ? clean(img.getAttribute("alt")) : "";
  }

  // Texto que o narrador fala para cada tipo de elemento.
  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute("role");
    var name = labelOf(el);
    var text = clean(el.textContent);
    var out;

    if (tag === "img") {
      return "Imagem: " + (clean(el.getAttribute("alt")) || name || "sem descrição");
    }
    if (/^h[1-6]$/.test(tag)) return "Título: " + (name || text);
    if (tag === "a" || role === "link") {
      return (name || text || imgAlt(el) || "sem texto") + ", link";
    }
    if (tag === "button" || role === "button") {
      out = (name || text || imgAlt(el) || "sem nome") + ", botão";
      var pressed = el.getAttribute("aria-pressed");
      if (pressed === "true") out += ", ativado";
      else if (pressed === "false") out += ", desativado";
      if (el.disabled) out += ", indisponível";
      return out;
    }
    if (tag === "input") {
      var type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "submit" || type === "button" || type === "reset") {
        return (el.value || name || "sem nome") + ", botão";
      }
      if (type === "checkbox") {
        return (name || "Caixa de seleção") + ", caixa de seleção, " + (el.checked ? "marcada" : "desmarcada");
      }
      if (type === "radio") {
        return (name || "Opção") + ", opção, " + (el.checked ? "selecionada" : "não selecionada");
      }
      var kinds = { password: "campo de senha", email: "campo de e-mail", search: "campo de busca", tel: "campo de telefone", date: "campo de data", number: "campo numérico" };
      out = (name || "Campo") + ", " + (kinds[type] || "campo de texto");
      if (el.required) out += ", obrigatório";
      if (type === "password") out += el.value ? ", preenchido" : ", vazio";
      else out += el.value ? ", preenchido com " + el.value : ", vazio";
      return out;
    }
    if (tag === "textarea") {
      out = (name || "Campo") + ", campo de texto longo";
      if (el.required) out += ", obrigatório";
      out += el.value ? ", preenchido com " + el.value : ", vazio";
      return out;
    }
    if (tag === "select") {
      var opt = el.options && el.options[el.selectedIndex];
      return (name || "Lista") + ", lista de opções, selecionado: " + (opt ? clean(opt.textContent) : "nenhum");
    }
    return text.length > 400 ? text.slice(0, 400) : text;
  }

  function clearHighlight() {
    if (speakingEl) speakingEl.classList.remove("a11y-speaking");
    speakingEl = null;
  }
  function highlight(el, scroll) {
    clearHighlight();
    speakingEl = el;
    el.classList.add("a11y-speaking");
    if (scroll && el.scrollIntoView) el.scrollIntoView({ block: "center" });
  }

  function speakNow(text, onend) {
    if (!synth || !text) { if (onend) onend(); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    if (voice) u.voice = voice;
    u.rate = RATES[state.rate] || 1;
    u.onend = u.onerror = function () { if (onend) onend(); };
    synth.speak(u);
  }

  function stopSpeech() {
    queueToken++;
    clearHighlight();
    if (synth) synth.cancel();
  }

  // Interrompe o que estiver sendo falado e fala o novo texto.
  function say(text, el) {
    if (!synth) return;
    stopSpeech();
    speakNow(text, function () {
      if (el && speakingEl === el) clearHighlight();
    });
    if (el) highlight(el, false);
  }
  function announce(text) {
    if (state.narrator) say(text);
  }

  function chunkText(t) {
    var parts = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t];
    var out = [];
    var cur = "";
    parts.forEach(function (p) {
      if (cur && (cur + p).length > 180) { out.push(cur); cur = p; }
      else cur += p;
    });
    if (clean(cur)) out.push(cur);
    return out;
  }

  function isVisible(el) {
    if (el.closest("[aria-hidden='true'], [hidden], script, style, noscript, #a11y-root, #roles-chat-window, #roles-chat-bubble")) return false;
    if (el.getClientRects().length === 0) return false;
    return window.getComputedStyle(el).visibility !== "hidden";
  }

  // Lista, em ordem, o que deve ser lido na página inteira.
  function collectPageItems() {
    var root = document.querySelector("main") || document.body;
    var nodes = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,button,input,select,textarea,summary,img[alt],label");
    var items = [];
    nodes.forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (!isVisible(el)) return;
      if (tag === "input" && (el.getAttribute("type") || "").toLowerCase() === "hidden") return;
      // evita ler duas vezes o que já faz parte de outro elemento
      if (tag === "li" && el.querySelector("a,button,p,h1,h2,h3,h4,h5,h6,input,select,textarea,li")) return;
      if ((tag === "a" || tag === "button") && el.closest("p,h1,h2,h3,h4,h5,h6")) return;
      if (tag === "img" && el.closest("a,button")) return;
      if (tag === "label" && (el.control || el.querySelector("input,select,textarea"))) return;
      if (!clean(describe(el))) return;
      items.push(el);
    });
    return items;
  }

  function readPage() {
    if (!synth) return;
    stopSpeech();
    var items = collectPageItems();
    if (!items.length) { say("Não encontrei conteúdo para ler nesta página."); return; }
    var token = queueToken;
    var i = 0;

    function next() {
      if (token !== queueToken) return;
      if (i >= items.length) {
        clearHighlight();
        speakNow("Fim da página.");
        return;
      }
      var el = items[i++];
      highlight(el, true);
      var chunks = chunkText(describe(el));
      var j = 0;
      (function nextChunk() {
        if (token !== queueToken) return;
        if (j >= chunks.length) { next(); return; }
        speakNow(chunks[j++], nextChunk);
      })();
    }

    speakNow("Lendo a página.", next);
  }

  function onFocusIn(e) {
    if (!state.narrator || !synth) return;
    var el = e.target;
    if (!el || el === document.body || el === document.documentElement || !el.tagName) return;
    var now = Date.now();
    if (el === lastFocusEl && now - lastFocusTime < 800) return;
    lastFocusEl = el;
    lastFocusTime = now;
    var text = describe(el);
    if (text) say(text);
  }

  function onMouseOver(e) {
    if (!state.narrator || !synth || !e.target.closest) return;
    var target = e.target.closest(TARGETS);
    if (!target || target === lastHover) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      var text = describe(target);
      if (!text) return;
      lastHover = target;
      say(text, target);
    }, 350);
  }
  function onMouseOut() {
    clearTimeout(hoverTimer);
    lastHover = null;
  }

  function setNarrator(on) {
    if (!synth) return;
    state.narrator = on;
    save();
    if (on) {
      say("Narrador ativado. Use a tecla Tab para navegar e ouvir cada elemento. Alt mais N desativa o narrador. Escape interrompe a leitura.");
    } else {
      stopSpeech();
      speakNow("Narrador desativado.");
    }
    syncUI();
  }

  function initNarrator() {
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      synth = null;
      narrNote.textContent = "Seu navegador não suporta narração por voz.";
      [narrToggle, readBtn, stopBtn, rateMinus, ratePlus].forEach(function (b) { b.disabled = true; });
      window.RolesNarrator = { speak: function () {}, stop: function () {}, isOn: function () { return false; } };
      return;
    }

    pickVoice();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);
    else synth.onvoiceschanged = pickVoice;

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("beforeunload", function () { synth.cancel(); });

    narrToggle.addEventListener("click", function () { setNarrator(!state.narrator); });
    readBtn.addEventListener("click", readPage);
    stopBtn.addEventListener("click", stopSpeech);
    rateMinus.addEventListener("click", function () {
      if (state.rate > 0) { state.rate--; save(); syncUI(); say("Voz " + RATE_LABELS[state.rate].toLowerCase()); }
    });
    ratePlus.addEventListener("click", function () {
      if (state.rate < RATES.length - 1) { state.rate++; save(); syncUI(); say("Voz " + RATE_LABELS[state.rate].toLowerCase()); }
    });

    // Para outros scripts (ex.: o chat) falarem quando o narrador estiver ligado.
    window.RolesNarrator = {
      speak: function (text) { if (state.narrator) say(text); },
      stop: stopSpeech,
      isOn: function () { return !!state.narrator; },
    };
  }

  /* ---------------- UI ---------------- */
  var OPTIONS = [
    { key: "contrast", icon: "fa-circle-half-stroke", label: "Alto contraste" },
    { key: "gray", icon: "fa-droplet-slash", label: "Escala de cinza" },
    { key: "links", icon: "fa-link", label: "Destacar links" },
    { key: "readable", icon: "fa-font", label: "Fonte legível" },
    { key: "spacing", icon: "fa-text-height", label: "Espaçamento do texto" },
    { key: "noAnim", icon: "fa-ban", label: "Pausar animações" },
    { key: "cursor", icon: "fa-arrow-pointer", label: "Cursor grande" },
  ];

  var panel, trigger, levelEl, btnMinus, btnPlus;

  function build() {
    var root = document.createElement("div");
    root.id = "a11y-root";

    // Botão (gatilho)
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "a11y-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "a11y-panel");
    trigger.innerHTML = '<i class="fa-solid fa-universal-access" aria-hidden="true"></i><span>Acessibilidade</span>';

    // Painel
    panel = document.createElement("div");
    panel.id = "a11y-panel";
    panel.className = "a11y-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Menu de acessibilidade");

    var opts = OPTIONS.map(function (o) {
      return '<button type="button" class="a11y-opt" data-key="' + o.key + '" aria-pressed="false">' +
        '<i class="fa-solid ' + o.icon + '" aria-hidden="true"></i><span>' + o.label + "</span></button>";
    }).join("");

    panel.innerHTML =
      '<div class="a11y-head"><h2>Acessibilidade</h2>' +
      '<button type="button" class="a11y-close" aria-label="Fechar menu de acessibilidade">&times;</button></div>' +
      '<div class="a11y-narrator" role="group" aria-label="Narrador">' +
      '<button type="button" class="a11y-narr-toggle" id="a11y-narr-toggle" aria-pressed="false" aria-keyshortcuts="Alt+N">' +
      '<i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>Narrador (Alt+N)</span></button>' +
      '<div class="a11y-narr-actions">' +
      '<button type="button" id="a11y-read-page"><i class="fa-solid fa-play" aria-hidden="true"></i><span>Ler a página</span></button>' +
      '<button type="button" id="a11y-stop"><i class="fa-solid fa-stop" aria-hidden="true"></i><span>Parar</span></button></div>' +
      '<div class="a11y-size" role="group" aria-label="Velocidade da voz">' +
      '<button type="button" id="a11y-rate-minus" aria-label="Voz mais lenta">&minus;</button>' +
      '<span>Voz <span class="a11y-level" id="a11y-rate-level" aria-live="polite">Normal</span></span>' +
      '<button type="button" id="a11y-rate-plus" aria-label="Voz mais rápida">+</button></div>' +
      '<p class="a11y-note" id="a11y-narr-note" role="status"></p></div>' +
      '<div class="a11y-size" role="group" aria-label="Tamanho do texto">' +
      '<button type="button" id="a11y-minus" aria-label="Diminuir texto">A-</button>' +
      '<span>Texto <span class="a11y-level" id="a11y-level" aria-live="polite">100%</span></span>' +
      '<button type="button" id="a11y-plus" aria-label="Aumentar texto">A+</button></div>' +
      '<div class="a11y-grid">' + opts + "</div>" +
      '<button type="button" class="a11y-reset">Restaurar padrão</button>';

    root.appendChild(panel);
    placeTrigger(root);
    document.body.appendChild(root);

    levelEl = panel.querySelector("#a11y-level");
    btnMinus = panel.querySelector("#a11y-minus");
    btnPlus = panel.querySelector("#a11y-plus");
    narrToggle = panel.querySelector("#a11y-narr-toggle");
    readBtn = panel.querySelector("#a11y-read-page");
    stopBtn = panel.querySelector("#a11y-stop");
    rateMinus = panel.querySelector("#a11y-rate-minus");
    ratePlus = panel.querySelector("#a11y-rate-plus");
    rateLevel = panel.querySelector("#a11y-rate-level");
    narrNote = panel.querySelector("#a11y-narr-note");

    bindEvents();
    initNarrator();
    syncUI();
  }

  // Encaixa o botão no menu do header; se não achar, vira flutuante.
  function placeTrigger(root) {
    var host = document.querySelector("#header-container nav ul, header nav ul");
    if (host) {
      var li = document.createElement("li");
      li.className = "a11y-item";
      li.appendChild(trigger);
      host.appendChild(li);
      return;
    }
    var nav = document.querySelector("#header-container nav, header nav");
    if (nav) {
      var wrap = document.createElement("div");
      wrap.className = "a11y-item";
      wrap.appendChild(trigger);
      nav.appendChild(wrap);
      return;
    }
    trigger.classList.add("a11y-floating");
    panel.classList.add("a11y-from-floating");
    root.appendChild(trigger);
  }

  function openPanel() {
    panel.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    var closeBtn = panel.querySelector(".a11y-close");
    closeBtn.focus();
    announce("Menu de acessibilidade aberto. " + describe(closeBtn));
  }
  function closePanel(returnFocus) {
    panel.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  }

  function bindEvents() {
    trigger.addEventListener("click", function () {
      panel.classList.contains("open") ? closePanel(false) : openPanel();
    });
    panel.querySelector(".a11y-close").addEventListener("click", function () { closePanel(true); });

    document.addEventListener("keydown", function (e) {
      // Alt+N liga/desliga o narrador em qualquer lugar do site
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.code === "KeyN" && synth) {
        e.preventDefault();
        setNarrator(!state.narrator);
        return;
      }
      if (e.key === "Escape") {
        if (synth && (synth.speaking || synth.pending)) stopSpeech();
        if (panel.classList.contains("open")) closePanel(true);
      }
    });
    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("open")) return;
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      closePanel(false);
    });

    panel.querySelectorAll(".a11y-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.key;
        state[k] = !state[k];
        commit();
        announce(b.textContent.trim() + (state[k] ? " ativado" : " desativado"));
      });
    });

    function announceFont() {
      announce("Texto em " + Math.round((1 + state.font * STEP) * 100) + " por cento");
    }
    btnMinus.addEventListener("click", function () {
      if (state.font > 0) { state.font--; commit(true); announceFont(); }
    });
    btnPlus.addEventListener("click", function () {
      if (state.font < MAX_FONT) { state.font++; commit(true); announceFont(); }
    });

    panel.querySelector(".a11y-reset").addEventListener("click", function () {
      stopSpeech();
      state = Object.assign({}, DEFAULTS);
      commit(true);
    });
  }

  function syncUI() {
    panel.querySelectorAll(".a11y-opt").forEach(function (b) {
      b.setAttribute("aria-pressed", state[b.dataset.key] ? "true" : "false");
    });
    levelEl.textContent = Math.round((1 + state.font * STEP) * 100) + "%";
    btnMinus.disabled = state.font === 0;
    btnPlus.disabled = state.font === MAX_FONT;

    narrToggle.setAttribute("aria-pressed", state.narrator ? "true" : "false");
    rateLevel.textContent = RATE_LABELS[state.rate] || RATE_LABELS[1];
    if (synth) {
      rateMinus.disabled = state.rate === 0;
      ratePlus.disabled = state.rate === RATES.length - 1;
    }
  }

  function commit(fontChanged) {
    save();
    applyClasses();
    if (fontChanged) scaleFonts();
    syncUI();
  }

  /* ---------------- Início ---------------- */
  function init() {
    injectCss();
    applyClasses();
    build();
    if (state.font > 0) scaleFonts();
    observeNewContent();

    // O header é carregado via fetch: se o botão caiu como flutuante,
    // tenta mover para o menu assim que o header aparecer.
    var hc = document.getElementById("header-container");
    if (hc && trigger.classList.contains("a11y-floating")) {
      var mo = new MutationObserver(function () {
        var host = hc.querySelector("nav ul") || hc.querySelector("nav");
        if (!host) return;
        mo.disconnect();
        var item = document.createElement(host.tagName === "UL" ? "li" : "div");
        item.className = "a11y-item";
        trigger.classList.remove("a11y-floating");
        panel.classList.remove("a11y-from-floating");
        item.appendChild(trigger);
        host.appendChild(item);
      });
      mo.observe(hc, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();