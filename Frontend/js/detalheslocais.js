// detalheslocais.js — redesign completo

const faixaPrecoMap = {
    "economico":   "até R$ 30",
    "moderado":    "R$ 30 a R$ 80",
    "sofisticado": "R$ 80 a R$ 150",
    "luxo":        "acima de R$ 150"
};

function getIdFromUrl()  { return new URLSearchParams(window.location.search).get("id"); }
function getLocalId()    { return getIdFromUrl() || "local"; }

const API_URL = window.API_BASE;

async function fetchEstabelecimento(id) {
    try {
        const res = await fetch(`${API_URL}/estabelecimentos/${id}`);
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        return await res.json();
    } catch (err) { console.error("Erro ao buscar estabelecimento:", err); return null; }
}

const setEl     = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
const setElHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML   = val; };

function formatarHorario(horario) {
    if (!horario) return "—";
    return horario.split(/[,;]/).map(h => h.trim()).filter(Boolean).join("<br>");
}

function showToast(msg) {
    const t = document.getElementById("toast-notification");
    if (!t) return;
    t.textContent = msg;
    t.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.transform = "translateX(-50%) translateY(80px)"; }, 2800);
}

// ─── USUÁRIO ──────────────────────────────────────────────────────────────────
function getUsuarioLogado() {
    try { const nome = localStorage.getItem("profileName"); const id = localStorage.getItem("userId"); if (nome) return { nome_completo: nome, id }; } catch (_) {}
    return null;
}
function getToken() { return localStorage.getItem("token") || sessionStorage.getItem("token") || null; }

// ─── FAVORITAR ────────────────────────────────────────────────────────────────
function carregarEstadoFavorito() {
    const id = getLocalId();
    const favs = JSON.parse(localStorage.getItem("favoritos") || "[]");
    const isFav = favs.includes(id);
    const icon = document.getElementById("icon-heart");
    if (!icon) return;
    icon.className = isFav ? "fas fa-heart" : "far fa-heart";
    icon.style.color = isFav ? "#e63946" : "";
}

function toggleFavorito() {
    const id = getLocalId();
    const favs = JSON.parse(localStorage.getItem("favoritos") || "[]");
    const idx = favs.indexOf(id); const isFav = idx === -1;
    if (isFav) favs.push(id); else favs.splice(idx, 1);
    localStorage.setItem("favoritos", JSON.stringify(favs));
    const icon = document.getElementById("icon-heart");
    if (icon) { icon.className = isFav ? "fas fa-heart" : "far fa-heart"; icon.style.color = isFav ? "#e63946" : ""; }
    showToast(isFav ? "❤️ Adicionado aos favoritos!" : "💔 Removido dos favoritos.");
}

// ─── COMPARTILHAR ─────────────────────────────────────────────────────────────
async function compartilharLocal() {
    const nome = document.getElementById("local-name")?.textContent || "Local";
    const url  = window.location.href;
    if (navigator.share) {
        try { await navigator.share({ title: nome, text: `Confira ${nome} no Rolês!`, url }); }
        catch (e) { if (e.name !== "AbortError") copiarLink(url); }
    } else { copiarLink(url); }
}
function copiarLink(url) {
    navigator.clipboard.writeText(url)
        .then(() => showToast("🔗 Link copiado!"))
        .catch(() => showToast("Não foi possível copiar o link."));
}

// ─── AVALIAÇÕES ───────────────────────────────────────────────────────────────
let notaSelecionada = 0;

async function carregarAvaliacoes() {
    const id = getLocalId();
    const container = document.getElementById("review-list");
    if (!container) return;
    container.innerHTML = `<p style="color:var(--text-light);font-size:13px;padding:16px 0;">Carregando avaliações...</p>`;
    try {
        const res   = await fetch(`${API_URL}/avaliacoes?estabelecimento_id=${id}`);
        const lista = await res.json();
        container.innerHTML = "";
        if (!lista.length) {
            container.innerHTML = `<p style="color:var(--text-light);font-size:13px;padding:16px 0;">Nenhuma avaliação ainda. Seja o primeiro!</p>`;
        } else {
            lista.forEach(r => renderizarAvaliacao(r, container));
        }
        atualizarMediaUI(lista);
    } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
        container.innerHTML = `<p style="color:#dc2626;font-size:13px;">Erro ao carregar avaliações.</p>`;
    }
}

