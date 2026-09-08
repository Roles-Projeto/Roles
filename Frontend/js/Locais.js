"use strict";

(function () {

    const API_URL = window.API_BASE;

    const faixaPrecoMap = {
        "economico":   "até R$ 30",
        "moderado":    "R$ 30 a R$ 80",
        "sofisticado": "R$ 80 a R$ 150",
        "luxo":        "acima de R$ 150"
    };

    // =========================================================
    // IMAGENS UNSPLASH POR CATEGORIA
    // =========================================================
    const imagensPorCategoria = {
        'todos':        'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1400&h=500&fit=crop&q=80',
        'baladas':      'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1400&h=500&fit=crop&q=80',
        'bares':        'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1400&h=500&fit=crop&q=80',
        'restaurantes': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&h=500&fit=crop&q=80',
        'shows':        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1400&h=500&fit=crop&q=80',
    };

    const coresPorCategoria = {
        'todos':        '#1a1a2e',
        'baladas':      '#5d3fd3',
        'bares':        '#fbc02d',
        'restaurantes': '#ff8a65',
        'shows':        '#29b6f6',
    };

    // =========================================================
    // ESTADO GLOBAL
    // =========================================================
    let termoAtual         = '';
    let categoriaAtual     = 'todos';
    let ordenacaoAtual     = 'padrao';
    let quantidadeVisiveis = 0;
    const CARDS_POR_PAGINA = 6;

    let todosCards     = [];
    let cardsFiltrados = [];

    // =========================================================
    // HERO
    // =========================================================
    function aplicarImagemHero(categoria) {
        const hero = document.querySelector('.todos-locais1');
        if (!hero) return;

        const imgUrl = imagensPorCategoria[categoria] || imagensPorCategoria['todos'];
        const cor    = coresPorCategoria[categoria]   || '#1a1a2e';

        hero.style.backgroundColor   = cor;
        hero.style.transition         = 'background-image 0.5s ease, opacity 0.3s ease';
        hero.style.opacity            = '0.7';
        hero.style.backgroundImage    = `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url('${imgUrl}')`;
        hero.style.backgroundSize     = 'cover';
        hero.style.backgroundPosition = 'center center';
        hero.style.backgroundRepeat   = 'no-repeat';
        hero.style.color              = '#ffffff';

        setTimeout(() => { hero.style.opacity = '1'; }, 50);

        const img = new Image();
        img.onerror = () => {
            hero.style.backgroundImage = 'none';
            hero.style.backgroundColor = cor;
        };
        img.src = imgUrl;

        const h1 = hero.querySelector('h1');
        const p  = hero.querySelector('p');
        if (h1) h1.style.color = '#ffffff';
        if (p)  p.style.color  = 'rgba(255,255,255,0.85)';
    }

    // =========================================================
    // UTILITÁRIO
    // =========================================================
    function norm(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // =========================================================
    // FETCH
    // =========================================================
    async function fetchEstabelecimentos() {
        try {
            const res = await fetch(`${API_URL}/estabelecimentos`);
            if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error("Erro ao buscar estabelecimentos:", err);
            return [];
        }
    }

    // =========================================================
    // CRIAR CARD
    // =========================================================
    function criarCardDinamico(estab) {
        const imgSrc          = estab.img_capa || estab.img_logo || "/frontend/imagens/placeholder.png";
        const categoriaLabel  = estab.tipo     || "Local";
        const enderecoDisplay = estab.endereco || `${estab.bairro ? estab.bairro + ", " : ""}${estab.cidade || "Goiânia"}`;

        const comodidadesArr = estab.comodidades
            ? estab.comodidades.split(',').map(c => c.trim()).filter(Boolean).slice(0, 3)
            : [];

        const tagsHTML = comodidadesArr.length > 0
            ? comodidadesArr.map(t => `<span>${t}</span>`).join("")
            : `<span>${categoriaLabel}</span>`;

        const nota       = parseFloat(estab.nota)    || 0;
        const avaliacoes = parseInt(estab.avaliacoes) || 0;

        const notaDisplay = nota > 0
            ? `<span class="nota"><i class="fas fa-star"></i> ${nota.toFixed(1)}</span>`
            : `<span class="nota nova">Novo</span>`;

        const faixaPrecoDisplay = faixaPrecoMap[estab.faixa_preco] || estab.faixa_preco || "";

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-categoria-card', estab.categoria_card || '');
        card.setAttribute('data-estab-id',       estab.id);
        card.setAttribute('data-nota',            nota);
        card.setAttribute('data-avaliacoes',      avaliacoes);

        card.innerHTML = `
            <div class="card-img">
                <img src="${imgSrc}" alt="${estab.nome}" loading="lazy" onerror="this.src='/frontend/imagens/placeholder.png'">
                <span class="categoria">${categoriaLabel}</span>
                ${notaDisplay}
            </div>
            <div class="card-content">
                <h3>${estab.nome}${faixaPrecoDisplay ? ` <span class="preco">${faixaPrecoDisplay}</span>` : ""}</h3>
                <p class="local"><i class="fa-solid fa-location-dot"></i> ${enderecoDisplay}</p>
                <p class="descricao">${estab.descricao || "Estabelecimento cadastrado."}</p>
                <div class="info">
                    <p><i class="fa-regular fa-clock"></i> ${estab.horario || "Verificar agenda"}</p>
                    ${estab.telefone ? `<p><i class="fa-solid fa-phone"></i> ${estab.telefone}</p>` : ""}
                </div>
                <div class="tags">${tagsHTML}</div>
                <div class="footer">
                    <p class="avaliacoes"><i class="fa-solid fa-star"></i> ${avaliacoes} avaliações</p>
                    <button class="detalhes btn-detalhes">Ver Detalhes</button>
                </div>
            </div>
        `;
        return card;
    }

    // =========================================================
    // CARREGAR CARDS
    // =========================================================
    async function carregarEstabelecimentosDinamicos() {
        const container = document.getElementById('cards-container-locais');
        if (!container) return;

        container.style.visibility = 'hidden';
        const estabelecimentos = await fetchEstabelecimentos();

        container.querySelectorAll('.card').forEach(c => c.remove());

        if (estabelecimentos.length > 0) {
            estabelecimentos.forEach(estab => container.appendChild(criarCardDinamico(estab)));
        }

        todosCards = Array.from(container.querySelectorAll('.card'));
        container.style.visibility = 'visible';
    }

    // =========================================================
    // CONTADOR E MENSAGEM VAZIA
    // =========================================================
    function atualizarContador(total) {
        const el = document.getElementById('contador-locais');
        if (el) el.textContent = total;
    }

    function atualizarMensagemVazia(total) {
        const ID = 'locais-sem-resultado';
        let msg  = document.getElementById(ID);
        if (total === 0) {
            if (!msg) {
                msg = document.createElement('div');
                msg.id = ID;
                msg.style.cssText = "text-align:center;padding:40px;color:#888;font-family:'DM Sans',sans-serif;";
                msg.innerHTML = `<p>Nenhum local encontrado para esta busca.</p>`;
                document.getElementById('cards-container-locais')?.after(msg);
            }
        } else {
            msg?.remove();
        }
    }

    // =========================================================
    // FILTRO + ORDENAÇÃO
    // =========================================================
    function textoDoCard(card) {
        const nome      = card.querySelector('h3')?.textContent        || '';
        const local     = card.querySelector('.local')?.textContent     || '';
        const descricao = card.querySelector('.descricao')?.textContent || '';
        const tags      = card.querySelector('.tags')?.textContent      || '';
        const categoria = card.getAttribute('data-categoria-card')      || '';
        return norm(`${nome} ${local} ${descricao} ${tags} ${categoria}`);
    }

    function aplicarFiltro() {
        const container = document.getElementById('cards-container-locais');
        if (!container) return;

        const tNorm = norm(termoAtual);
        const cNorm = norm(categoriaAtual);

        cardsFiltrados = todosCards.filter(card => {
            const texto   = textoDoCard(card);
            const catCard = norm(card.getAttribute('data-categoria-card') || '');
            return (tNorm === '' || texto.includes(tNorm)) &&
                   (cNorm === 'todos' || catCard === cNorm);
        });

        if (ordenacaoAtual === 'melhor-avaliados') {
            cardsFiltrados.sort((a, b) =>
                (parseFloat(b.getAttribute('data-nota'))     || 0) -
                (parseFloat(a.getAttribute('data-nota'))     || 0));
        } else if (ordenacaoAtual === 'mais-avaliados') {
            cardsFiltrados.sort((a, b) =>
                (parseInt(b.getAttribute('data-avaliacoes')) || 0) -
                (parseInt(a.getAttribute('data-avaliacoes')) || 0));
        }

        cardsFiltrados.forEach(card => container.appendChild(card));

        quantidadeVisiveis = CARDS_POR_PAGINA;
        renderizarPagina();

        atualizarContador(cardsFiltrados.length);
        atualizarMensagemVazia(cardsFiltrados.length);
    }

    // =========================================================
    // RENDERIZAR PÁGINA
    // =========================================================
    function renderizarPagina() {
        todosCards.forEach(card => card.style.display = 'none');
        cardsFiltrados.slice(0, quantidadeVisiveis).forEach(card => card.style.display = '');
        atualizarBotoes();
    }

    // =========================================================
    // VER MAIS / VER MENOS
    // =========================================================
    function atualizarBotoes() {
        const btnMais  = document.getElementById('btn-ver-mais');
        const btnMenos = document.getElementById('btn-ver-menos');
        if (!btnMais || !btnMenos) return;

        const restantes = cardsFiltrados.length - quantidadeVisiveis;

        if (restantes > 0) {
            btnMais.style.display = 'inline-flex';
            btnMais.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Ver Mais`;
        } else {
            btnMais.style.display = 'none';
        }

        if (quantidadeVisiveis > CARDS_POR_PAGINA) {
            btnMenos.style.display = 'inline-flex';
            btnMenos.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Ver Menos`;
        } else {
            btnMenos.style.display = 'none';
        }
    }

    // =========================================================
    // DROPDOWN GENÉRICO
    // =========================================================
    function criarDropdown(botao, itens, onSelect) {
        function fecharDropdown() {
            document.getElementById('dropdown-aberto')?.remove();
        }

        botao.addEventListener('click', (e) => {
            e.stopPropagation();
            fecharDropdown();

            const menu = document.createElement('div');
            menu.id = 'dropdown-aberto';
            menu.style.cssText = `
                position: absolute;
                background: #fff;
                border: 1.5px solid #e5e2f0;
                border-radius: 10px;
                box-shadow: 0 8px 28px rgba(60,30,140,0.14);
                z-index: 999;
                min-width: 200px;
                overflow: hidden;
                font-family: 'DM Sans', sans-serif;
            `;

            itens.forEach(item => {
                const op = document.createElement('div');
                op.textContent = item.label;
                op.style.cssText = `
                    padding: 11px 18px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #4b4660;
                    cursor: pointer;
                    transition: background 0.15s, color 0.15s;
                `;
                op.addEventListener('mouseenter', () => {
                    op.style.background = '#f5f3ff';
                    op.style.color = '#5b21b6';
                });
                op.addEventListener('mouseleave', () => {
                    op.style.background = '';
                    op.style.color = '#4b4660';
                });
                op.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSelect(item);
                    const span = botao.childNodes[0];
                    if (span) span.textContent = item.label + ' ';
                    fecharDropdown();
                });
                menu.appendChild(op);
            });

            const rect = botao.getBoundingClientRect();
            menu.style.top  = `${rect.bottom + window.scrollY + 4}px`;
            menu.style.left = `${rect.left   + window.scrollX}px`;
            document.body.appendChild(menu);
        });

        document.addEventListener('click', () => fecharDropdown());
    }

    // =========================================================
    // INICIALIZAR FILTROS
    // =========================================================
    function inicializarFiltros() {
        // Busca por texto
        const inputBusca = document.getElementById('search-locais');
        if (inputBusca) {
            inputBusca.addEventListener('input', (e) => {
                termoAtual = e.target.value;
                aplicarFiltro();
            });
        }

        // Botões de categoria (pills)
        const botoesCat = document.querySelectorAll('#botoes-categoria-locais [data-categoria]');
        botoesCat.forEach(btn => {
            btn.addEventListener('click', () => {
                botoesCat.forEach(b => b.classList.remove('ativo', 'active'));
                btn.classList.add('ativo', 'active');
                categoriaAtual = btn.getAttribute('data-categoria') || 'todos';
                aplicarImagemHero(categoriaAtual);
                aplicarFiltro();
            });
        });

        // Dropdowns
        const botoesDropdown = document.querySelectorAll('.botao-dropdown1');
        const botaoCategoria = botoesDropdown[0];
        const botaoOrdenacao = botoesDropdown[1];

        if (botaoCategoria) {
            criarDropdown(botaoCategoria, [
                { label: 'Todas as Categorias', valor: 'todos'        },
                { label: 'Baladas',             valor: 'baladas'      },
                { label: 'Bares',               valor: 'bares'        },
                { label: 'Restaurantes',        valor: 'restaurantes' },
                { label: 'Shows',               valor: 'shows'        },
            ], (item) => {
                categoriaAtual = item.valor;
                aplicarImagemHero(categoriaAtual);
                botoesCat.forEach(b => {
                    b.classList.remove('ativo', 'active');
                    if (b.getAttribute('data-categoria') === item.valor) {
                        b.classList.add('ativo', 'active');
                    }
                });
                aplicarFiltro();
            });
        }

        if (botaoOrdenacao) {
            criarDropdown(botaoOrdenacao, [
                { label: 'Padrão',           valor: 'padrao'           },
                { label: 'Melhor avaliados', valor: 'melhor-avaliados' },
                { label: 'Mais avaliados',   valor: 'mais-avaliados'   },
            ], (item) => {
                ordenacaoAtual = item.valor;
                aplicarFiltro();
            });
        }

        // Botão Ver Mais
        const btnVerMais = document.getElementById('btn-ver-mais');
        if (btnVerMais) {
            btnVerMais.addEventListener('click', () => {
                quantidadeVisiveis += CARDS_POR_PAGINA;
                renderizarPagina();
            });
        }

        // Botão Ver Menos
        const btnVerMenos = document.getElementById('btn-ver-menos');
        if (btnVerMenos) {
            btnVerMenos.addEventListener('click', () => {
                quantidadeVisiveis = CARDS_POR_PAGINA;
                renderizarPagina();
                const container = document.querySelector('.content-container1');
                if (container) window.scrollTo({ top: container.offsetTop - 120, behavior: 'smooth' });
            });
        }
    }

    // =========================================================
    // INIT
    // =========================================================
    document.addEventListener('DOMContentLoaded', async () => {
        aplicarImagemHero('todos');

        await carregarEstabelecimentosDinamicos();
        inicializarFiltros();
        aplicarFiltro();

        // Delegação de clique — Ver Detalhes
        const container = document.getElementById('cards-container-locais');
        if (container) {
            container.addEventListener('click', (e) => {
                const botao = e.target.closest('.detalhes');
                if (!botao) return;
                const card    = botao.closest('.card');
                if (!card) return;
                const estabId = card.getAttribute('data-estab-id');
                if (estabId) {
                    window.location.href = `/frontend/detalheslocais/detalheslocais.html?id=${estabId}`;
                } else {
                    alert("Este local ainda não possui página de detalhes no banco de dados.");
                }
            });
        }
    });

})();