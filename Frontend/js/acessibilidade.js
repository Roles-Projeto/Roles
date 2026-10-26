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

    bindEvents();
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
    panel.querySelector(".a11y-close").focus();
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
      if (e.key === "Escape" && panel.classList.contains("open")) closePanel(true);
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
      });
    });

    btnMinus.addEventListener("click", function () {
      if (state.font > 0) { state.font--; commit(true); }
    });
    btnPlus.addEventListener("click", function () {
      if (state.font < MAX_FONT) { state.font++; commit(true); }
    });

    panel.querySelector(".a11y-reset").addEventListener("click", function () {
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