document.addEventListener("DOMContentLoaded", () => {

    /* ==================================================
    ================= CARROSSEL SYMPLA-STYLE ============
    ================================================== */

    async function iniciarCarrossel() {

        const track   = document.querySelector(".carousel-track");
        const btnNext = document.querySelector(".carousel-btn.next");
        const btnPrev = document.querySelector(".carousel-btn.prev");

        if (!track) return;

        try {
            const res          = await fetch(`${window.API_BASE}/eventos`);
            const todosEventos = await res.json();
            const eventos      = todosEventos.slice(0, 10);

            if (!eventos || eventos.length === 0) {
                track.innerHTML = '<p style="color:#fff;text-align:center;padding:20px">Nenhum evento encontrado.</p>';
                return;
            }

            track.innerHTML = "";

            const cliques       = JSON.parse(localStorage.getItem('eventosCliques') || '{}');
            const maisClicadoId = Object.entries(cliques).sort((a, b) => b[1] - a[1])[0]?.[0];

            eventos.forEach(evento => {
                const data = evento.data_inicio
                    ? new Date(evento.data_inicio).toLocaleDateString('pt-BR', {
                        weekday: 'short', day: '2-digit', month: 'short'
                      })
                    : '';
                const hora = evento.hora_inicio ? evento.hora_inicio.slice(0, 5) : '';

                let imagem = '/frontend/imagens/1º imagem cad.png';
                if (evento.imagem) {
                    imagem = evento.imagem.startsWith('http')
                        ? evento.imagem
                        : `${window.API_BASE}${evento.imagem.startsWith('/') ? '' : '/'}${evento.imagem}`;
                }

                const isEmAlta    = String(evento.id) === maisClicadoId;
                const badgeEmAlta = isEmAlta
                    ? `<div class="badge-em-alta"><i class="fa-solid fa-fire"></i> Em Alta</div>`
                    : '';

                const card = document.createElement('a');
                card.href             = `/frontend/detalheseventos/detalheevento.html?id=${evento.id}`;
                card.className        = 'carousel-card';
                card.dataset.eventoId = String(evento.id);
                card.innerHTML = `
                    ${badgeEmAlta}
                    <img src="${imagem}"
                         alt="${evento.nome}"
                         onerror="this.onerror=null; this.src='/frontend/imagens/1º imagem cad.png'">
                    <div class="carousel-info">
                        <h3>${evento.nome}</h3>
                        <p>${data}${hora ? ' • ' + hora : ''}</p>
                    </div>
                `;
                track.appendChild(card);
            });

        } catch (err) {
            console.error('❌ Erro ao carregar eventos no carrossel:', err);
            track.innerHTML = '<p style="color:#fff;text-align:center;padding:20px">Erro ao carregar eventos.</p>';
            return;
        }

        const cards = Array.from(track.querySelectorAll(".carousel-card"));
        if (cards.length === 0) return;

        let currentIndex = 0;
        const total = cards.length;

        function getPosition(relIndex) {
            let r = relIndex % total;
            if (r > total / 2) r -= total;
            if (r < -total / 2) r += total;
            return r;
        }

        function aplicarCarrossel() {
            cards.forEach((card, i) => {
                const rel = getPosition(i - currentIndex);
                let translateX, translateY, scale, zIndex, opacity, rotation;

                if (rel === 0) {
                    translateX = 0; translateY = 0; scale = 1;
                    zIndex = 10; opacity = 1; rotation = 0;
                } else if (rel === 1 || rel === -1) {
                    const side = rel > 0 ? 1 : -1;
                    translateX = side * 280; translateY = 30; scale = 0.80;
                    zIndex = 7; opacity = 0.90; rotation = side * 4;
                } else if (rel === 2 || rel === -2) {
                    const side = rel > 0 ? 1 : -1;
                    translateX = side * 460; translateY = 55; scale = 0.62;
                    zIndex = 4; opacity = 0.60; rotation = side * 8;
                } else if (rel === 3 || rel === -3) {
                    const side = rel > 0 ? 1 : -1;
                    translateX = side * 580; translateY = 75; scale = 0.48;
                    zIndex = 2; opacity = 0.30; rotation = side * 12;
                } else {
                    translateX = rel > 0 ? 700 : -700;
                    translateY = 90; scale = 0.38; zIndex = 0; opacity = 0;
                    rotation = rel > 0 ? 15 : -15;
                }

                card.style.transform =
                    `translateX(${translateX}px) translateY(${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
                card.style.zIndex  = zIndex;
                card.style.opacity = opacity;
                card.classList.toggle("active", rel === 0);
            });
        }

        function proximoCard() {
            currentIndex = (currentIndex + 1) % total;
            aplicarCarrossel();
        }

        function cardAnterior() {
            currentIndex = (currentIndex - 1 + total) % total;
            aplicarCarrossel();
        }

        if (btnNext) btnNext.addEventListener("click", () => { proximoCard(); resetAutoplay(); });
        if (btnPrev) btnPrev.addEventListener("click", () => { cardAnterior(); resetAutoplay(); });

        cards.forEach((card, i) => {
            card.addEventListener("click", (e) => {
                const rel     = ((i - currentIndex) % total + total) % total;
                const relNorm = rel > total / 2 ? rel - total : rel;
                if (relNorm !== 0) {
                    e.preventDefault();
                    currentIndex = i;
                    aplicarCarrossel();
                } else {
                    registrarClique(card.dataset.eventoId);
                }
            });
        });

        let autoplayTimer = setInterval(proximoCard, 4000);

        function resetAutoplay() {
            clearInterval(autoplayTimer);
            autoplayTimer = setInterval(proximoCard, 4000);
        }

        track.addEventListener("mouseenter", () => clearInterval(autoplayTimer));
        track.addEventListener("mouseleave", () => { autoplayTimer = setInterval(proximoCard, 4000); });

        aplicarCarrossel();
        window.addEventListener("resize", aplicarCarrossel);
    }

    function registrarClique(eventoId) {
        if (!eventoId) return;
        const cliques = JSON.parse(localStorage.getItem('eventosCliques') || '{}');
        cliques[eventoId] = (cliques[eventoId] || 0) + 1;
        localStorage.setItem('eventosCliques', JSON.stringify(cliques));
    }

    iniciarCarrossel();

    /* ==================================================
    ================= EVENTOS PRÓXIMOS ==================
    ================================================== */

    async function carregarEventosProximos() {
        const grid = document.getElementById("eventosGrid");
        if (!grid) return;

        try {
            const res     = await fetch(`${window.API_BASE}/eventos`);
            const eventos = await res.json();

            if (!eventos || eventos.length === 0) {
                grid.innerHTML = '<p style="text-align:center;padding:40px;color:#888;">Nenhum evento encontrado.</p>';
                return;
            }

            grid.innerHTML = "";

            eventos.slice(0, 6).forEach(evento => {
                const data = evento.data_inicio
                    ? new Date(evento.data_inicio).toLocaleDateString('pt-BR', {
                        weekday: 'short', day: '2-digit', month: 'short'
                      })
                    : '';
                const hora = evento.hora_inicio ? evento.hora_inicio.slice(0, 5) : '';

                let imagem = '/frontend/imagens/1º imagem cad.png';
                if (evento.imagem) {
                    imagem = evento.imagem.startsWith('http')
                        ? evento.imagem
                        : `${window.API_BASE}${evento.imagem.startsWith('/') ? '' : '/'}${evento.imagem}`;
                }

                const card = document.createElement('a');
                card.href      = `/frontend/detalheseventos/detalheevento.html?id=${evento.id}`;
                card.className = 'card-evento';
                card.innerHTML = `
                    <div class="evento-imagem-wrap">
                        <img src="${imagem}" alt="${evento.nome}"
                             onerror="this.onerror=null;this.src='/frontend/imagens/1º imagem cad.png'">
                        <span class="tag-evento">${evento.assunto || 'Evento'}</span>
                    </div>
                    <div class="evento-content">
                        <h3>${evento.nome}</h3>
                        <div class="evento-data-local">
                            <p><i class="fas fa-calendar-alt"></i> ${data}${hora ? ' - ' + hora : ''}</p>
                        </div>
                        <p class="evento-local">
                            <i class="fas fa-map-marker-alt"></i>
                            ${evento.local_nome || ''}${evento.cidade ? ' — ' + evento.cidade : ''}
                        </p>
                    </div>
                `;
                grid.appendChild(card);
            });

        } catch (err) {
            console.error('Erro ao carregar eventos próximos:', err);
        }
    }

    carregarEventosProximos();

    /* ==================================================
    ================= LOCAIS POPULARES ==================
    ================================================== */

    async function carregarLocaisPopulares() {
        const grid = document.querySelector(".populares-grid");
        if (!grid) return;

        try {
            const res    = await fetch(`${window.API_BASE}/estabelecimentos`);
            const locais = await res.json();

            if (!locais || locais.length === 0) {
                grid.innerHTML = '<p style="text-align:center;padding:40px;color:#888;">Nenhum local encontrado.</p>';
                return;
            }

            grid.innerHTML = "";

            locais.slice(0, 6).forEach(local => {
                let imagem = '/frontend/imagens/1º imagem cad.png';
                if (local.img_capa && local.img_capa.startsWith('data:')) {
                    imagem = local.img_capa;
                } else if (local.img_capa) {
                    imagem = local.img_capa.startsWith('http')
                        ? local.img_capa
                        : `${window.API_BASE}${local.img_capa.startsWith('/') ? '' : '/'}${local.img_capa}`;
                } else if (local.img_logo && local.img_logo.startsWith('data:')) {
                    imagem = local.img_logo;
                } else if (local.img_logo) {
                    imagem = local.img_logo.startsWith('http')
                        ? local.img_logo
                        : `${window.API_BASE}${local.img_logo.startsWith('/') ? '' : '/'}${local.img_logo}`;
                }

                const categoria = local.tipo || 'Local';
                const tagClass  = categoria.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, '-').split('-')[0];

                const card = document.createElement('a');
                card.href                  = `/frontend/detalheslocais/detalheslocais.html?id=${local.id}`;
                card.className             = 'card-local';
                card.dataset.categoriaCard = tagClass;
                card.innerHTML = `
                    <div class="card-image-wrap">
                        <img src="${imagem}" alt="${local.nome}"
                             onerror="this.onerror=null;this.src='/frontend/imagens/1º imagem cad.png'">
                        <span class="tag tag-${tagClass}">${categoria}</span>
                    </div>
                    <div class="card-content">
                        <h3>${local.nome}</h3>
                        <p class="evento-local">
                            <i class="fas fa-map-marker-alt"></i>
                            ${local.bairro || ''}${local.cidade ? ' — ' + local.cidade : ''}
                        </p>
                    </div>
                `;
                grid.appendChild(card);
            });

        } catch (err) {
            console.error('❌ Erro ao carregar locais populares:', err);
        }
    }

    carregarLocaisPopulares();

    /* ==================================================
    ================= CARROSSEL CATEGORIAS ==============
    ✅ Busca contagem de LOCAIS (por tipo) +
       EVENTOS (por assunto) em cada categoria
    ================================================== */

    async function iniciarCarrosselCategorias() {

        const catTrack = document.querySelector(".categorias-track");
        const catNext  = document.querySelector(".cat-btn.next");
        const catPrev  = document.querySelector(".cat-btn.prev");

        if (!catTrack) return;

        const categorias = [
            {
                name: "Baladas",
                icon: "fas fa-music",
                slug: "Baladas",
                keywords: ["balada", "baladas", "night", "clube", "club"]
            },
            {
                name: "Bar",
                icon: "fas fa-glass-martini-alt",
                slug: "Bar",
                keywords: ["bar", "pub", "boteco", "happy hour"]
            },
            {
                name: "Restaurante",
                icon: "fas fa-utensils",
                slug: "Restaurante",
                keywords: ["restaurante", "gastronomia", "churrascaria", "brunch", "food"]
            },
            {
                name: "Karaoke",
                icon: "fas fa-microphone",
                slug: "Karaoke",
                keywords: ["karaoke", "karaokê"]
            },
            {
                name: "Shows",
                icon: "fas fa-ticket-alt",
                slug: "Show",
                keywords: ["show", "shows", "shows e música", "musica", "música", "banda", "concert", "standup", "stand-up", "stand up", "comédia", "comedia", "comedy"]
            },
            {
                name: "Eventos",
                icon: "fas fa-cocktail",
                slug: "Eventos",
                keywords: ["evento", "eventos", "festa", "festas", "festival", "festivais", "workshop", "feirinha", "feira"]
            },
            {
                name: "Parques",
                icon: "fas fa-tree",
                slug: "Parques",
                keywords: ["parque", "parques", "natureza", "ao ar livre", "outdoor"]
            },
            {
                name: "50+",
                icon: "fas fa-leaf",
                slug: "%2B50%20anos",
                keywords: ["50+", "50 anos", "maturidade", "terceira idade"]
            },
        ];

        const norm = (s) => (s || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        function bate(texto, keywords) {
            const t = norm(texto);
            return keywords.some(k => t.includes(norm(k)));
        }

        let locais = [], eventos = [];
        try {
            const [resLocais, resEventos] = await Promise.all([
                fetch(`${window.API_BASE}/estabelecimentos`),
                fetch(`${window.API_BASE}/eventos`)
            ]);
            locais  = await resLocais.json();
            eventos = await resEventos.json();
        } catch (e) {
            console.warn('Não foi possível carregar dados para categorias:', e);
        }

        function contarCategoria(cat) {
            const qtdLocais  = locais.filter(l  => bate(l.tipo    || '', cat.keywords)).length;
            const qtdEventos = eventos.filter(ev => bate(ev.assunto || '', cat.keywords)).length;
            return qtdLocais + qtdEventos;
        }

        catTrack.innerHTML = '';
        categorias.forEach(cat => {
            const qtd  = contarCategoria(cat);
            const link = `/frontend/categorias/categorias.html?name=${cat.slug}&icon-class=${encodeURIComponent(cat.icon)}`;
            const card = document.createElement('a');
            card.href      = link;
            card.className = 'card-categoria';
            card.innerHTML = `
                <div class="icon"><i class="${cat.icon}"></i></div>
                <h3>${cat.name}</h3>
                <span>${qtd} ${qtd === 1 ? 'item' : 'itens'}</span>
            `;
            catTrack.appendChild(card);
        });

        const catCards = Array.from(catTrack.querySelectorAll(".card-categoria"));
        if (catCards.length === 0) return;

        let catIndex  = 0;
        let catAutoplay;

        function getMaxSlide() {
            const cardWidth  = catCards[0].offsetWidth + 14;
            const trackWidth = catCards.length * cardWidth - 14;
            const containerW = catTrack.parentElement.offsetWidth - 112;
            return Math.max(0, Math.floor((trackWidth - containerW) / cardWidth));
        }

        function moverCategorias(instant = false) {
            const cardWidth  = catCards[0].offsetWidth + 14;
            const slideIndex = Math.min(catIndex, getMaxSlide());

            if (instant) {
                catTrack.style.transition = "none";
                catTrack.style.transform  = `translateX(-${slideIndex * cardWidth}px)`;
                requestAnimationFrame(() => {
                    catTrack.style.transition = "transform .45s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
                });
            } else {
                catTrack.style.transform = `translateX(-${slideIndex * cardWidth}px)`;
            }
        }

        function proximaCategoria() {
            const maxSlide = getMaxSlide();
            catIndex++;
            if (catIndex > maxSlide) catIndex = 0;
            moverCategorias(catIndex === 0);
        }

        function categoriaAnterior() {
            const maxSlide = getMaxSlide();
            catIndex--;
            if (catIndex < 0) catIndex = maxSlide;
            moverCategorias(catIndex === maxSlide);
        }

        function iniciarAutoplay() {
            clearInterval(catAutoplay);
            catAutoplay = setInterval(proximaCategoria, 3000);
        }

        if (catNext) catNext.addEventListener("click", () => { proximaCategoria(); iniciarAutoplay(); });
        if (catPrev) catPrev.addEventListener("click", () => { categoriaAnterior(); iniciarAutoplay(); });

        catTrack.addEventListener("mouseenter", () => clearInterval(catAutoplay));
        catTrack.addEventListener("mouseleave", iniciarAutoplay);

        let touchStartX = 0;
        catTrack.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
            clearInterval(catAutoplay);
        }, { passive: true });

        catTrack.addEventListener("touchend", (e) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 40) {
                diff > 0 ? proximaCategoria() : categoriaAnterior();
            }
            iniciarAutoplay();
        }, { passive: true });

        window.addEventListener("resize", () => {
            catIndex = Math.min(catIndex, getMaxSlide());
            moverCategorias();
        });

        iniciarAutoplay();
        moverCategorias();
    }

    iniciarCarrosselCategorias();

    /* ==================================================
    ================= FAQ ===============================
    ================================================== */

    const perguntas = document.querySelectorAll(".faq-question");

    if (perguntas.length > 0) {
        perguntas.forEach(btn => {
            btn.addEventListener("click", () => {
                const resposta = btn.nextElementSibling;
                btn.classList.toggle("active");
                if (resposta.style.maxHeight) {
                    resposta.style.maxHeight = null;
                } else {
                    resposta.style.maxHeight = resposta.scrollHeight + "px";
                }
            });
        });
    }

    /* ==================================================
    ================= MODAL LOGIN ======================
    ================================================== */

    const modal      = document.getElementById("loginModal");
    const closeLogin = document.getElementById("closeLogin");

    if (modal && closeLogin) {
        closeLogin.addEventListener("click", () => {
            modal.classList.remove("active");
        });

        window.addEventListener("message", (event) => {
            if (event.data === "OPEN_LOGIN_MODAL") {
                modal.classList.add("active");
            }
            if (event.data === "LOGIN_SUCCESS") {
                modal.classList.remove("active");
                location.reload();
            }
        });
    }

});

/* ==================================================
   MODAL LOGIN — FORA DO DOMCONTENTLOADED
================================================== */

const loginModal = document.getElementById("loginModal");
const closeLogin = document.getElementById("closeLogin");

if (loginModal && closeLogin) {

    window.addEventListener("message", (event) => {
        if (event.data === "OPEN_LOGIN_MODAL") {
            loginModal.style.display = "flex";
        }
        if (event.data === "LOGIN_SUCCESS") {
            loginModal.style.display = "none";
            location.reload();
        }
    });

    closeLogin.addEventListener("click", () => {
        loginModal.style.display = "none";
    });

    loginModal.addEventListener("click", (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = "none";
        }
    });
}