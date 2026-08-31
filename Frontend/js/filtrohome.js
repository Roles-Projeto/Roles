"use strict";

// ============================================================
// filtro-home.js
// Ouve o evento 'roles:filtrar' disparado pelo header.js e
// filtra os cards .card-local e .card-evento do index.html
// sem recarregar a página.
// ============================================================

(function () {

    // ----------------------------------------------------------
    // NORMALIZA TEXTO (remove acentos, minúsculas)
    // ----------------------------------------------------------
    function norm(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // ----------------------------------------------------------
    // EXTRAI TEXTO PESQUISÁVEL DE UM CARD
    // ----------------------------------------------------------
    function textoDoCard(card) {
        const nome      = card.querySelector('h3')?.textContent || '';
        const local     = card.querySelector('.evento-local, .local')?.textContent || '';
        const data      = card.querySelector('.evento-data-local p, .local-meta p')?.textContent || '';
        const categoria = card.querySelector('[class*="tag"]')?.textContent
                       || card.getAttribute('data-categoria-card') || '';

        return norm(`${nome} ${local} ${data} ${categoria}`);
    }

    // ----------------------------------------------------------
    // ESTADO DE VISIBILIDADE DOS CARDS
    // ----------------------------------------------------------
    let estadoOriginal = null;

    function salvarEstadoOriginal() {
        if (estadoOriginal) return;
        estadoOriginal = new Map();
        document.querySelectorAll('.card-local, .card-evento').forEach(card => {
            estadoOriginal.set(card, card.style.display || '');
        });
    }

    // ----------------------------------------------------------
    // APLICA O FILTRO
    // ----------------------------------------------------------
    function filtrar(termo) {
        salvarEstadoOriginal();

        const termoNorm = norm(termo);
        let totalVisiveis = 0;

        estadoOriginal.forEach((displayOriginal, card) => {
            const bate = termoNorm === '' || textoDoCard(card).includes(termoNorm);
            card.style.display = bate ? displayOriginal : 'none';
            if (bate) totalVisiveis++;
        });

        gerenciarSecoes(termoNorm);
        atualizarMensagemVazia(termoNorm, totalVisiveis);

        // ✅ CORREÇÃO: scrollIntoView removido — era ele que jogava a página para baixo ao digitar
    }

    // Esconde seções onde TODOS os cards estão ocultos
    function gerenciarSecoes(termoNorm) {
        ['.section-populares', '.section-eventos'].forEach(seletorSecao => {
            const secao = document.querySelector(seletorSecao);
            if (!secao) return;

            const cards = secao.querySelectorAll('.card-local, .card-evento');
            const algumVisivel = Array.from(cards).some(c => c.style.display !== 'none');

            secao.style.display = algumVisivel || termoNorm === '' ? '' : 'none';
        });
    }

    // Cria/remove a mensagem de "nenhum resultado"
    function atualizarMensagemVazia(termoNorm, totalVisiveis) {
        const ID_MSG = 'roles-sem-resultado';
        let msg = document.getElementById(ID_MSG);

        if (termoNorm !== '' && totalVisiveis === 0) {
            if (!msg) {
                msg = document.createElement('div');
                msg.id = ID_MSG;
                msg.style.cssText = `
                    text-align: center;
                    padding: 60px 20px;
                    color: #888;
                    font-family: 'Poppins', sans-serif;
                `;
                msg.innerHTML = `
                    <i class="fas fa-search" style="font-size:2.5rem;color:#ccc;margin-bottom:16px;display:block;"></i>
                    <p style="font-size:1.1rem;font-weight:600;color:#444;margin:0 0 8px;">Nenhum resultado encontrado</p>
                    <p style="font-size:0.9rem;margin:0;">Tente buscar por outro nome, categoria ou local.</p>
                `;

                const faq = document.querySelector('.faq');
                if (faq) faq.before(msg);
                else document.querySelector('main')?.appendChild(msg);
            }
        } else {
            msg?.remove();
        }
    }

    // ----------------------------------------------------------
    // OUVE O EVENTO DISPARADO PELO HEADER
    // ----------------------------------------------------------
    window.addEventListener('roles:filtrar', (e) => {
        const termo = e.detail?.termo ?? '';
        filtrar(termo);
    });

    // ----------------------------------------------------------
    // AO CARREGAR A PÁGINA: verifica se veio com filtro salvo
    // ----------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        const filtrosSalvos = localStorage.getItem('filtrosRoles');
        if (!filtrosSalvos) return;

        try {
            const { termo } = JSON.parse(filtrosSalvos);
            if (!termo) return;

            const input = document.getElementById('search-input');
            if (input) input.value = termo;

            setTimeout(() => filtrar(termo), 100);

            localStorage.removeItem('filtrosRoles');
        } catch (_) {}
    });

})();