function atualizarMediaUI(lista) {
    if (!Array.isArray(lista) || !lista.length) {
        setEl("local-rating", "0.0 (0 avaliações)");
        setEl("avg-display",  "0.0 (0 avaliações)");
        setEl("sidebar-rating-value", "0.0");
        setEl("sidebar-rating-count", "0");
        renderizarStarsSidebar(0);
        return;
    }
    const total = lista.length;
    const media = (lista.reduce((acc, r) => acc + Number(r.nota), 0) / total).toFixed(1);
    const texto = `${media} (${total} avaliação${total !== 1 ? "ões" : ""})`;
    setEl("local-rating", texto);
    setEl("avg-display",  texto);
    setEl("sidebar-rating-value", media);
    setEl("sidebar-rating-count", total);
    renderizarStarsSidebar(parseFloat(media));
}

function renderizarStarsSidebar(media) {
    const container = document.getElementById("sidebar-stars");
    if (!container) return;
    const full = Math.floor(media);
    const half = media - full >= 0.4;
    container.innerHTML = Array.from({ length: 5 }, (_, i) => {
        if (i < full) return `<i class="fas fa-star"></i>`;
        if (i === full && half) return `<i class="fas fa-star-half-alt"></i>`;
        return `<i class="far fa-star empty"></i>`;
    }).join("");
}

function estrelasHTML(nota) {
    return Array.from({ length: 5 }, (_, i) =>
        `<span style="color:${i < nota ? "#f59e0b" : "#e5e7eb"};font-size:14px;">★</span>`
    ).join("");
}

function corAvatar(nome) {
    const cores = ["#6c63ff","#e63946","#2a9d8f","#e9c46a","#f4a261","#264653","#8338ec","#06b6d4"];
    return cores[(nome.charCodeAt(0) || 0) % cores.length];
}

function renderizarAvaliacao(r, container) {
    const item = document.createElement("div");
    item.className = "review-item";
    const nome    = r.nome_autor || "Anônimo";
    const inicial = nome[0].toUpperCase();
    const cor     = corAvatar(nome);
    const data    = r.created_at
        ? new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
        : "";

    item.innerHTML = `
        <div class="review-avatar" style="background:${cor};">${inicial}</div>
        <div class="review-body">
            <div class="reviewer-header">
                <span class="reviewer-name">${nome}</span>
                <div class="review-stars">${estrelasHTML(r.nota)}</div>
                <span class="date">${data}</span>
            </div>
            ${r.comentario ? `<p class="review-text">${r.comentario}</p>` : ""}
        </div>
    `;
    container.appendChild(item);
}

function setupStarSelector() {
    const stars = document.querySelectorAll(".star-opt");
    if (!stars.length) return;
    function pintar(ate) {
        stars.forEach((s, i) => {
            s.textContent = i < ate ? "★" : "☆";
            s.style.color = i < ate ? "#f59e0b" : "#d1d5db";
        });
    }
    stars.forEach(s => {
        s.addEventListener("mouseenter", () => pintar(+s.dataset.val));
        s.addEventListener("mouseleave", () => pintar(notaSelecionada));
        s.addEventListener("click", () => { notaSelecionada = +s.dataset.val; pintar(notaSelecionada); });
    });
}

function preencherNomeLogado() {
    const input   = document.getElementById("review-name");
    if (!input) return;
    const usuario = getUsuarioLogado();
    if (usuario) {
        input.value            = usuario.nome_completo;
        input.readOnly         = true;
        input.style.background = "var(--bg-gray)";
        input.style.color      = "var(--text-mid)";
    } else {
        input.placeholder = "Seu nome (ou deixe em branco para anônimo)";
    }
}

