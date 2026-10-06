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
    const cityBtn = document.querySelector('.city-btn');
    const cityBtnMobile = document.getElementById('cityBtnMobile');
    const cityCard = document.getElementById('city-card');
    const overlay = document.getElementById('city-overlay');
    const closeCard = document.getElementById('close-card');
    const citySearch = document.getElementById('city-search');
    const useLocation = document.getElementById('use-location');

    if (cityCard) document.body.appendChild(cityCard);
    if (overlay) document.body.appendChild(overlay);

    // Lista de cidades (se não existir no HTML, cria uma)
    let cityList = cityCard ? cityCard.querySelector('.city-list') : null;
    if (cityCard && !cityList) {
        cityList = document.createElement('ul');
        cityList.className = 'city-list';
        cityCard.appendChild(cityList);
    }

    // ---- Cidades em destaque (aparecem quando o campo está vazio) ----
    const DESTAQUES = [
        { nome: 'Goiânia', uf: 'GO' },
        { nome: 'Aparecida de Goiânia', uf: 'GO' },
        { nome: 'Senador Canedo', uf: 'GO' },
        { nome: 'Trindade', uf: 'GO' },
        { nome: 'Caldas Novas', uf: 'GO' },
        { nome: 'Pirenópolis', uf: 'GO' },
        { nome: 'Goiás', uf: 'GO', apelido: 'Goiás Velho' },
        { nome: 'Nova Veneza', uf: 'GO' },
        { nome: 'Terezópolis de Goiás', uf: 'GO' },
        { nome: 'Brasília', uf: 'DF' }
    ];

    // ---- Opção para tirar o filtro e ver os eventos de todas as cidades ----
    const TODAS = { nome: 'Todas as cidades', uf: '', todas: true };

    // ---- As 27 capitais do Brasil ----
    const CAPITAIS = [
        ['Rio Branco', 'AC'], ['Maceió', 'AL'], ['Macapá', 'AP'], ['Manaus', 'AM'],
        ['Salvador', 'BA'], ['Fortaleza', 'CE'], ['Brasília', 'DF'], ['Vitória', 'ES'],
        ['Goiânia', 'GO'], ['São Luís', 'MA'], ['Cuiabá', 'MT'], ['Campo Grande', 'MS'],
        ['Belo Horizonte', 'MG'], ['Belém', 'PA'], ['João Pessoa', 'PB'], ['Curitiba', 'PR'],
        ['Recife', 'PE'], ['Teresina', 'PI'], ['Rio de Janeiro', 'RJ'], ['Natal', 'RN'],
        ['Porto Alegre', 'RS'], ['Porto Velho', 'RO'], ['Boa Vista', 'RR'],
        ['Florianópolis', 'SC'], ['São Paulo', 'SP'], ['Aracaju', 'SE'], ['Palmas', 'TO']
    ].map(([nome, uf]) => ({ nome, uf }));

    // ---- API do IBGE (gratuita, sem chave) ----
    const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';
    const CIDADES_CACHE = 'roles_cidades_v1_';

    let cidadesRegiao = [];   // todas de Goiás + DF
    let cidadesBrasil = [];   // todas do Brasil (carrega só quando a pessoa digita)
    let carregouBrasil = false;
    let carregandoBrasil = false;

    const normalizarCidade = (s) =>
        (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    function lerCacheCidades(chave) {
        try {
            const bruto = localStorage.getItem(CIDADES_CACHE + chave);
            return bruto ? JSON.parse(bruto) : null;
        } catch (e) { return null; }
    }

    function salvarCacheCidades(chave, dados) {
        try { localStorage.setItem(CIDADES_CACHE + chave, JSON.stringify(dados)); } catch (e) { }
    }

    function mapearMunicipios(municipios) {
        return municipios.map((m) => ({
            nome: m.nome,
            uf: (m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF && m.microrregiao.mesorregiao.UF.sigla)
                || (m['regiao-imediata'] && m['regiao-imediata']['regiao-intermediaria'] && m['regiao-imediata']['regiao-intermediaria'].UF && m['regiao-imediata']['regiao-intermediaria'].UF.sigla)
                || ''
        }));
    }

    async function buscarMunicipios(url, chave) {
        const cache = lerCacheCidades(chave);
        if (cache) return cache;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Erro ao buscar cidades no IBGE');
        const dados = mapearMunicipios(await resp.json());
        salvarCacheCidades(chave, dados);
        return dados;
    }

    async function carregarRegiao() {
        if (cidadesRegiao.length) return;
        try {
            const [go, df] = await Promise.all([
                buscarMunicipios(`${IBGE_URL}/estados/52/municipios`, 'GO'),
                buscarMunicipios(`${IBGE_URL}/estados/53/municipios`, 'DF')
            ]);
            cidadesRegiao = [...go, ...df];
        } catch (e) {
            console.error('Erro ao carregar cidades de Goiás/DF:', e);
            cidadesRegiao = []; // se falhar, ainda funcionam destaques + capitais
        }
    }

    async function carregarBrasil() {
        if (carregouBrasil || carregandoBrasil) return;
        carregandoBrasil = true;
        try {
            cidadesBrasil = await buscarMunicipios(`${IBGE_URL}/municipios`, 'BR');
            carregouBrasil = true;
        } catch (e) {
            console.error('Erro ao carregar cidades do Brasil:', e);
        }
        carregandoBrasil = false;
    }

    // ---- Filtro da busca ----
    function filtrarCidades(termo) {
        const t = normalizarCidade(termo);
        if (!t) return [TODAS, ...DESTAQUES];

        const vistos = new Set();
        const resultado = [];
        const fontes = [[TODAS], DESTAQUES, CAPITAIS, cidadesRegiao, cidadesBrasil];

        for (const fonte of fontes) {
            for (const c of fonte) {
                const alvo = normalizarCidade(`${c.nome} ${c.apelido || ''} ${c.uf}`);
                if (!alvo.includes(t)) continue;
                const chave = `${normalizarCidade(c.nome)}-${c.uf}`;
                if (vistos.has(chave)) continue;
                vistos.add(chave);
                resultado.push(c);
            }
        }

        // 1º as que começam com o termo, 2º as de GO/DF, 3º ordem alfabética
        resultado.sort((a, b) => {
            const aIni = normalizarCidade(a.nome).startsWith(t) ? 0 : 1;
            const bIni = normalizarCidade(b.nome).startsWith(t) ? 0 : 1;
            if (aIni !== bIni) return aIni - bIni;
            const aReg = (a.uf === 'GO' || a.uf === 'DF') ? 0 : 1;
            const bReg = (b.uf === 'GO' || b.uf === 'DF') ? 0 : 1;
            if (aReg !== bReg) return aReg - bReg;
            return a.nome.localeCompare(b.nome, 'pt-BR');
        });

        return resultado.slice(0, 40);
    }

    // ---- Desenha a lista no card ----
    function renderizarCidades(cidades) {
        if (!cityList) return;
        cityList.innerHTML = '';

        if (!cidades.length) {
            const vazio = document.createElement('li');
            vazio.className = 'city-vazio';
            vazio.style.cssText = 'color:#888;cursor:default;justify-content:center;';
            vazio.textContent = 'Nenhuma cidade encontrada';
            cityList.appendChild(vazio);
            return;
        }

        cidades.forEach((c) => {
            const li = document.createElement('li');
            li.dataset.city = c.nome;
            li.dataset.uf = c.uf || '';

            const icone = document.createElement('i');
            icone.className = c.todas ? 'fas fa-earth-americas' : 'fas fa-map-marker-alt';
            li.appendChild(icone);

            const texto = document.createElement('span');
            texto.textContent = c.nome;
            li.appendChild(texto);

            // Mostra a sigla do estado quando não for Goiás
            if (c.uf && c.uf !== 'GO') {
                const uf = document.createElement('small');
                uf.style.cssText = 'color:#999;font-size:12px;';
                uf.textContent = `- ${c.uf}`;
                li.appendChild(uf);
            }

            cityList.appendChild(li);
        });
    }

    const abrirCard = () => {
        if (cityCard) cityCard.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
        if (citySearch) citySearch.value = '';
        renderizarCidades(filtrarCidades(''));
        if (cityList) cityList.scrollTop = 0;
    };
    const fecharCard = () => { if (cityCard) cityCard.style.display = 'none'; if (overlay) overlay.style.display = 'none'; };

    function selecionarCidade(nome, uf) {
        if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${nome}`;
        if (cityBtnMobile) cityBtnMobile.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${nome}`;
        localStorage.setItem('cidade', nome);
        if (uf) localStorage.setItem('cidadeUF', uf);
        else localStorage.removeItem('cidadeUF');

        // Avisa o resto do site que a cidade mudou (útil pra filtrar eventos depois)
        window.dispatchEvent(new CustomEvent('roles:cidade', { detail: { nome, uf: uf || '' } }));

        fecharCard();
    }

    cityBtn?.addEventListener('click', abrirCard);
    cityBtnMobile?.addEventListener('click', abrirCard);
    closeCard?.addEventListener('click', fecharCard);
    overlay?.addEventListener('click', fecharCard);

    // Clique em uma cidade da lista (delegação, porque a lista é redesenhada)
    cityList?.addEventListener('click', (e) => {
        const item = e.target.closest('li[data-city]');
        if (!item) return;
        selecionarCidade(item.dataset.city, item.dataset.uf);
    });

    // Sem cidade salva = sem filtro, então o botão mostra "Todas as cidades"
    const savedCity = localStorage.getItem('cidade') || TODAS.nome;
    if (cityBtn) cityBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${savedCity}`;
    if (cityBtnMobile) cityBtnMobile.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${savedCity}`;

    // Já deixa Goiás + DF prontos em segundo plano
    carregarRegiao();
    renderizarCidades(filtrarCidades(''));

    // Busca de cidade (com pequeno atraso pra não pesar)
    let atrasoCidade;
    citySearch?.addEventListener('input', () => {
        clearTimeout(atrasoCidade);
        atrasoCidade = setTimeout(async () => {
            const termo = citySearch.value;
            renderizarCidades(filtrarCidades(termo));

            // Com 3+ letras, carrega o Brasil inteiro (só uma vez) e atualiza a lista
            if (normalizarCidade(termo).length >= 3 && !carregouBrasil) {
                await carregarBrasil();
                if (citySearch.value === termo) renderizarCidades(filtrarCidades(termo));
            }
        }, 150);
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

    // ----------------------------------------------------------
    // AJUDANTES: qual input está ativo e onde posicionar a caixa
    // ----------------------------------------------------------
    function getInputAtivo() {
        const mobileAberto = searchBarMobile && searchBarMobile.classList.contains('open');
        return mobileAberto ? searchInputMobile : searchInput;
    }

    function posicionarSuggestions() {
        if (!suggestionsBox) return;
        const mobileAberto = searchBarMobile && searchBarMobile.classList.contains('open');
        const ref = mobileAberto ? searchBarMobile : searchWrapper;
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        suggestionsBox.style.position = 'fixed';
        suggestionsBox.style.top = `${rect.bottom + 6}px`;
        suggestionsBox.style.left = `${rect.left}px`;
        suggestionsBox.style.width = `${rect.width}px`;
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

    const abrirDropdown = () => {
        posicionarSuggestions();
        suggestionsBox?.classList.add('active');
    };
    const fecharDropdown = () => suggestionsBox?.classList.remove('active');

    window.addEventListener('resize', () => {
        if (suggestionsBox?.classList.contains('active')) posicionarSuggestions();
    });

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
                const inputAtivo = getInputAtivo();
                if (inputAtivo) inputAtivo.value = termo;
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
                    const inputAtivo = getInputAtivo();
                    if (inputAtivo) inputAtivo.value = evento.nome;
                    inputAtivo?.focus();
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
                    const inputAtivo = getInputAtivo();
                    if (inputAtivo) inputAtivo.value = local.nome;
                    inputAtivo?.focus();
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

        const inputAtivo = getInputAtivo();
        if (inputAtivo) inputAtivo.value = termo;
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
        searchInputMobile.addEventListener('focus', () => {
            const t = searchInputMobile.value.trim();
            if (t.length < 2) renderVazio();
            else renderSugestoes(t);
        });

        searchInputMobile.addEventListener('input', () => {
            const t = searchInputMobile.value.trim();
            if (t.length < 2) renderVazio();
            else renderSugestoes(t);
        });

        searchInputMobile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const termo = searchInputMobile.value.trim();
                buscarEDirecionar(termo);
            }
            if (e.key === 'Escape') fecharDropdown();
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
        const dentroDesktop = searchWrapper && searchWrapper.contains(e.target);
        const dentroMobile = searchBarMobile && searchBarMobile.contains(e.target);
        const dentroSugestoes = suggestionsBox && suggestionsBox.contains(e.target);
        if (!dentroDesktop && !dentroMobile && !dentroSugestoes) fecharDropdown();
    });

    btnBuscar?.addEventListener('click', () => {
        dispararBusca();
    });
}