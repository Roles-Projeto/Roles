// Frontend/js/Evento.js
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE = isLocal ? "http://localhost:3000" : window.location.origin;
const API_URL  = `${API_BASE}/eventos`;

const imagensPorCategoria = {
  'todas':       'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop&q=85',
  'festa':       'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1600&h=700&fit=crop&q=85',
  'show':        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&h=700&fit=crop&q=85',
  'festival':    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1600&h=700&fit=crop&q=85',
  'gastronomia': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&h=700&fit=crop&q=85',
  'workshop':    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1600&h=700&fit=crop&q=85',
};

const coresPorCategoria = {
  'todas':       '#1a1a2e',
  'festa':       '#5d3fd3',
  'show':        '#29b6f6',
  'festival':    '#ec407a',
  'gastronomia': '#ff8a65',
  'workshop':    '#43a047',
};

// =========================================================
// HERO
// =========================================================
function aplicarImagemHero(categoria) {
  const hero = document.querySelector('.hero-section');
  if (!hero) return;
  const imgUrl = imagensPorCategoria[categoria] || imagensPorCategoria['todas'];
  const cor    = coresPorCategoria[categoria]    || '#1a1a2e';
  hero.style.backgroundColor   = cor;
  hero.style.transition         = 'opacity 0.35s ease';
  hero.style.opacity            = '0.85';
  hero.style.backgroundImage    = `url('${imgUrl}')`;
  hero.style.backgroundSize     = 'cover';
  hero.style.backgroundPosition = 'center 40%';
  hero.style.backgroundRepeat   = 'no-repeat';
  setTimeout(() => { hero.style.opacity = '1'; }, 50);
  const img = new Image();
  img.onerror = () => { hero.style.backgroundImage = 'none'; hero.style.backgroundColor = cor; };
  img.src = imgUrl;
}

// =========================================================
// DROPDOWN CUSTOMIZADO
// =========================================================
function criarDropdown(botao, itens, onSelect) {
  function fecharDropdown() {
    document.getElementById('dropdown-aberto')?.remove();
    document.querySelectorAll('.btn-dropdown').forEach(b => b.classList.remove('aberto'));
  }

  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    const jaAberto = document.getElementById('dropdown-aberto');
    fecharDropdown();
    if (jaAberto) return;

    botao.classList.add('aberto');

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
        botao.childNodes[0].textContent = item.label + ' ';
        fecharDropdown();
      });
      menu.appendChild(op);
    });

    const rect = botao.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + window.scrollY + 6}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(menu);
  });

  document.addEventListener('click', fecharDropdown);
}