async function enviarAvaliacao() {
    if (notaSelecionada === 0) { showToast("⭐ Selecione pelo menos 1 estrela."); return; }
    const inputNome  = document.getElementById("review-name");
    const inputText  = document.getElementById("review-text");
    const usuario    = getUsuarioLogado();
    const token      = getToken();
    const nome_autor = usuario?.nome_completo || inputNome?.value.trim() || "Anônimo";
    const body = { estabelecimento_id: getLocalId(), nota: notaSelecionada, comentario: inputText?.value.trim() || "", nome_autor };
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
        const res = await fetch(`${API_URL}/avaliacoes`, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) { const err = await res.json(); showToast("❌ " + (err.erro || "Erro ao enviar avaliação.")); return; }
        notaSelecionada = 0;
        if (!usuario && inputNome) inputNome.value = "";
        if (inputText) inputText.value = "";
        document.querySelectorAll(".star-opt").forEach(s => { s.textContent = "☆"; s.style.color = "#d1d5db"; });
        showToast("✅ Avaliação enviada! Obrigado.");
        await carregarAvaliacoes();
    } catch (err) { console.error(err); showToast("❌ Erro de conexão. Tente novamente."); }
}

// ─── PREENCHER PÁGINA ─────────────────────────────────────────────────────────
function updatePage(data) {
    if (!data) return;

    const enderecoExibicao = data.endereco
        || `${data.rua || ""}, ${data.numero || ""} — ${data.bairro || ""}, ${data.cidade || ""}/${data.estado || ""}`.trim();
    const enderecoMaps = data.endereco
        || `${data.rua}, ${data.numero}, ${data.bairro}, ${data.cidade}, ${data.estado}`;
    const faixaPrecoDisplay = faixaPrecoMap[data.faixa_preco] || data.faixa_preco || "—";
    const horarioHTML       = formatarHorario(data.horario || data.horario_funcionamento || data.horarios || null);

    setEl("page-title",   data.nome || "Detalhes do Local");
    setEl("local-name",   data.nome || "—");
    setEl("local-type",   data.tipo || data.categoria_card || "—");
    setEl("hero-address", enderecoExibicao);

    const heroSection = document.getElementById("hero-section");
    if (heroSection && data.img_capa) {
        heroSection.style.backgroundImage    = `url('${data.img_capa}')`;
        heroSection.style.backgroundSize     = "cover";
        heroSection.style.backgroundPosition = "center";
    }

    setEl("local-description",   data.descricao || "Descrição não disponível.");
    setEl("local-contact-phone", data.telefone || "—");
    setElHTML("local-hours",     horarioHTML);

    // Atributos/Tags
    const attributesContainer = document.getElementById("local-attributes");
    if (attributesContainer) {
        attributesContainer.innerHTML = "";
        [data.especialidade, data.tipo, data.categoria_card]
            .filter(t => t && t.trim().length > 0)
            .forEach(tag => {
                const span = document.createElement("span");
                span.textContent = tag;
                attributesContainer.appendChild(span);
            });
    }

    // Comodidades
    if (data.comodidades) {
        const amenitiesMap = {
            "wi-fi":             { icon: "fa-wifi",           label: "Wi-Fi Grátis"      },
            "wifi":              { icon: "fa-wifi",           label: "Wi-Fi Grátis"      },
            "estacionamento":    { icon: "fa-car",            label: "Estacionamento"    },
            "acessibilidade":    { icon: "fa-wheelchair",     label: "Acessibilidade"    },
            "pet friendly":      { icon: "fa-paw",            label: "Pet Friendly"      },
            "delivery":          { icon: "fa-motorcycle",     label: "Delivery"          },
            "música ao vivo":    { icon: "fa-music",          label: "Música ao Vivo"    },
            "ar-condicionado":   { icon: "fa-snowflake",      label: "Ar-condicionado"   },
            "aceita reservas":   { icon: "fa-calendar-check", label: "Aceita Reservas"   },
            "pagamento digital": { icon: "fa-credit-card",    label: "Pagamento Digital" },
            "área externa":      { icon: "fa-umbrella-beach", label: "Área Externa"      },
        };
        const amenitiesList = document.querySelector(".amenities-list");
        if (amenitiesList) {
            amenitiesList.innerHTML = "";
            data.comodidades.split(",").map(c => c.trim()).filter(Boolean).forEach(c => {
                const match = amenitiesMap[c.toLowerCase()];
                const div   = document.createElement("div");
                div.className = "amenity-item";
                div.innerHTML = `<i class="fas ${match ? match.icon : "fa-check"}"></i> ${match ? match.label : c}`;
                amenitiesList.appendChild(div);
            });
        }
    }

    // Pratos
    const menuSection = document.querySelector(".promocionais-section");
    if (menuSection) {
        let pratos = data.pratos;
        if (typeof pratos === "string") { try { pratos = JSON.parse(pratos); } catch { pratos = []; } }
        if (pratos && pratos.length > 0) {
            let html = "<h3>🔥 Pratos e Promoções</h3><p>Preços especiais por tempo limitado!</p>";
            pratos.forEach(p => {
                const preco      = p.preco ? `R$ ${p.preco}` : "Consulte";
                const isPromocao = p.tipo === "promocao";
                html += `
                    <div class="menu-item-row ${isPromocao ? "destaque-promocional" : ""}">
                        <div class="item-details">
                            <h5>${p.titulo}</h5>
                            <p>${p.categoria !== "-" ? p.categoria + " · " : ""}${isPromocao ? "🏷️ Promoção" : "⭐ Destaque"}</p>
                            ${p.descricao ? `<p style="margin-top:3px;">${p.descricao}</p>` : ""}
                        </div>
                        <div class="item-price-container">
                            <span class="${isPromocao ? "item-price-sale" : "item-price"}">${preco}</span>
                        </div>
                    </div>`;
            });
            menuSection.innerHTML = html;
        } else {
            menuSection.innerHTML = `<h3>Pratos Promocionais</h3><p style="color:var(--text-light);">Nenhum prato cadastrado.</p>`;
        }
    }

    // Fotos
    const photoGrid = document.querySelector(".photo-grid");
    if (photoGrid) {
        let fotos = data.fotos_galeria;
        if (typeof fotos === "string") { try { fotos = JSON.parse(fotos); } catch { fotos = []; } }
        if (fotos && fotos.length > 0) {
            photoGrid.innerHTML = "";
            fotos.forEach((src, i) => {
                const img = document.createElement("img");
                img.src = src; img.alt = `Foto ${i + 1}`;
                img.addEventListener("click", () => abrirLightbox(fotos, i));
                photoGrid.appendChild(img);
            });
        } else {
            photoGrid.innerHTML = `<p style="color:var(--text-light);grid-column:1/-1;">Nenhuma foto cadastrada.</p>`;
        }
    }

    // Sidebar
    setEl("sidebar-type",         data.tipo || data.categoria_card || "—");
    setEl("sidebar-price-symbol", faixaPrecoDisplay);
    setElHTML("sidebar-hours",    horarioHTML);
    setEl("sidebar-phone",        data.telefone || "—");
    setEl("sidebar-address",      enderecoExibicao);
    setEl("info-address",         enderecoExibicao);
    setEl("info-phone",           data.telefone || "—");
    setElHTML("info-hours",       horarioHTML);

    const phoneDigits = (data.telefone || "").replace(/[^\d+]/g, "");
    const btnLigar    = document.getElementById("btn-ligar");
    if (btnLigar && phoneDigits) btnLigar.href = `tel:${phoneDigits}`;

    const btnChegar = document.getElementById("btn-como-chegar");
    if (btnChegar) {
        btnChegar.addEventListener("click", () => {
            const destino = encodeURIComponent(enderecoMaps);
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    ({ coords }) => window.open(`https://www.google.com/maps/dir/?api=1&origin=${coords.latitude},${coords.longitude}&destination=${destino}&travelmode=driving`, "_blank"),
                    () => window.open(`https://www.google.com/maps/search/?api=1&query=${destino}`, "_blank")
                );
            } else { window.open(`https://www.google.com/maps/search/?api=1&query=${destino}`, "_blank"); }
        });
    }
}

