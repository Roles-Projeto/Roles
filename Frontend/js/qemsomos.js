/* ============================================================
   Quem somos | números da plataforma

   Como funciona:
   - Cada card (.qs-stat) já vem com um texto de apresentação no HTML.
   - Este script busca os números reais na API (GET /api/estatisticas).
   - Se o número for maior ou igual ao mínimo (data-min, padrão 10),
     o card troca o texto pelo número, com animação de contagem.
   - Se a API falhar ou o número ainda for pequeno, o texto de
     apresentação continua na tela (nunca aparece "0+").

   Formato esperado da resposta da API:
   { "estabelecimentos": 12, "usuarios": 80, "avaliacoes": 150, "eventos": 30 }
   ============================================================ */
(function () {
    'use strict';

    const MIN_PADRAO = 10;
    const TIMEOUT_MS = 6000;
    const DURACAO_MS = 1400;

    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Descobre o endereço do backend.
    // 1) usa o que o config.js definir (se existir)
    // 2) se a página estiver no Live Server (portas 5500-5509), usa o backend em localhost:3000
    // 3) senão, usa caminho relativo (front e back no mesmo servidor)
    function descobrirApiBase() {
        const cfg =
            window.API_URL ||
            window.API_BASE_URL ||
            window.API_BASE ||
            (window.CONFIG && (window.CONFIG.API_URL || window.CONFIG.API_BASE_URL));

        if (cfg) return String(cfg).replace(/\/$/, '');
        if (/^55\d\d$/.test(window.location.port)) return 'http://localhost:3000';
        return '';
    }

    async function buscarEstatisticas() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const resp = await fetch(descobrirApiBase() + '/api/estatisticas', {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);

            const json = await resp.json();
            return json.estatisticas || json.data || json;
        } finally {
            clearTimeout(timer);
        }
    }

    function formatar(n) {
        return n.toLocaleString('pt-BR') + '+';
    }

    function animarContagem(el, alvo) {
        if (reduzMovimento) {
            el.textContent = formatar(alvo);
            return;
        }

        const inicio = performance.now();
        function passo(agora) {
            const t = Math.min((agora - inicio) / DURACAO_MS, 1);
            const suave = 1 - Math.pow(1 - t, 3); // easeOutCubic
            el.textContent = formatar(Math.round(alvo * suave));
            if (t < 1) requestAnimationFrame(passo);
        }
        requestAnimationFrame(passo);
    }

    function aplicar(card, valor) {
        const numEl = card.querySelector('.qs-stat-num');
        const labelEl = card.querySelector('.qs-stat-label');
        const min = Number(card.dataset.min) || MIN_PADRAO;

        // número ainda pequeno ou inválido: mantém o texto de apresentação
        if (!Number.isFinite(valor) || valor < min) return;

        labelEl.textContent = card.dataset.label;
        numEl.textContent = formatar(0);

        // só anima quando o card aparece na tela
        if ('IntersectionObserver' in window) {
            const obs = new IntersectionObserver((entradas) => {
                if (entradas[0].isIntersecting) {
                    obs.disconnect();
                    animarContagem(numEl, valor);
                }
            }, { threshold: 0.4 });
            obs.observe(card);
        } else {
            animarContagem(numEl, valor);
        }
    }

    async function iniciar() {
        const cards = document.querySelectorAll('.qs-stat[data-stat]');
        if (!cards.length) return;

        try {
            const dados = await buscarEstatisticas();
            cards.forEach((card) => aplicar(card, Number(dados[card.dataset.stat])));
        } catch (erro) {
            // sem API: os textos de apresentação continuam visíveis
            console.warn('[Quem somos] Não foi possível carregar os números:', erro.message);
        }
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();