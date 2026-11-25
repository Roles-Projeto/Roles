/* ==========================================================
   TEMA CLARO / ESCURO — Rolês
   - Guarda a escolha em localStorage ("roles_tema": "light" | "dark")
   - Aplica data-theme="light|dark" no <html>
   - Funciona com o botão #themeToggleBtn do header, mesmo
     ele sendo carregado depois (usa delegação de clique)
========================================================== */
(function () {
    // Evita rodar duas vezes se o arquivo for carregado em mais de um lugar
    if (window.__rolesTemaIniciado) return;
    window.__rolesTemaIniciado = true;

    const CHAVE = 'roles_tema';

    function lerTemaSalvo() {
        try {
            const t = localStorage.getItem(CHAVE);
            if (t === 'dark' || t === 'light') return t;
        } catch (e) { /* localStorage indisponível: segue no claro */ }
        return 'light';
    }

    function temaAtual() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    // Atualiza texto de acessibilidade do botão (quando ele já existe na página)
    function atualizarBotao() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const escuro = temaAtual() === 'dark';
        btn.setAttribute('aria-label', escuro ? 'Ativar modo claro' : 'Ativar modo escuro');
        btn.setAttribute('title', escuro ? 'Modo claro' : 'Modo escuro');
    }

    function aplicarTema(tema, salvar) {
        const t = tema === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);

        if (salvar) {
            try { localStorage.setItem(CHAVE, t); } catch (e) { /* ignora */ }
        }

        atualizarBotao();

        // Avisa o resto do site (útil para páginas que desenham gráficos, mapas etc.)
        window.dispatchEvent(new CustomEvent('roles:tema', { detail: { tema: t } }));
    }

    function alternarTema() {
        aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark', true);
    }

    // 1) Aplica o tema salvo o quanto antes
    aplicarTema(lerTemaSalvo(), false);

    // 2) Clique no botão do header (o header entra na página via fetch, por isso delegação)
    document.addEventListener('click', function (e) {
        const btn = e.target.closest && e.target.closest('#themeToggleBtn');
        if (!btn) return;
        alternarTema();
    });

    // 3) Quando o header terminar de carregar, ajusta os textos do botão
    const observador = new MutationObserver(function () {
        if (document.getElementById('themeToggleBtn')) {
            atualizarBotao();
            observador.disconnect();
        }
    });
    observador.observe(document.documentElement, { childList: true, subtree: true });

    // 4) Se o tema mudar em outra aba, acompanha
    window.addEventListener('storage', function (e) {
        if (e.key === CHAVE && (e.newValue === 'dark' || e.newValue === 'light')) {
            aplicarTema(e.newValue, false);
        }
    });

    // Deixa disponível para outros scripts, se precisar
    window.RolesTema = { aplicar: (t) => aplicarTema(t, true), alternar: alternarTema, atual: temaAtual };
})();