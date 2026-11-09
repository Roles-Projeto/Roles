// frontend/js/empresario.js
// Landing do empresário: métricas reais, depoimentos dinâmicos e CTAs.
// Depende de window.API_BASE (definido em /frontend/js/config.js).
(() => {
  "use strict";

  const CONFIG = {
    CADASTRO_URL: "/frontend/cadastro/cadastro.html",
    // ⚠️ CONFIRME o caminho real do painel do empresário:
    DASHBOARD_URL: "/frontend/dashboard/dashboard.html",
    TIMEOUT_MS: 8000,
  };

  // ---------- utilidades ----------
  const lerStorage = (chave) => {
    try { return localStorage.getItem(chave); } catch { return null; }
  };

  async function getJSON(caminho) {
    const base = (window.API_BASE || "").replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${caminho}`, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- formatação ----------
  // < 1.000 -> número exato | 1.234 -> "1,2k+" | 12.345 -> "12k+"
  // (sempre arredonda para baixo, para o "+" ser verdadeiro)
  function formatarContagem(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    if (n < 1000) return n.toLocaleString("pt-BR");
    if (n < 10000) return `${(Math.floor(n / 100) / 10).toLocaleString("pt-BR")}k+`;
    return `${Math.floor(n / 1000).toLocaleString("pt-BR")}k+`;
  }

  function formatarNota(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "—";
    return n.toFixed(1).replace(".", ",");
  }

  // ---------- métricas ----------
  async function carregarEstatisticas() {
    const cards = document.querySelectorAll("[data-stat]");
    if (!cards.length) return;
    const container = cards[0].parentElement;

    container?.setAttribute("aria-busy", "true");
    cards.forEach((c) => c.classList.add("is-loading"));

    let valores = {};
    try {
      const d = await getJSON("/publico/estatisticas");
      valores = {
        usuarios: formatarContagem(d.usuarios),
        estabelecimentos: formatarContagem(d.estabelecimentos),
        eventos: formatarContagem(d.eventosMes),
        avaliacao: formatarNota(d.avaliacaoMedia),
      };
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    }

    cards.forEach((card) => {
      const alvo = card.querySelector("strong");
      if (alvo) alvo.textContent = valores[card.dataset.stat] ?? "—";
      card.classList.remove("is-loading");
    });
    container?.removeAttribute("aria-busy");
  }

  // ---------- depoimentos ----------
  function criarCardDepoimento({ texto, autor, estabelecimento, nota }) {
    const card = document.createElement("div");
    card.className = "testimonial-card";

    const icone = document.createElement("div");
    icone.className = "quote-icon";
    icone.innerHTML = '<i class="fa-solid fa-quote-left" aria-hidden="true"></i>';

    const estrelas = document.createElement("div");
    estrelas.className = "testimonial-stars";
    if (Number.isFinite(nota) && nota > 0) {
      estrelas.setAttribute("role", "img");
      estrelas.setAttribute("aria-label", `Nota ${nota} de 5`);
      for (let n = 1; n <= 5; n++) {
        const estrela = document.createElement("i");
        estrela.className = `fa-solid fa-star${n <= nota ? "" : " is-off"}`;
        estrela.setAttribute("aria-hidden", "true");
        estrelas.appendChild(estrela);
      }
    }

    const p = document.createElement("p");
    p.className = "testimonial-text";
    p.textContent = `“${texto}”`; // textContent: nunca interpreta HTML vindo do banco

    const info = document.createElement("div");
    info.className = "author-info";
    const nome = document.createElement("span");
    nome.className = "author-name";
    nome.textContent = autor;
    info.appendChild(nome);
    if (estabelecimento) {
      const cargo = document.createElement("span");
      cargo.className = "author-role";
      cargo.textContent = estabelecimento;
      info.appendChild(cargo);
    }

    card.append(icone, estrelas, p, info);
    return card;
  }

  async function carregarDepoimentos() {
    const secao = document.getElementById("testimonials-section");
    const grid = document.getElementById("testimonials-grid");
    if (!secao || !grid) return;

    try {
      const lista = await getJSON("/publico/depoimentos");
      const validos = Array.isArray(lista)
        ? lista.filter((d) => d && d.texto && d.autor)
        : [];

      if (!validos.length) { secao.hidden = true; return; } // sem depoimentos = sem seção
      grid.replaceChildren(...validos.map(criarCardDepoimento));
      secao.hidden = false;
    } catch (err) {
      console.error("Erro ao carregar depoimentos:", err);
      secao.hidden = true; // falha: esconde em vez de mostrar erro ao visitante
    }
  }

  // ---------- botões de cadastro / login ----------
  function configurarCTAs() {
    const logado = lerStorage("userIsLoggedIn") === "true";
    const temDashboard = lerStorage("temDashboard") === "true";

    document.querySelectorAll("[data-cta-cadastro]").forEach((a) => {
      const label = a.querySelector("[data-cta-label]");
      if (logado && temDashboard) {
        a.href = CONFIG.DASHBOARD_URL;
        if (label) label.textContent = "Ir para o Painel";
      } else {
        a.href = CONFIG.CADASTRO_URL;
      }
    });

    // Quem já está logado não precisa do "Já Tenho Conta"
    document.querySelectorAll("[data-cta-login]").forEach((a) => { a.hidden = logado; });
  }

  document.addEventListener("DOMContentLoaded", () => {
    configurarCTAs();
    carregarEstatisticas();
    carregarDepoimentos();
  });
})();