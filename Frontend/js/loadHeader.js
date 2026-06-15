document.addEventListener("DOMContentLoaded", () => {
    fetch("/frontend/header/header.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("header-container").innerHTML = data;
            initHeader();
        })
        .catch(error => {
            console.error("Erro ao carregar header:", error);
        });
});

function initHeader() {

    // ----------------------------------------------------------
    // DADOS PERSISTENTES
    // ----------------------------------------------------------
    function loadPersistentData() {
        const photoUrl = localStorage.getItem('profilePhotoUrl');
        const name     = localStorage.getItem('profileName');
        const email    = localStorage.getItem('profileEmail');

        const headerPic    = document.getElementById('profile-pic-header');
        const dropdownName = document.querySelector('.dropdown-menu .user-info strong');
        const dropdownEmail= document.querySelector('.dropdown-menu .user-info span');
        const dropdownImg  = document.querySelector('.dropdown-menu .user-info img');

        const defaultAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23ede9ff'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%236C1DCE'/%3E%3Cellipse cx='20' cy='34' rx='12' ry='8' fill='%236C1DCE'/%3E%3C/svg%3E`;

        const avatarUrl = photoUrl || defaultAvatar;
        if (headerPic)     headerPic.src = avatarUrl;
        if (dropdownImg)   dropdownImg.src = avatarUrl;
        if (name  && dropdownName)  dropdownName.textContent  = name;
        if (email && dropdownEmail) dropdownEmail.textContent = email;
    }

    loadPersistentData();

    // ----------------------------------------------------------
    // BOTÃO PAINEL ADMIN (visível só para admins)
    // ----------------------------------------------------------
    function injetarBotaoAdmin() {
        let role = localStorage.getItem('userRole');
        if (!role) {
            try {
                const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
                if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    role = payload.role;
                }
            } catch (e) {}
        }
        if (role !== 'admin') return;

        const dropdownMenu = document.querySelector('.dropdown-menu');
        if (!dropdownMenu || document.getElementById('admin-panel-btn')) return;

        const adminLink = document.createElement('a');
        adminLink.id = 'admin-panel-btn';
        adminLink.href = '/frontend/admin/index.html';
        adminLink.innerHTML = `<i class="fas fa-shield-halved"></i> Painel Admin`;
        adminLink.style.cssText = `
            display:flex;align-items:center;gap:8px;padding:9px 16px;
            color:#6d28d9;font-weight:600;font-size:13.5px;text-decoration:none;
            border-top:1px solid #ede9ff;border-bottom:1px solid #ede9ff;
            background:#f5f0ff;transition:background 0.15s;
        `;
        adminLink.addEventListener('mouseenter', () => adminLink.style.background = '#ede9ff');
        adminLink.addEventListener('mouseleave', () => adminLink.style.background = '#f5f0ff');

        const logoutBtn = dropdownMenu.querySelector('.logout-btn');
        logoutBtn
            ? dropdownMenu.insertBefore(adminLink, logoutBtn)
            : dropdownMenu.appendChild(adminLink);
    }

    // ----------------------------------------------------------
    // ESTADO LOGADO / NÃO LOGADO
    // ----------------------------------------------------------
    function alternarEstadoHeader(logado) {
        const naoLogado    = document.getElementById('header-nao-logado');
        const logadoDiv    = document.getElementById('header-logado');
        const hamburgerBtn = document.getElementById('hamburger-btn');

        if (!naoLogado || !logadoDiv) return;

        if (logado) {
            naoLogado.style.display = 'none';
            logadoDiv.style.display = 'flex';
            if (hamburgerBtn) hamburgerBtn.style.display = 'flex';
            setupLogoutListener();
            injetarBotaoAdmin();
        } else {
            naoLogado.style.display = 'flex';
            logadoDiv.style.display = 'none';
            if (hamburgerBtn) hamburgerBtn.style.display = 'none';
        }
    }

    const logado = localStorage.getItem('userIsLoggedIn') === 'true';
    alternarEstadoHeader(logado);

    // ✅ Controla visibilidade do link Dashboard
    // (função definida em auth.js — carregado antes deste arquivo)
    if (typeof controlarLinkDashboard === 'function') {
        controlarLinkDashboard();
    }

    // ----------------------------------------------------------
    // LOGOUT
    // ----------------------------------------------------------
    function setupLogoutListener() {
        const logoutBtn = document.querySelector('.logout-btn');
        if (!logoutBtn || logoutBtn.dataset.listenerAdded) return;

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // ✅ 'temDashboard' incluído para limpar o cache
            ['userIsLoggedIn','profilePhotoUrl','profileName','profileEmail',
             'userRole','token','admin_token','temDashboard','userId','userType']
                .forEach(k => localStorage.removeItem(k));
            alternarEstadoHeader(false);
            window.location.href = '/frontend/login/logout.html';
        });

        logoutBtn.dataset.listenerAdded = 'true';
    }

    // ----------------------------------------------------------
    // DROPDOWN DE PERFIL
    // ----------------------------------------------------------
    const profileContainer = document.querySelector('.user-profile-container');
    if (profileContainer) {
        profileContainer.querySelector('.profile-avatar')?.addEventListener('click', (e) => {
            e.stopPropagation();
            profileContainer.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            const hbtn = document.getElementById('hamburger-btn');
            if (!profileContainer.contains(e.target) && e.target !== hbtn && !hbtn?.contains(e.target))
                profileContainer.classList.remove('active');
        });
    }

    // ----------------------------------------------------------
    // BOTÃO LOGIN
    // ----------------------------------------------------------
    const openLoginBtn = document.getElementById('openLogin');
    if (openLoginBtn) {
        const fresh = openLoginBtn.cloneNode(true);
        openLoginBtn.replaceWith(fresh);
        document.getElementById('openLogin').addEventListener('click', (e) => {
            e.preventDefault();
            const isHome = window.location.pathname.endsWith('index.html')
                || window.location.pathname.endsWith('/');
            if (isHome) window.postMessage('OPEN_LOGIN_MODAL', '*');
            else window.location.href = '/frontend/login/login.html';
        });
    }

    // ----------------------------------------------------------
    // HAMBURGER
    // ----------------------------------------------------------
    const hamburgerElement = document.getElementById('hamburger-btn');
    if (hamburgerElement) {
        hamburgerElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const pc = document.querySelector('.user-profile-container');
            if (pc) pc.classList.toggle('active');
        });
    }

    // ----------------------------------------------------------
    // CARD DE CIDADE
    // ----------------------------------------------------------
    const cityBtn    = document.querySelector('.city-btn');
    const cityCard   = document.getElementById('city-card');
    const overlay    = document.getElementById('city-overlay');
    const closeCard  = document.getElementById('close-card');
    const citySearch = document.getElementById('city-search');
    const useLocation= document.getElementById('use-location');
    const cityItems  = document.querySelectorAll('.city-list li');

    if (cityCard) document.body.appendChild(cityCard);
    if (overlay)  document.body.appendChild(overlay);

    const abrirCard  = () => { if (cityCard) cityCard.style.display = 'block'; if (overlay) overlay.style.display = 'block'; };
    const fecharCard = () => { if (cityCard) cityCard.style.display = 'none';  if (overlay) overlay.style.display = 'none';  };

    function selecionarCidade(nome) {
        if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${nome}`;
        localStorage.setItem('cidade', nome);
        fecharCard();
    }

    cityBtn?.addEventListener('click', abrirCard);
    closeCard?.addEventListener('click', fecharCard);
    overlay?.addEventListener('click', fecharCard);
    cityItems.forEach(i => i.addEventListener('click', () => selecionarCidade(i.dataset.city)));

    const savedCity = localStorage.getItem('cidade');
    if (savedCity && cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${savedCity}`;

    citySearch?.addEventListener('input', () => {
        const val = citySearch.value.toLowerCase();
        cityItems.forEach(i => {
            i.style.display = i.dataset.city.toLowerCase().includes(val) ? 'flex' : 'none';
        });
    });

    if (useLocation) {
        useLocation.addEventListener('click', () => {
            if (!navigator.geolocation) { alert('Geolocalização não suportada pelo seu navegador.'); return; }
            if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Buscando...`;

            navigator.geolocation.getCurrentPosition(
                async ({ coords: { latitude, longitude } }) => {
                    try {
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
                            { headers: { Accept: 'application/json' } }
                        );
                        const data = await res.json();
                        const cityName = data.address?.city || data.address?.town ||
                            data.address?.village || data.address?.municipality ||
                            data.address?.state || 'Localização atual';
                        selecionarCidade(cityName);
                    } catch (err) {
                        console.error('Erro ao buscar cidade:', err);
                        selecionarCidade('Minha localização');
                    }
                },
                (err) => {
                    console.warn('Geolocalização negada:', err.message);
                    if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Localização`;
                    alert('Permita o acesso à localização para usar essa função.');
                },
                { timeout: 10000, maximumAge: 300000 }
            );
        });
    }

    // ----------------------------------------------------------
    // DROPDOWN DE BUSCA
    // ----------------------------------------------------------
    const searchInput   = document.getElementById('search-input');
    const searchWrapper = document.getElementById('search-bar-wrapper');
    const suggestionsBox= document.getElementById('search-suggestions');
    const btnBuscar     = document.getElementById('btn-buscar');

    const CHAVE_RECENTES = 'buscasRecentes';
    const MAX_RECENTES   = 5;
    const MAX_SUGESTOES  = 6;

    const icones = {
        'show':'fa-music','música':'fa-music','festa':'fa-glass-cheers',
        'bar':'fa-cocktail','restaurante':'fa-utensils','teatro':'fa-theater-masks',
        'esporte':'fa-futbol','balada':'fa-music','stand-up':'fa-microphone',
        'arte':'fa-palette','default':'fa-calendar-alt',
    };
    const getIcone = (cat) => icones[(cat||'').toLowerCase()] || icones['default'];
    const norm = (s) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

    function getRecentes() { try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES)) || []; } catch { return []; } }
    function salvarRecente(termo) {
        if (!termo.trim()) return;
        let r = getRecentes().filter(x => norm(x) !== norm(termo));
        r.unshift(termo.trim());
        localStorage.setItem(CHAVE_RECENTES, JSON.stringify(r.slice(0, MAX_RECENTES)));
    }
    function removerRecente(termo) {
        localStorage.setItem(CHAVE_RECENTES, JSON.stringify(getRecentes().filter(x => norm(x) !== norm(termo))));
    }

    function lerCardsDaPagina() {
        const itens = [];
        document.querySelectorAll('.card-local, .card-evento, .card').forEach(card => {
            const nome      = card.querySelector('h3')?.textContent.trim() || '';
            const local     = card.querySelector('.evento-local, .local')?.textContent.trim() || '';
            const tagEl     = card.querySelector('[class*="tag"]');
            const categoria = tagEl?.textContent.trim() || card.getAttribute('data-categoria-card') || '';
            const data      = card.querySelector('.evento-data-local p, .local-meta p')?.textContent.trim() || '';
            if (nome) itens.push({ nome, local, categoria, data });
        });
        return itens;
    }

    function filtrarSugestoes(termo) {
        const t = norm(termo);
        return lerCardsDaPagina()
            .filter(i => norm(i.nome).includes(t) || norm(i.categoria).includes(t) || norm(i.local).includes(t))
            .slice(0, MAX_SUGESTOES);
    }

    function destacar(txt, termo) {
        if (!termo) return txt;
        return txt.replace(new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<mark>$1</mark>');
    }

    const abrirDropdown  = () => suggestionsBox?.classList.add('active');
    const fecharDropdown = () => suggestionsBox?.classList.remove('active');

    function renderVazio() {
        if (!suggestionsBox) return;
        const recentes = getRecentes();
        if (!recentes.length) { fecharDropdown(); return; }
        suggestionsBox.innerHTML = `<div class="sug-section-title"><span>Buscas recentes</span></div><ul class="sug-list" id="sug-recentes-list"></ul>`;
        const ul = suggestionsBox.querySelector('#sug-recentes-list');
        recentes.forEach(termo => {
            const li = document.createElement('li');
            li.className = 'sug-item sug-recente';
            li.innerHTML = `<div class="sug-left"><i class="fas fa-clock-rotate-left sug-icon-recente"></i><span class="sug-texto">${termo}</span></div><button class="sug-remover" aria-label="Remover"><i class="fas fa-times"></i></button>`;
            li.querySelector('.sug-left').addEventListener('click', () => { if (searchInput) searchInput.value = termo; fecharDropdown(); dispararBusca(); });
            li.querySelector('.sug-remover').addEventListener('click', (e) => { e.stopPropagation(); removerRecente(termo); renderVazio(); });
            ul.appendChild(li);
        });
        abrirDropdown();
    }

    function renderSugestoes(termo) {
        if (!suggestionsBox) return;
        const resultados = filtrarSugestoes(termo);
        suggestionsBox.innerHTML = '';
        if (resultados.length) {
            const secTitle = document.createElement('div');
            secTitle.className = 'sug-section-title';
            secTitle.innerHTML = '<span>Sugestões</span>';
            suggestionsBox.appendChild(secTitle);
            const ul = document.createElement('ul');
            ul.className = 'sug-list';
            resultados.forEach(item => {
                const li = document.createElement('li');
                li.className = 'sug-item sug-evento';
                li.innerHTML = `<div class="sug-left"><div class="sug-icon-evento"><i class="fas ${getIcone(item.categoria)}"></i></div><div class="sug-info"><span class="sug-nome">${destacar(item.nome,termo)}</span><span class="sug-meta">${item.categoria?`<span class="sug-badge">${item.categoria}</span>`:''} ${item.local?`<i class="fas fa-map-marker-alt"></i>${item.local}`:''}</span></div></div><i class="fas fa-arrow-up-left sug-completar"></i>`;
                li.querySelector('.sug-left').addEventListener('click', () => { if (searchInput) searchInput.value = item.nome; salvarRecente(item.nome); fecharDropdown(); dispararBusca(); });
                li.querySelector('.sug-completar').addEventListener('click', (e) => { e.stopPropagation(); if (searchInput) searchInput.value = item.nome; searchInput?.focus(); renderSugestoes(item.nome); });
                ul.appendChild(li);
            });
            suggestionsBox.appendChild(ul);
        }
        const rodape = document.createElement('div');
        rodape.className = 'sug-rodape';
        rodape.innerHTML = `<i class="fas fa-search"></i><span>Buscar por <strong>"${termo}"</strong></span>`;
        rodape.addEventListener('click', () => { salvarRecente(termo); fecharDropdown(); dispararBusca(); });
        suggestionsBox.appendChild(rodape);
        abrirDropdown();
    }

    if (searchInput) {
        searchInput.addEventListener('focus', () => { const t = searchInput.value.trim(); if (t.length < 2) renderVazio(); else renderSugestoes(t); });
        searchInput.addEventListener('input', () => { const t = searchInput.value.trim(); dispararFiltroDireto(t); if (t.length < 2) renderVazio(); else renderSugestoes(t); });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { salvarRecente(searchInput.value.trim()); fecharDropdown(); dispararBusca(); }
            if (e.key === 'Escape') fecharDropdown();
        });
    }

    document.addEventListener('click', (e) => { if (searchWrapper && !searchWrapper.contains(e.target)) fecharDropdown(); });
    btnBuscar?.addEventListener('click', () => { if (searchInput?.value.trim()) salvarRecente(searchInput.value.trim()); fecharDropdown(); dispararBusca(); });

    function dispararFiltroDireto(termo) {
        window.dispatchEvent(new CustomEvent('roles:filtrar', { detail: { termo: termo.trim() } }));
    }

    function dispararBusca() {
        const termo  = searchInput?.value.trim() || '';
        const cidade = localStorage.getItem('cidade') || 'Minha localização';
        localStorage.setItem('filtrosRoles', JSON.stringify({ termo, cidade }));
        const naHome = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
        if (naHome) dispararFiltroDireto(termo);
        else window.location.href = '/frontend/index.html';
    }

    window.dispararBusca = dispararBusca;
}