// ─── ABAS ─────────────────────────────────────────────────────────────────────
function setupTabNavigation() {
    document.querySelectorAll(".tab-button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            button.classList.add("active");
            const target = document.getElementById(button.getAttribute("data-tab"));
            if (target) target.classList.add("active");
        });
    });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    const id = getIdFromUrl();
    if (!id) { console.error("ID não encontrado na URL."); return; }
    const data = await fetchEstabelecimento(id);
    updatePage(data);
    setupTabNavigation();
    carregarEstadoFavorito();
    preencherNomeLogado();
    setupStarSelector();
    await carregarAvaliacoes();

    // ── Registra visita ──
    const userId = localStorage.getItem('userId');
    if (userId && data) {
        fetch(`${API_BASE}/visitas`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                usuarioId:   userId,
                nome:        data.nome || 'Local',
                nome_local:  data.local_nome || data.endereco || '',
                data_visita: new Date().toISOString().split('T')[0],
                tipo:        'estabelecimento',
                item_id:     data.id || 0,
                imagem:      data.img_capa || data.img_logo || '',
                url:         window.location.href
            })
        }).catch(() => {});
    }
});
// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────
function abrirLightbox(fotos, indiceInicial) {
    let indice = indiceInicial;
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.94);
        display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:16px;`;
    const img = document.createElement("img");
    img.style.cssText = "max-width:90vw;max-height:80vh;border-radius:12px;object-fit:contain;";
    const contador = document.createElement("span");
    contador.style.cssText = "color:rgba(255,255,255,0.6);font-size:13px;font-family:'DM Sans',sans-serif;";
    const navRow = document.createElement("div");
    navRow.style.cssText = "display:flex;gap:24px;align-items:center;";
    const btnPrev = document.createElement("button");
    btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnPrev.style.cssText = "background:rgba(255,255,255,0.1);border:1.5px solid rgba(255,255,255,0.2);border-radius:50%;width:44px;height:44px;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;";
    const btnNext = document.createElement("button");
    btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnNext.style.cssText = btnPrev.style.cssText;
    const btnFechar = document.createElement("button");
    btnFechar.innerHTML = '<i class="fas fa-times"></i>';
    btnFechar.style.cssText = "position:fixed;top:20px;right:24px;background:rgba(255,255,255,0.1);border:1.5px solid rgba(255,255,255,0.2);border-radius:50%;width:44px;height:44px;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;";
    function atualizar() {
        img.src = fotos[indice];
        contador.textContent = `${indice + 1} / ${fotos.length}`;
        btnPrev.style.opacity = indice === 0 ? "0.3" : "1";
        btnNext.style.opacity = indice === fotos.length - 1 ? "0.3" : "1";
    }
    btnPrev.addEventListener("click", () => { if (indice > 0) { indice--; atualizar(); } });
    btnNext.addEventListener("click", () => { if (indice < fotos.length - 1) { indice++; atualizar(); } });
    btnFechar.addEventListener("click", () => document.body.removeChild(overlay));
    overlay.addEventListener("click", e => { if (e.target === overlay) document.body.removeChild(overlay); });
    const onKey = e => {
        if (e.key === "ArrowLeft"  && indice > 0)                { indice--; atualizar(); }
        if (e.key === "ArrowRight" && indice < fotos.length - 1) { indice++; atualizar(); }
        if (e.key === "Escape") { document.body.removeChild(overlay); document.removeEventListener("keydown", onKey); }
    };
    document.addEventListener("keydown", onKey);
    navRow.append(btnPrev, contador, btnNext);
    overlay.append(img, navRow, btnFechar);
    document.body.appendChild(overlay);
    atualizar();
}