const API =
    window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://projeto-integrador-roles.onrender.com";
let token = localStorage.getItem("admin_token");
let cur = "dashboard";
let allMsgs = [];
let msgFilterStatus = "all";

const TITLES = {
    dashboard: "Dashboard",
    usuarios: "Usuários",
    estabelecimentos: "Estabelecimentos",
    eventos: "Eventos",
    avaliacoes: "Avaliações",
    ingressos: "Ingressos",
    pedidos: "Pedidos",
    mensagens: "Mensagens",
};
const TIPO_MAP = {
    suporte: "Suporte Técnico",
    parceria: "Parceria Comercial",
    feedback: "Feedback",
    problema: "Problema Técnico",
    imprensa: "Imprensa",
    outros: "Outros",
};
const AV_CLASSES = [
    "msg-av-0",
    "msg-av-1",
    "msg-av-2",
    "msg-av-3",
    "msg-av-4",
];

if (token) {
    try {
        const p = JSON.parse(atob(token.split(".")[1]));
        if (p.role === "admin") showPanel(p);
        else token = null;
    } catch (e) {
        token = null;
    }
}

async function doLogin() {
    const email = v("li-email"),
        senha = v("li-senha");
    const err = el("li-err");
    err.style.display = "none";
    if (!email || !senha) {
        err.style.display = "block";
        return;
    }
    try {
        const r = await fetch(`${API}/usuarios/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha }),
        });
        const d = await r.json();
        if (!r.ok || d.role !== "admin") {
            err.style.display = "block";
            return;
        }
        token = d.token;
        localStorage.setItem("admin_token", token);
        showPanel(d);
    } catch {
        err.style.display = "block";
    }
}

function showPanel(d) {
    el("login").style.display = "none";
    el("sb").style.display = "flex";
    el("main").style.display = "flex";
    const n = d.nome_completo || d.nome || d.email || "Admin";
    el("sb-name").textContent = n;
    el("sb-av").textContent = n
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    loadDash();
}

function logout() {
    localStorage.removeItem("admin_token");
    location.reload();
}
function reload() {
    go(cur, null);
}

function go(p, el_) {
    cur = p;
    document
        .querySelectorAll(".page")
        .forEach((x) => x.classList.remove("on"));
    document
        .querySelectorAll(".sb-item")
        .forEach((x) => x.classList.remove("on"));
    el("pg-" + p).classList.add("on");
    if (el_) el_.classList.add("on");
    el("tb-title").textContent = TITLES[p];
    if (p === "dashboard") loadDash();
    if (p === "usuarios") loadU();
    if (p === "estabelecimentos") loadE();
    if (p === "eventos") loadEv();
    if (p === "avaliacoes") loadAv();
    if (p === "ingressos") loadI();
    if (p === "mensagens") loadMsg();
    if (p === "pedidos") loadPedidos();
}

function el(id) {
    return document.getElementById(id);
}
function v(id) {
    return el(id)?.value?.trim() || "";
}
function esc(s) {
    if (s == null) return "—";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function api(ep) {
    const r = await fetch(`${API}/admin/${ep}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (Array.isArray(d)) return d;
    for (const k of [
        "data",
        "usuarios",
        "estabelecimentos",
        "eventos",
        "avaliacoes",
        "ingressos",
        "items",
        "results",
        "records",
    ])
        if (Array.isArray(d[k])) return d[k];
    for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k];
    return d;
}

async function put(ep, id, body) {
    return fetch(`${API}/admin/${ep}/${id}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function del(ep, id, cb) {
    if (!confirm("Confirmar exclusão?")) return;
    const r = await fetch(`${API}/admin/${ep}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    r.ok ? toast("Excluído", "ok") : toast("Erro ao excluir", "err");
    if (r.ok) cb();
}

async function changeRole(id, role, cb) {
    const r = await fetch(`${API}/admin/usuarios/${id}/role`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
    });
    r.ok
        ? toast(
            role === "admin" ? "Promovido a admin" : "Admin removido",
            "ok",
        )
        : toast("Erro", "err");
    if (r.ok) cb();
}

function showErr(id, msg) {
    const e = el(id);
    if (e) {
        e.textContent = "⚠ " + msg;
        e.style.display = "block";
    }
}
function hideErr(id) {
    const e = el(id);
    if (e) e.style.display = "none";
}

function filter(k) {
    const t = el("s-" + k)?.value?.toLowerCase() || "";
    const rows = document.querySelectorAll("#tb-" + k + " tbody tr");
    let n = 0;
    rows.forEach((r) => {
        const s = r.textContent.toLowerCase().includes(t);
        r.style.display = s ? "" : "none";
        if (s) n++;
    });
    const fc = el("fc-" + k);
    if (fc)
        fc.textContent = t ? n + " resultado" + (n !== 1 ? "s" : "") : "";
}

// ── DASHBOARD ──
async function loadDash() {
    hideErr("err-dash");
    try {
        const r = await fetch(`${API}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const u = d.usuarios ?? "—",
            e = d.estabelecimentos ?? "—",
            ev = d.eventos ?? "—",
            av = d.avaliacoes ?? "—",
            msg = d.mensagens ?? "—";
        el("st-u").textContent = u;
        el("st-e").textContent = e;
        el("st-ev").textContent = ev;
        el("st-av").textContent = av;
        el("st-msg").textContent = msg;
        el("nb-u").textContent = u;
        el("nb-e").textContent = e;
        el("nb-ev").textContent = ev;
        el("nb-av").textContent = av;
        el("nb-msg").textContent = msg;
    } catch (e) {
        showErr("err-dash", "Erro ao carregar dashboard: " + e.message);
    }

    try {
        const evs = await api("eventos");
        el("dc-ev").textContent = evs.length + " total";
        el("d-eventos").innerHTML =
            `<table><thead><tr><th>Nome</th><th>Local</th><th>Data</th></tr></thead><tbody>${evs
                .slice(0, 5)
                .map(
                    (e) =>
                        `<tr><td><span class="bold">${esc(e.nome || "—")}</span></td><td><span class="dim">${esc(e.local_nome || "—")}</span></td><td><span class="mono">${e.data_inicio ? new Date(e.data_inicio).toLocaleDateString("pt-BR") : "—"}</span></td></tr>`,
                )
                .join("")}</tbody></table>`;
    } catch {
        el("d-eventos").innerHTML = '<div class="empty">Indisponível</div>';
    }

    try {
        const avs = await api("avaliacoes");
        el("dc-av").textContent = avs.length + " total";
        el("d-avals").innerHTML =
            `<table><thead><tr><th>Local</th><th>Usuário</th><th>Nota</th></tr></thead><tbody>${avs
                .slice(0, 5)
                .map(
                    (a) =>
                        `<tr><td><span class="mono">${esc(a.estabelecimento_nome || "#" + (a.estabelecimento_id || "—"))}</span></td><td><span class="dim">${esc(a.nome_autor || "—")}</span></td><td><span class="pill p-yw">★ ${a.nota ?? "—"}</span></td></tr>`,
                )
                .join("")}</tbody></table>`;
    } catch {
        el("d-avals").innerHTML = '<div class="empty">Indisponível</div>';
    }

    try {
        const msgs = await api("mensagens");
        el("dc-msg").textContent = msgs.length + " total";
        el("d-msgs").innerHTML = msgs.length
            ? `<table><thead><tr><th>Nome</th><th>Assunto</th><th>Motivo</th><th>Status</th></tr></thead><tbody>${msgs
                .slice(0, 5)
                .map(
                    (m) =>
                        `<tr><td><span class="bold">${esc(m.nome)}</span></td><td><span class="dim">${esc(m.assunto)}</span></td><td><span class="mono">${esc(TIPO_MAP[m.tipo] || m.tipo)}</span></td><td>${statusPill(m.status)}</td></tr>`,
                )
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhuma mensagem.</div>';
    } catch {
        el("d-msgs").innerHTML = '<div class="empty">Indisponível</div>';
    }
}

// ── USUÁRIOS ──
async function loadU() {
    hideErr("err-u");
    el("tb-u").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        const d = await api("usuarios");
        el("c-u").textContent = d.length + " registros";
        el("nb-u").textContent = d.length;
        el("tb-u").innerHTML = d.length
            ? `<table><thead><tr><th>ID</th><th>Nome</th><th>Email</th><th>Perfil</th><th>Verificado</th><th>Cadastro</th><th></th></tr></thead><tbody>${d
                .map(
                    (u) => `<tr>
      <td><span class="mono">#${u.id}</span></td><td><span class="bold">${esc(u.nome_completo || u.nome || "—")}</span></td>
      <td><span class="dim">${esc(u.email || "—")}</span></td>
      <td><span class="pill ${u.role === "admin" ? "p-bl" : "p-dim"}">${u.role || "user"}</span></td>
      <td><span class="pill ${u.verificado ? "p-gn" : "p-dim"}">${u.verificado ? "✔ sim" : "✗ não"}</span></td>
      <td><span class="mono">${u.criado_em || u.created_at ? new Date(u.criado_em || u.created_at).toLocaleDateString("pt-BR") : "—"}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick='openUser(${JSON.stringify(u)})'><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>Editar</button>
        ${u.role === "admin" ? `<button class="act act-dn" onclick="changeRole(${u.id},'user',loadU)">Remover admin</button>` : `<button class="act act-up" onclick="changeRole(${u.id},'admin',loadU)">Tornar admin</button>`}
        <button class="act act-del" onclick="del('usuarios',${u.id},loadU)">Excluir</button>
      </div></td></tr>`,
                )
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhum usuário.</div>';
    } catch (e) {
        showErr("err-u", "Erro: " + e.message);
        el("tb-u").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
}

// ── ESTABELECIMENTOS ──
async function loadE() {
    hideErr("err-e");
    el("tb-e").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        const d = await api("estabelecimentos");
        el("c-e").textContent = d.length + " registros";
        el("nb-e").textContent = d.length;
        el("tb-e").innerHTML = d.length
            ? `<table><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Cidade</th><th>Nota</th><th>Avaliações</th><th></th></tr></thead><tbody>${d
                .map(
                    (e) => `<tr>
      <td><span class="mono">#${e.id}</span></td><td><span class="bold">${esc(e.nome || "—")}</span></td>
      <td><span class="dim">${esc(e.tipo || "—")}</span></td><td><span class="dim">${esc(e.cidade || "—")}</span></td>
      <td><span class="pill p-yw">★ ${e.nota ?? "0.0"}</span></td><td><span class="mono">${e.avaliacoes ?? 0}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick='openEstab(${JSON.stringify(e)})'><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>Editar</button>
        <button class="act act-del" onclick="del('estabelecimentos',${e.id},loadE)">Excluir</button>
      </div></td></tr>`,
                )
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhum estabelecimento.</div>';
    } catch (e) {
        showErr("err-e", "Erro: " + e.message);
        el("tb-e").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
}

// ── EVENTOS ──
async function loadEv() {
    hideErr("err-ev");
    el("tb-ev").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        const d = await api("eventos");
        el("c-ev").textContent = d.length + " registros";
        el("nb-ev").textContent = d.length;
        el("tb-ev").innerHTML = d.length
            ? `<table><thead><tr><th>ID</th><th>Nome</th><th>Local</th><th>Início</th><th>Fim</th><th>Status</th><th></th></tr></thead><tbody>${d
                .map((e) => {
                    const ini = e.data_inicio || e.data,
                        fim = e.data_fim,
                        now = new Date();
                    const dF = fim ? new Date(fim) : null,
                        dI = ini ? new Date(ini) : null;
                    const s = !dF
                        ? !dI || dI < now
                            ? "passado"
                            : "futuro"
                        : dF < now
                            ? "passado"
                            : !dI || dI > now
                                ? "futuro"
                                : "em andamento";
                    return `<tr><td><span class="mono">#${e.id}</span></td>
        <td><span class="bold">${esc(e.nome || "—")}</span><br><span class="mono" style="font-size:9px">${esc(e.assunto || "")}</span></td>
        <td><span class="dim">${esc(e.local_nome || "—")}</span><br><span class="mono" style="font-size:9px">${esc(e.cidade || "")}</span></td>
        <td><span class="mono">${ini ? new Date(ini).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</span></td>
        <td><span class="mono">${fim ? new Date(fim).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</span></td>
        <td><span class="pill ${s === "futuro" ? "p-gn" : s === "em andamento" ? "p-cy" : "p-dim"}">${s}</span></td>
        <td><div class="acts">
          <button class="act act-edit" onclick='openEvento(${JSON.stringify(e)})'><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>Editar</button>
          <button class="act act-del" onclick="del('eventos',${e.id},loadEv)">Excluir</button>
        </div></td></tr>`;
                })
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhum evento.</div>';
    } catch (e) {
        showErr("err-ev", "Erro: " + e.message);
        el("tb-ev").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
}

// ── AVALIAÇÕES ──
async function loadAv() {
    hideErr("err-av");
    el("tb-av").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        const d = await api("avaliacoes");
        el("c-av").textContent = d.length + " registros";
        el("nb-av").textContent = d.length;
        el("tb-av").innerHTML = d.length
            ? `<table><thead><tr><th>ID</th><th>Estabelecimento</th><th>Usuário</th><th>Nota</th><th>Comentário</th><th></th></tr></thead><tbody>${d
                .map(
                    (a) => `<tr>
      <td><span class="mono">#${a.id}</span></td>
      <td><span class="mono">${esc(a.estabelecimento_nome || "#" + (a.estabelecimento_id || "—"))}</span></td>
      <td><span class="mono">${esc(a.nome_autor || a.usuario_nome || "#" + (a.usuario_id || "—"))}</span></td>
      <td><span class="pill p-yw">★ ${a.nota ?? "—"}</span></td>
      <td><span class="dim" style="max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">${esc(a.comentario || "—")}</span></td>
      <td><button class="act act-del" onclick="del('avaliacoes',${a.id},loadAv)">Excluir</button></td>
    </tr>`,
                )
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhuma avaliação.</div>';
    } catch (e) {
        showErr("err-av", "Erro: " + e.message);
        el("tb-av").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
}

// ── INGRESSOS ──
async function loadI() {
    hideErr("err-i");
    el("tb-i").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        const d = await api("ingressos");
        el("c-i").textContent = d.length + " registros";
        el("nb-i").textContent = d.length;
        el("tb-i").innerHTML = d.length
            ? `<table><thead><tr><th>ID</th><th>Título</th><th>Evento</th><th>Tipo</th><th>Valor</th><th>Qtd.</th><th></th></tr></thead><tbody>${d
                .map(
                    (i) => `<tr>
      <td><span class="mono">#${i.id}</span></td><td><span class="bold">${esc(i.titulo || "—")}</span></td>
      <td><span class="dim">${esc(i.evento_nome || "#" + (i.evento_id || "—"))}</span></td>
      <td><span class="pill ${i.tipo === "gratuito" ? "p-gn" : "p-yw"}">${i.tipo || "—"}</span></td>
      <td><span class="mono">${i.tipo === "gratuito" ? "Grátis" : "R$ " + Number(i.valor || 0).toFixed(2)}</span></td>
      <td><span class="mono">${i.quantidade_total ?? "—"}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick='openIngresso(${JSON.stringify(i)})'><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>Editar</button>
        <button class="act act-del" onclick="del('ingressos',${i.id},loadI)">Excluir</button>
      </div></td></tr>`,
                )
                .join("")}</tbody></table>`
            : '<div class="empty">Nenhum ingresso.</div>';
    } catch (e) {
        showErr("err-i", "Erro: " + e.message);
        el("tb-i").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
}

// ── PEDIDOS ──
async function loadPedidos() {
  el("pedidos-body").innerHTML =
    `<tr><td colspan="6"><div class="loading"><div class="spin"></div>carregando...</div></td></tr>`;
  try {
    const d = await api("pedidos");
    el("pedidos-body").innerHTML = d.length
      ? d.map(
          (p) => `<tr>
      <td><span class="mono">#${p.id}</span></td>
      <td><span class="bold">${esc(p.nome_completo || "#" + (p.usuario_id || "—"))}</span></td>
      <td><span class="dim">${esc(p.evento_nome || "#" + (p.evento_id || "—"))}</span></td>
      <td><span class="mono">R$ ${Number(p.valor_total || 0).toFixed(2)}</span></td>
      <td><span class="mono">${p.criado_em ? new Date(p.criado_em).toLocaleDateString("pt-BR") : "—"}</span></td>
      <td><button class="act act-del" onclick="del('pedidos',${p.id},loadPedidos)">Excluir</button></td>
    </tr>`,
        ).join("")
      : `<tr><td colspan="6"><div class="empty">Nenhum pedido.</div></td></tr>`;
  } catch (e) {
    el("pedidos-body").innerHTML =
      `<tr><td colspan="6"><div class="empty">Falha ao carregar: ${esc(e.message)}</div></td></tr>`;
  }
}
// ── MENSAGENS ──
function statusPill(s) {
    if (s === "novo") return '<span class="pill p-bl">● novo</span>';
    if (s === "lido") return '<span class="pill p-yw">● lido</span>';
    if (s === "respondido")
        return '<span class="pill p-gn">✔ respondido</span>';
    return '<span class="pill p-dim">' + s + "</span>";
}

function msgInitials(nome) {
    return (nome || "?")
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function msgAvClass(id) {
    return AV_CLASSES[id % AV_CLASSES.length];
}

function msgFmtDate(d) {
    try {
        const dt = new Date(d);
        return (
            dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
            " · " +
            dt.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
            })
        );
    } catch {
        return "—";
    }
}

function updateMsgStats() {
    const total = allMsgs.length;
    const novas = allMsgs.filter((m) => m.status === "novo").length;
    const lidas = allMsgs.filter((m) => m.status === "lido").length;
    const resp = allMsgs.filter((m) => m.status === "respondido").length;
    el("mst-total").textContent = total;
    el("mst-novas").textContent = novas;
    el("mst-lidas").textContent = lidas;
    el("mst-resp").textContent = resp;
    el("nb-msg").textContent = novas > 0 ? novas : total;
}

async function loadMsg() {
    hideErr("err-msg");
    el("tb-msg").innerHTML =
        '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
        allMsgs = await api("mensagens");
        updateMsgStats();
        renderMsg();
    } catch (e) {
        showErr("err-msg", "Erro: " + e.message);
        el("tb-msg").innerHTML =
            '<div class="empty">Falha ao carregar.</div>';
    }
}

function setMsgFilter(btn) {
    document
        .querySelectorAll(".msg-filter-btn")
        .forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    msgFilterStatus = btn.dataset.status;
    renderMsg();
}

function renderMsg() {
    const q = (el("s-msg")?.value || "").toLowerCase();
    let filtered = allMsgs;
    if (msgFilterStatus !== "all")
        filtered = filtered.filter((m) => m.status === msgFilterStatus);
    if (q)
        filtered = filtered.filter((m) =>
            (m.nome + m.email + m.assunto + m.tipo + m.mensagem)
                .toLowerCase()
                .includes(q),
        );

    const fc = el("fc-msg");
    if (fc)
        fc.textContent =
            q || msgFilterStatus !== "all"
                ? filtered.length +
                " resultado" +
                (filtered.length !== 1 ? "s" : "")
                : "";

    if (!filtered.length) {
        el("tb-msg").innerHTML =
            '<div class="empty">Nenhuma mensagem encontrada.</div>';
        return;
    }

    el("tb-msg").innerHTML = `<div class="msg-list">${filtered
        .map(
            (m) => `
    <div class="msg-card ${m.status === "novo" ? "unread" : ""}">
      <div class="msg-card-top">
        <div class="msg-card-left">
          <div class="msg-avatar ${msgAvClass(m.id)}">${msgInitials(m.nome)}</div>
          <div class="msg-card-info">
            <div class="msg-card-name">${esc(m.nome)}</div>
            <div class="msg-card-email">${esc(m.email)}</div>
          </div>
        </div>
        <div class="msg-card-right">
          <span class="msg-card-date">${msgFmtDate(m.criado_em)}</span>
          <span class="msg-status-badge ${m.status === "novo" ? "msb-novo" : m.status === "lido" ? "msb-lido" : "msb-respondido"}">${m.status === "novo" ? "● Nova" : m.status === "lido" ? "● Lida" : "✔ Respondida"}</span>
        </div>
      </div>
      <div class="msg-card-subject">${esc(m.assunto)}</div>
      <div class="msg-card-preview">${esc(m.mensagem)}</div>
      <div class="msg-card-footer">
        <span class="msg-tipo-tag">${esc(TIPO_MAP[m.tipo] || m.tipo)}</span>
        <div class="msg-card-acts">
          <button class="msg-act-btn reply" onclick='openMsg(${JSON.stringify(m)})'>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z"/></svg>
            ${m.status === "respondido" ? "Ver resposta" : "Responder"}
          </button>
          <button class="msg-act-btn del" onclick="del('mensagens',${m.id},loadMsg)">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>
            Excluir
          </button>
        </div>
      </div>
    </div>
  `,
        )
        .join("")}</div>`;
}

function openMsg(m) {
    el("mm-id").value = m.id;
    el("mm-titulo").textContent = m.nome;
    el("mm-hd-sub").textContent = m.email;

    const avEl = el("mm-hd-avatar");
    avEl.textContent = msgInitials(m.nome);
    avEl.className = "mmsg-hd-avatar " + msgAvClass(m.id);

    el("mm-meta").innerHTML = `
    <div class="mmsg-meta-item"><span>De</span><strong>${esc(m.nome)}</strong></div>
    <div class="mmsg-meta-item"><span>E-mail</span><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
    <div class="mmsg-meta-item"><span>Motivo</span><strong>${esc(TIPO_MAP[m.tipo] || m.tipo)}</strong></div>
    <div class="mmsg-meta-item"><span>Data</span><strong>${new Date(m.criado_em).toLocaleString("pt-BR")}</strong></div>
  `;

    el("mm-corpo").textContent = m.mensagem;

    const replySection = el("mm-reply-section");
    const sendBtn = el("mm-send-btn");

    if (m.status === "respondido") {
        replySection.innerHTML = `
      <div class="mmsg-body-lbl" style="color:var(--green)">✔ Resposta enviada</div>
      <div class="mmsg-reply-responded">${esc(m.resposta || "—")}</div>
    `;
        sendBtn.style.display = "none";
    } else {
        replySection.innerHTML = `
      <div class="mmsg-reply-lbl">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 1L1 6l5 3 2 5 6-13z"/></svg>
        Escrever resposta
      </div>
      <textarea class="mmsg-reply-area" id="mm-resposta" placeholder="Escreva sua resposta aqui…"></textarea>
      <p class="mmsg-reply-hint">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z"/></svg>
        A resposta será enviada para o e-mail do usuário
      </p>
    `;
        sendBtn.style.display = "";
        sendBtn.innerHTML =
            '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" style="margin-right:4px"><path d="M14 1L1 6l5 3 2 5 6-13z"/></svg>Enviar resposta';
        sendBtn.disabled = false;
    }

    om("mensagem");

    if (m.status === "novo") {
        fetch(`${API}/admin/mensagens/${m.id}/lido`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
        }).then(() => {
            const idx = allMsgs.findIndex((x) => x.id === m.id);
            if (idx !== -1) allMsgs[idx].status = "lido";
            updateMsgStats();
        });
    }
}

async function enviarResposta() {
    const id = el("mm-id").value;
    const resposta = (el("mm-resposta")?.value || "").trim();
    if (!resposta) {
        toast("Escreva uma resposta antes de enviar", "err");
        return;
    }
    const btn = el("mm-send-btn");
    btn.textContent = "Enviando…";
    btn.disabled = true;
    try {
        const r = await fetch(`${API}/admin/mensagens/${id}/responder`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ resposta }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro || "Erro ao enviar");
        const idx = allMsgs.findIndex((x) => x.id == id);
        if (idx !== -1) {
            allMsgs[idx].status = "respondido";
            allMsgs[idx].resposta = resposta;
        }
        updateMsgStats();
        toast("Resposta enviada com sucesso!", "ok");
        cm("mensagem");
        renderMsg();
    } catch (e) {
        toast("Erro: " + e.message, "err");
        btn.innerHTML =
            '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" style="margin-right:4px"><path d="M14 1L1 6l5 3 2 5 6-13z"/></svg>Enviar resposta';
        btn.disabled = false;
    }
}

// ── Modais CRUD ──
function om(id) {
    el("mw-" + id).classList.add("on");
}
function cm(id) {
    el("mw-" + id).classList.remove("on");
}
document.querySelectorAll(".modal-wrap").forEach((m) =>
    m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.remove("on");
    }),
);

function openUser(u) {
    el("mu-id").value = u.id;
    el("mu-nome").value = u.nome_completo || u.nome || "";
    el("mu-email").value = u.email || "";
    el("mu-role").value = u.role || "user";
    el("mu-ver").value = String(u.verificado);
    om("usuario");
}
async function saveUser() {
    const id = el("mu-id").value;
    const r = await put("usuarios", id, {
        nome_completo: el("mu-nome").value,
        email: el("mu-email").value,
        role: el("mu-role").value,
        verificado: el("mu-ver").value === "true",
    });
    r.ok
        ? (toast("Usuário salvo", "ok"), cm("usuario"), loadU())
        : toast("Erro ao salvar", "err");
}
function openEstab(e) {
    el("me-id").value = e.id;
    el("me-nome").value = e.nome || "";
    el("me-tipo").value = e.tipo || "";
    el("me-cidade").value = e.cidade || "";
    el("me-end").value = e.endereco || "";
    el("me-desc").value = e.descricao || "";
    om("estab");
}
async function saveEstab() {
    const id = el("me-id").value;
    const r = await put("estabelecimentos", id, {
        nome: el("me-nome").value,
        tipo: el("me-tipo").value,
        cidade: el("me-cidade").value,
        endereco: el("me-end").value,
        descricao: el("me-desc").value,
    });
    r.ok
        ? (toast("Estabelecimento salvo", "ok"), cm("estab"), loadE())
        : toast("Erro ao salvar", "err");
}
function openEvento(e) {
    el("mev-id").value = e.id;
    el("mev-nome").value = e.nome || "";
    el("mev-assunto").value = e.assunto || "";
    el("mev-cat").value = e.categoria || "";
    el("mev-desc").value = e.descricao || "";
    el("mev-prod").value = e.nome_produtor || "";
    el("mev-local").value = e.local_nome || "";
    el("mev-cid").value = e.cidade || "";
    el("mev-est").value = e.estado || "";
    el("mev-cep").value = e.cep || "";
    el("mev-rua").value = e.rua || "";
    if (e.data_inicio) {
        const d = new Date(e.data_inicio);
        el("mev-di").value = d.toISOString().split("T")[0];
        el("mev-hi").value = d.toTimeString().slice(0, 5);
    } else {
        el("mev-di").value = "";
        el("mev-hi").value = "";
    }
    if (e.data_fim) {
        const d = new Date(e.data_fim);
        el("mev-df").value = d.toISOString().split("T")[0];
        el("mev-hf").value = d.toTimeString().slice(0, 5);
    } else {
        el("mev-df").value = "";
        el("mev-hf").value = "";
    }
    om("evento");
}
async function saveEvento() {
    const id = el("mev-id").value;
    const dI = el("mev-di").value,
        hI = el("mev-hi").value || "00:00";
    const dF = el("mev-df").value,
        hF = el("mev-hf").value || "00:00";
    const r = await put("eventos", id, {
        nome: el("mev-nome").value,
        assunto: el("mev-assunto").value,
        categoria: el("mev-cat").value,
        descricao: el("mev-desc").value,
        nome_produtor: el("mev-prod").value,
        local: el("mev-local").value,
        cidade: el("mev-cid").value,
        estado: el("mev-est").value,
        cep: el("mev-cep").value,
        rua: el("mev-rua").value,
        data_inicio: dI ? `${dI} ${hI}:00` : null,
        data_fim: dF ? `${dF} ${hF}:00` : null,
    });
    r.ok
        ? (toast("Evento salvo", "ok"), cm("evento"), loadEv())
        : toast("Erro ao salvar", "err");
}
function openIngresso(i) {
    el("mi-id").value = i.id;
    el("mi-titulo").value = i.titulo || "";
    el("mi-tipo").value = i.tipo || "gratuito";
    el("mi-val").value = i.valor || "";
    el("mi-qtd").value = i.quantidade_total || "";
    om("ingresso");
}
async function saveIngresso() {
    const id = el("mi-id").value;
    const tipo = el("mi-tipo").value;
    const r = await put("ingressos", id, {
        titulo: el("mi-titulo").value,
        tipo,
        valor: tipo === "gratuito" ? 0 : parseFloat(el("mi-val").value || 0),
        quantidade_total: parseInt(el("mi-qtd").value || 1),
    });
    r.ok
        ? (toast("Ingresso salvo", "ok"), cm("ingresso"), loadI())
        : toast("Erro ao salvar", "err");
}

function toast(msg, type = "ok") {
    const t = el("toast");
    el("toast-msg").textContent = msg;
    t.className = `toast ${type} on`;
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("on"), 3000);
}

// ── Sidebar mobile ──
function toggleSb() {
    document.getElementById("sb").classList.toggle("open");
    document.getElementById("sb-overlay").classList.toggle("on");
}
function closeSb() {
    document.getElementById("sb").classList.remove("open");
    document.getElementById("sb-overlay").classList.remove("on");
}

document.addEventListener("DOMContentLoaded", () => {
    // Fechar sidebar ao clicar em item de menu no mobile
    document.querySelectorAll(".sb-item").forEach((item) => {
        item.addEventListener("click", () => {
            if (window.innerWidth <= 900) closeSb();
        });
    });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && el("login").style.display !== "none")
        doLogin();
    if (e.key === "Escape") {
        document
            .querySelectorAll(".modal-wrap.on")
            .forEach((m) => m.classList.remove("on"));
        closeSb();
    }
});