// =========================================================
// INICIALIZAÇÃO
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {

  aplicarImagemHero('todas');

  const container          = document.getElementById("eventosContainer");
  const EVENTOS_POR_PAGINA = 6;
  let eventosFiltrados     = [];
  let quantidadeVisiveis   = EVENTOS_POR_PAGINA;
  let filtroData           = 'todas';
  let filtroCategoria      = 'todas';

  // Clique no card inteiro
  container.addEventListener("click", e => {
    if (e.target.closest("button, a")) return;
    const card = e.target.closest(".evento-card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (id) window.location.href = `/frontend/detalheseventos/detalheevento.html?id=${id}`;
  });

  // -------------------------------------------------------
  // DROPDOWN DE DATA
  // -------------------------------------------------------
  const btnData = document.getElementById('btnDropdownData');
  if (btnData) {
    criarDropdown(btnData, [
      { label: 'Todas as datas', valor: 'todas'  },
      { label: 'Hoje',           valor: 'hoje'   },
      { label: 'Amanhã',         valor: 'amanha' },
      { label: 'Esta semana',    valor: 'semana' },
      { label: 'Este mês',       valor: 'mes'    },
    ], (item) => {
      filtroData = item.valor;
      aplicarFiltros();
    });
  }

  // -------------------------------------------------------
  // DROPDOWN DE CATEGORIA
  // -------------------------------------------------------
  const btnCat = document.getElementById('btnDropdownCategoria');
  if (btnCat) {
    criarDropdown(btnCat, [
      { label: 'Todas as categorias', valor: 'todas'       },
      { label: 'Festas',              valor: 'festa'       },
      { label: 'Shows',               valor: 'show'        },
      { label: 'Festivais',           valor: 'festival'    },
      { label: 'Gastronomia',         valor: 'gastronomia' },
      { label: 'Workshop',            valor: 'workshop'    },
    ], (item) => {
      filtroCategoria = item.valor;
      document.querySelectorAll('.pill').forEach(p => {
        p.classList.remove('active');
        if (p.getAttribute('data-cat') === item.valor) p.classList.add('active');
      });
      aplicarFiltros();
    });
  }

  // -------------------------------------------------------
  // CARREGAR EVENTOS
  // -------------------------------------------------------
  async function carregarEventos() {
    try {
      const res  = await fetch(API_URL);
      const data = await res.json();
      document.querySelectorAll(".evento-card").forEach(c => c.remove());
      if (data.length === 0) {
        container.insertAdjacentHTML("afterbegin",
          `<p style="grid-column:1/-1;text-align:center;padding:40px;color:#888;">Nenhum evento encontrado.</p>`);
        atualizarContador();
        return;
      }
      const carregarBtn = document.querySelector(".carregar-container");
      data.forEach(evento => container.insertBefore(criarCard(evento), carregarBtn));
      aplicarFiltros();
    } catch (err) {
      console.error("Erro ao carregar eventos:", err);
      container.insertAdjacentHTML("afterbegin",
        `<p style="grid-column:1/-1;text-align:center;padding:40px;color:red;">Erro ao carregar eventos. Verifique o servidor.</p>`);
    }
  }

  // -------------------------------------------------------
  // CRIAR CARD
  // -------------------------------------------------------
  function criarCard(evento) {
    const article = document.createElement("article");
    article.classList.add("evento-card");
    article.setAttribute("data-categoria", (evento.assunto || "").toLowerCase());
    article.setAttribute("data-nome",      evento.nome);
    article.setAttribute("data-id",        evento.id);
    article.setAttribute("data-data",      evento.data_inicio || "");

    const dataFormatada = formatarData(evento.data_inicio);
    const isGratuito    = !evento.preco_minimo || parseFloat(evento.preco_minimo) === 0;
    const preco         = isGratuito ? "Gratuito" : `R$ ${parseFloat(evento.preco_minimo).toFixed(2)}`;

    const imagemSrc = !evento.imagem
      ? `${API_BASE}/frontend/imagens/jazz.png`
      : evento.imagem.startsWith("http")
        ? evento.imagem
        : `${API_BASE}${evento.imagem}`;

    const btnAcao = isGratuito
      ? `<a href="/frontend/detalheseventos/presencaconfirmada.html" class="btn-confirmar" role="button">
           <i class="fa-solid fa-check"></i> Confirmar
         </a>`
      : `<a href="/frontend/detalheseventos/detalheevento.html?id=${evento.id}" class="btn-comprar" role="button">
           <i class="fa-solid fa-ticket"></i> Comprar
         </a>`;

    article.innerHTML = `
      <div class="evento-imagem">
        <img src="${imagemSrc}" alt="${evento.nome}" loading="lazy" />
        <span class="badge">${evento.assunto || "Evento"}</span>
      </div>
      <div class="evento-info">
        <h3>${evento.nome}</h3>
        <p class="descricao">${evento.descricao || ""}</p>
        <div class="meta-group">
          <p class="meta"><i class="fa-regular fa-calendar"></i> ${dataFormatada}</p>
          <p class="meta"><i class="fa-solid fa-location-dot"></i> ${evento.local_nome || ""}${evento.cidade ? " — " + evento.cidade : ""}</p>
          <p class="meta"><i class="fa-regular fa-heart"></i> 0 pessoas interessadas</p>
        </div>
        <div class="card-footer">
          <span class="preco">${preco}</span>
          <div class="acoes">
            <a href="/frontend/detalheseventos/detalheevento.html?id=${evento.id}" class="btn-detalhes" role="button">
              <i class="fa-solid fa-circle-info"></i> Detalhes
            </a>
            ${btnAcao}
          </div>
        </div>
      </div>`;

    return article;
  }

  // -------------------------------------------------------
  // FORMATAR DATA
  // -------------------------------------------------------
  function formatarData(dataStr) {
    if (!dataStr) return "-";
    const d     = new Date(dataStr);
    const dias  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} &nbsp;<i class="fa-regular fa-clock"></i> ${d.toTimeString().slice(0,5)}`;
  }

  // -------------------------------------------------------
  // FILTRAR POR DATA
  // -------------------------------------------------------
  function dentroDoFiltroData(dataStr) {
    if (filtroData === 'todas' || !dataStr) return true;
    const evento = new Date(dataStr);
    const hoje   = new Date();
    hoje.setHours(0,0,0,0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const fimSemana = new Date(hoje); fimSemana.setDate(fimSemana.getDate() + 7);
    const fimMes  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    if (filtroData === 'hoje')   return evento >= hoje   && evento < amanha;
    if (filtroData === 'amanha') return evento >= amanha && evento < new Date(amanha.getTime() + 86400000);
    if (filtroData === 'semana') return evento >= hoje   && evento <= fimSemana;
    if (filtroData === 'mes')    return evento >= hoje   && evento <= fimMes;
    return true;
  }

  // -------------------------------------------------------
  // APLICAR FILTROS + PAGINAÇÃO
  // -------------------------------------------------------
  const searchInput    = document.getElementById("searchInput");
  const pillsContainer = document.getElementById("pillsContainer");

  function aplicarFiltros() {
    const categoriaAtiva = filtroCategoria !== 'todas'
      ? filtroCategoria
      : (document.querySelector(".pill.active")?.getAttribute("data-cat") || "todas");
    const termoBusca = (searchInput?.value || "").toLowerCase().trim();
    const todos      = document.querySelectorAll(".evento-card");

    eventosFiltrados = [];
    todos.forEach(card => {
      const cat  = (card.getAttribute("data-categoria") || "").toLowerCase();
      const nome = card.querySelector("h3")?.textContent.toLowerCase()         || "";
      const desc = card.querySelector(".descricao")?.textContent.toLowerCase() || "";
      const data = card.getAttribute("data-data") || "";
      const ok   = (termoBusca === "" || nome.includes(termoBusca) || desc.includes(termoBusca))
                && (categoriaAtiva === "todas" || cat.includes(categoriaAtiva))
                && dentroDoFiltroData(data);
      if (ok) eventosFiltrados.push(card);
      card.style.display = "none";
    });

    quantidadeVisiveis = EVENTOS_POR_PAGINA;
    renderizarPagina();
  }

  function renderizarPagina() {
    eventosFiltrados.forEach((card, i) => {
      card.style.display = i < quantidadeVisiveis ? "flex" : "none";
    });
    atualizarContador();
    atualizarBotoes();
  }

  // -------------------------------------------------------
  // VER MAIS / VER MENOS
  // -------------------------------------------------------
  function atualizarBotoes() {
    const btnMais  = document.getElementById('carregarMais');
    const btnMenos = document.getElementById('verMenos');
    if (!btnMais || !btnMenos) return;

    const restantes = eventosFiltrados.length - quantidadeVisiveis;

    if (restantes > 0) {
      btnMais.style.display = 'inline-flex';
      btnMais.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Ver Mais`;
    } else {
      btnMais.style.display = 'none';
    }

    if (quantidadeVisiveis > EVENTOS_POR_PAGINA) {
      btnMenos.style.display = 'inline-flex';
      btnMenos.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Ver Menos`;
    } else {
      btnMenos.style.display = 'none';
    }
  }

  function atualizarContador() {
    const el = document.getElementById("qtdEventos");
    if (el) el.textContent = eventosFiltrados.length || document.querySelectorAll(".evento-card").length;
  }

  const btnCarregarEl = document.getElementById('carregarMais');
  const btnVerMenosEl = document.getElementById('verMenos');

  if (btnCarregarEl) {
    btnCarregarEl.addEventListener('click', () => {
      quantidadeVisiveis += EVENTOS_POR_PAGINA;
      renderizarPagina();
    });
  }

  if (btnVerMenosEl) {
    btnVerMenosEl.addEventListener('click', () => {
      quantidadeVisiveis = EVENTOS_POR_PAGINA;
      renderizarPagina();
      const lista = document.querySelector('.eventos-lista');
      if (lista) window.scrollTo({ top: lista.offsetTop - 120, behavior: 'smooth' });
    });
  }

  if (searchInput) searchInput.addEventListener("keyup", aplicarFiltros);

  if (pillsContainer) {
    pillsContainer.addEventListener("click", e => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      filtroCategoria = pill.getAttribute("data-cat") || "todas";
      const btnCatEl = document.getElementById('btnDropdownCategoria');
      if (btnCatEl) {
        const labels = {
          'todas': 'Todas as categorias', 'festa': 'Festas',
          'show': 'Shows', 'festival': 'Festivais',
          'gastronomia': 'Gastronomia', 'workshop': 'Workshop'
        };
        btnCatEl.childNodes[0].textContent = (labels[filtroCategoria] || 'Todas as categorias') + ' ';
      }
      aplicarImagemHero(filtroCategoria);
      aplicarFiltros();
    });
  }

  await carregarEventos();
});