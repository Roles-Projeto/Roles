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
        const name = localStorage.getItem('profileName');
        const email = localStorage.getItem('profileEmail');

        const headerPic = document.getElementById('profile-pic-header');
        const dropdownName = document.querySelector('.dropdown-menu .user-info strong');
        const dropdownEmail = document.querySelector('.dropdown-menu .user-info span');
        const dropdownImg = document.querySelector('.dropdown-menu .user-info img');

        const defaultAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23ede9ff'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%236C1DCE'/%3E%3Cellipse cx='20' cy='34' rx='12' ry='8' fill='%236C1DCE'/%3E%3C/svg%3E`;

        const avatarUrl = photoUrl || defaultAvatar;
        if (headerPic) headerPic.src = avatarUrl;
        if (dropdownImg) dropdownImg.src = avatarUrl;
        if (name && dropdownName) dropdownName.textContent = name;
        if (email && dropdownEmail) dropdownEmail.textContent = email;
    }

    loadPersistentData();

    // ----------------------------------------------------------
    // BOTÃO PAINEL ADMIN
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
            } catch (e) { }
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
        const naoLogado = document.getElementById('header-nao-logado');
        const logadoDiv = document.getElementById('header-logado');
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
            ['userIsLoggedIn', 'profilePhotoUrl', 'profileName', 'profileEmail',
                'userRole', 'token', 'admin_token', 'temDashboard', 'userId', 'userType']
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
    const cityBtnMobile = document.getElementById('cityBtnMobile');
    const cityCard   = document.getElementById('city-card');
    const overlay    = document.getElementById('city-overlay');
    const closeCard  = document.getElementById('close-card');
    const citySearch = document.getElementById('city-search');
    const useLocation = document.getElementById('use-location');
    const cityItems = document.querySelectorAll('.city-list li');

    if (cityCard) document.body.appendChild(cityCard);
    if (overlay) document.body.appendChild(overlay);

    const abrirCard = () => { if (cityCard) cityCard.style.display = 'block'; if (overlay) overlay.style.display = 'block'; };
    const fecharCard = () => { if (cityCard) cityCard.style.display = 'none'; if (overlay) overlay.style.display = 'none'; };

    function selecionarCidade(nome) {
        if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${nome}`;
        if (cityBtnMobile) cityBtnMobile.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${nome}`;
        localStorage.setItem('cidade', nome);
        fecharCard();
    }

    cityBtn?.addEventListener('click', abrirCard);
    cityBtnMobile?.addEventListener('click', abrirCard);
    closeCard?.addEventListener('click', fecharCard);
    overlay?.addEventListener('click', fecharCard);
    cityItems.forEach(i => i.addEventListener('click', () => selecionarCidade(i.dataset.city)));

    const savedCity = localStorage.getItem('cidade');
    if (savedCity && cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${savedCity}`;
    if (savedCity && cityBtnMobile) cityBtnMobile.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${savedCity}`;

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
    // BUSCA COM SUGESTÕES DA API
    // ----------------------------------------------------------
    const searchInput = document.getElementById('search-input');
    const searchWrapper = document.getElementById('search-bar-wrapper');
    const suggestionsBox= document.getElementById('search-suggestions');
    const btnBuscar     = document.getElementById('btn-buscar');
    const searchInputMobile = document.getElementById('search-input-mobile');

    // ----------------------------------------------------------
    // BOTÃO LUPA MOBILE (abre/fecha a barra de busca mobile)
    // ----------------------------------------------------------
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchBarMobile = document.getElementById('searchBarMobile');

    if (searchToggleBtn && searchBarMobile) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchBarMobile.classList.toggle('open');
            searchToggleBtn.classList.toggle('active');
            if (searchBarMobile.classList.contains('open')) {
                searchInputMobile?.focus();
            }
        });

        document.addEventListener('click', (e) => {
            if (
                !searchBarMobile.contains(e.target) &&
                !searchToggleBtn.contains(e.target)
            ) {
                searchBarMobile.classList.remove('open');
                searchToggleBtn.classList.remove('active');
            }
        });
    }

    const CHAVE_RECENTES = 'buscasRecentes';
    const MAX_RECENTES = 5;
    const MAX_SUGESTOES = 4; // máximo por tipo (eventos e locais)

    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Cache para não buscar toda vez na API
    let cacheEventos = null;
    let cacheLocais = null;

    async function carregarDados() {
        try {
            if (!cacheEventos) {
                const res = await fetch(`${window.API_BASE}/eventos`);
                cacheEventos = await res.json();
            }
            if (!cacheLocais) {
                const res = await fetch(`${window.API_BASE}/estabelecimentos`);
                cacheLocais = await res.json();
            }
        } catch (e) {
            console.error('Erro ao carregar dados para busca:', e);
        }
    }

    // Carrega em background assim que o header inicia
    carregarDados();

    function getRecentes() {
        try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES)) || []; } catch { return []; }
    }
    function salvarRecente(termo) {
        if (!termo.trim()) return;
        let r = getRecentes().filter(x => norm(x) !== norm(termo));
        r.unshift(termo.trim());
        localStorage.setItem(CHAVE_RECENTES, JSON.stringify(r.slice(0, MAX_RECENTES)));
    }
    function removerRecente(termo) {
        localStorage.setItem(CHAVE_RECENTES, JSON.stringify(
            getRecentes().filter(x => norm(x) !== norm(termo))
        ));
    }

    function destacar(txt, termo) {
        if (!termo) return txt;
        return txt.replace(
            new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark>$1</mark>'
        );
    }

    const abrirDropdown = () => suggestionsBox?.classList.add('active');
    const fecharDropdown = () => suggestionsBox?.classList.remove('active');

    // Renderiza buscas recentes (campo vazio)
    function renderVazio() {
        if (!suggestionsBox) return;
        const recentes = getRecentes();
        if (!recentes.length) { fecharDropdown(); return; }

        suggestionsBox.innerHTML = `
            <div class="sug-section-title"><span>Buscas recentes</span></div>
            <ul class="sug-list" id="sug-recentes-list"></ul>
        `;
        const ul = suggestionsBox.querySelector('#sug-recentes-list');
        recentes.forEach(termo => {
            const li = document.createElement('li');
            li.className = 'sug-item sug-recente';
            li.innerHTML = `
                <div class="sug-left">
                    <i class="fas fa-clock-rotate-left sug-icon-recente"></i>
                    <span class="sug-texto">${termo}</span>
                </div>
                <button class="sug-remover" aria-label="Remover"><i class="fas fa-times"></i></button>
            `;
            li.querySelector('.sug-left').addEventListener('click', () => {
                if (searchInput) searchInput.value = termo;
                buscarEDirecionar(termo);
            });
            li.querySelector('.sug-remover').addEventListener('click', (e) => {
                e.stopPropagation();
                removerRecente(termo);
                renderVazio();
            });
            ul.appendChild(li);
        });
        abrirDropdown();
    }

    // Renderiza sugestões com dados da API
    async function renderSugestoes(termo) {
        if (!suggestionsBox) return;

        await carregarDados();

        const t = norm(termo);

        const eventos = (cacheEventos || [])
            .filter(e => norm(e.nome).includes(t) || norm(e.assunto || '').includes(t))
            .slice(0, MAX_SUGESTOES);

        const locais = (cacheLocais || [])
            .filter(l => norm(l.nome).includes(t) || norm(l.tipo || '').includes(t))
            .slice(0, MAX_SUGESTOES);

        suggestionsBox.innerHTML = '';

        const temResultados = eventos.length > 0 || locais.length > 0;

        // ── SEÇÃO EVENTOS ──
        if (eventos.length > 0) {
            const secTitle = document.createElement('div');
            secTitle.className = 'sug-section-title';
            secTitle.innerHTML = '<span>Eventos</span>';
            suggestionsBox.appendChild(secTitle);

            const ul = document.createElement('ul');
            ul.className = 'sug-list';

            eventos.forEach(evento => {
                const data = evento.data_inicio
                    ? new Date(evento.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    : '';
                const li = document.createElement('li');
                li.className = 'sug-item sug-evento';
                li.innerHTML = `
                    <div class="sug-left">
                        <div class="sug-icon-evento"><i class="fas fa-calendar-alt"></i></div>
                        <div class="sug-info">
                            <span class="sug-nome">${destacar(evento.nome, termo)}</span>
                            <span class="sug-meta">
                                ${evento.assunto ? `<span class="sug-badge">${evento.assunto}</span>` : ''}
                                ${data ? `<i class="fas fa-calendar"></i>${data}` : ''}
                            </span>
                        </div>
                    </div>
                    <i class="fas fa-arrow-up-left sug-completar"></i>
                `;
                li.querySelector('.sug-left').addEventListener('click', () => {
                    salvarRecente(evento.nome);
                    fecharDropdown();
                    window.location.href = `/frontend/detalheseventos/detalheevento.html?id=${evento.id}`;
                });
                li.querySelector('.sug-completar').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchInput) searchInput.value = evento.nome;
                    searchInput?.focus();
                    renderSugestoes(evento.nome);
                });
                ul.appendChild(li);
            });

            suggestionsBox.appendChild(ul);
        }

        // ── SEÇÃO LOCAIS ──
        if (locais.length > 0) {
            const secTitle2 = document.createElement('div');
            secTitle2.className = 'sug-section-title';
            secTitle2.style.borderTop = eventos.length > 0 ? '1px solid #f0f0f0' : 'none';
            secTitle2.style.paddingTop = eventos.length > 0 ? '10px' : '10px';
            secTitle2.innerHTML = '<span>Locais</span>';
            suggestionsBox.appendChild(secTitle2);

            const ul2 = document.createElement('ul');
            ul2.className = 'sug-list';

            locais.forEach(local => {
                const li = document.createElement('li');
                li.className = 'sug-item sug-evento';
                li.innerHTML = `
                    <div class="sug-left">
                        <div class="sug-icon-evento"><i class="fas fa-map-marker-alt"></i></div>
                        <div class="sug-info">
                            <span class="sug-nome">${destacar(local.nome, termo)}</span>
                            <span class="sug-meta">
                                ${local.tipo ? `<span class="sug-badge">${local.tipo}</span>` : ''}
                                ${local.bairro ? `<i class="fas fa-map-marker-alt"></i>${local.bairro}` : ''}
                            </span>
                        </div>
                    </div>
                    <i class="fas fa-arrow-up-left sug-completar"></i>
                `;
                li.querySelector('.sug-left').addEventListener('click', () => {
                    salvarRecente(local.nome);
                    fecharDropdown();
                    window.location.href = `/frontend/detalheslocais/detalheslocais.html?id=${local.id}`;
                });
                li.querySelector('.sug-completar').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchInput) searchInput.value = local.nome;
                    searchInput?.focus();
                    renderSugestoes(local.nome);
                });
                ul2.appendChild(li);
            });

            suggestionsBox.appendChild(ul2);
        }

        // Nenhum resultado — só uma mensagem informativa, sem ação
        if (!temResultados) {
            const rodape = document.createElement('div');
            rodape.className = 'sug-rodape';
            rodape.innerHTML = `<i class="fas fa-search"></i><span>Nenhum resultado para <strong>"${termo}"</strong></span>`;
            suggestionsBox.appendChild(rodape);
        }

        abrirDropdown();
    }

    function dispararFiltroDireto(termo) {
        window.dispatchEvent(new CustomEvent('roles:filtrar', { detail: { termo: termo.trim() } }));
    }

    // Decide o que fazer com a busca:
    // - bateu em exatamente 1 evento/local -> vai direto pro detalhe
    // - bateu em 0 ou mais de 1 -> não navega, mantém o dropdown aberto
    //   com as opções pra pessoa escolher
    async function buscarEDirecionar(termo) {
        if (!termo.trim()) return;

        await carregarDados();
        const t = norm(termo);

        const eventosBate = (cacheEventos || []).filter(e =>
            norm(e.nome).includes(t) || norm(e.assunto || '').includes(t)
        );
        const locaisBate = (cacheLocais || []).filter(l =>
            norm(l.nome).includes(t) || norm(l.tipo || '').includes(t)
        );

        const totalBate = eventosBate.length + locaisBate.length;

        if (totalBate === 1) {
            salvarRecente(termo);
            fecharDropdown();
            if (eventosBate.length === 1) {
                window.location.href = `/frontend/detalheseventos/detalheevento.html?id=${eventosBate[0].id}`;
            } else {
                window.location.href = `/frontend/detalheslocais/detalheslocais.html?id=${locaisBate[0].id}`;
            }
            return;
        }

        if (searchInput) searchInput.value = termo;
        renderSugestoes(termo);
    }

    function dispararBusca() {
        const termo = searchInput?.value.trim() || '';
        buscarEDirecionar(termo);
    }

    // ----------------------------------------------------------
    // BUSCA MOBILE — mesmo comportamento do desktop
    // ----------------------------------------------------------
    if (searchInputMobile) {
        searchInputMobile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const termo = searchInputMobile.value.trim();
                buscarEDirecionar(termo);
            }
        });
    }

    // Eventos do input (desktop)
    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            const t = searchInput.value.trim();
            if (t.length < 2) renderVazio();
            else renderSugestoes(t);
        });

        searchInput.addEventListener('input', () => {
            const t = searchInput.value.trim();

            if (t.length < 2) renderVazio();
            else renderSugestoes(t);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dispararBusca();
            }
            if (e.key === 'Escape') fecharDropdown();
        });
    }

    document.addEventListener('click', (e) => {
        if (searchWrapper && !searchWrapper.contains(e.target)) fecharDropdown();
    });

    btnBuscar?.addEventListener('click', () => {
        dispararBusca();
    });
}