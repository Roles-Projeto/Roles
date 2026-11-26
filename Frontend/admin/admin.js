// =====================================================
// admin.js — Painel Admin Rolês (arquivo único e completo)
// Ordem interna: base → central de trabalho → protótipo → inicialização
// =====================================================
const API =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://projeto-integrador-roles.onrender.com";
let token = localStorage.getItem("admin_token");
let cur = "dashboard";
let allMsgs = [];
let msgFilterStatus = "all";
let loadDash = async function () {}; // definido na seção "central de trabalho"

// Cache das listas carregadas. Os botões das tabelas passam só o ID no onclick
// e o objeto é buscado aqui (nunca serializar dados do banco dentro de atributo HTML).
const cache = { u: [], e: [], ev: [], i: [] };
const byId = (lista, id) => lista.find((x) => String(x.id) === String(id));

const TITLES = {
  dashboard: "Visão geral", usuarios: "Usuários", estabelecimentos: "Locais", eventos: "Eventos",
  avaliacoes: "Avaliações", ingressos: "Ingressos", pedidos: "Pedidos", mensagens: "Mensagens",
};
const TIPO_MAP = {
  suporte: "Suporte Técnico", parceria: "Parceria Comercial", feedback: "Feedback",
  problema: "Problema Técnico", imprensa: "Imprensa", outros: "Outros",
};
const AV_CLASSES = ["msg-av-0", "msg-av-1", "msg-av-2", "msg-av-3", "msg-av-4"];

/* ── LOGIN + 2FA ── */
let tokenTemp2fa = null;
let modo2fa = null;

function erroLogin(msg) {
  const err = el("li-err");
  err.textContent = msg;
  err.style.display = "block";
}

function mostrarCampoCodigo() {
  const box = document.querySelector(".login-box");
  box.querySelectorAll(".fld").forEach((f) => (f.style.display = "none"));
  let f = el("fld-codigo");
  if (!f) {
    f = document.createElement("div");
    f.className = "fld";
    f.id = "fld-codigo";
    const lb = document.createElement("label");
    lb.textContent = "Código de verificação";
    const inp = document.createElement("input");
    inp.id = "li-codigo";
    inp.type = "text";
    inp.inputMode = "numeric";
    inp.maxLength = 6;
    inp.placeholder = "000000";
    inp.autocomplete = "one-time-code";
    f.append(lb, inp);
    box.querySelector(".btn-enter").before(f);
  }
  f.style.display = "";
  box.querySelector(".btn-enter").textContent = "Verificar código";
  const p = box.querySelector("p");
  if (p) p.textContent = "Enviamos um código de 6 dígitos para o seu e-mail.";
  el("li-err").style.display = "none";
  el("li-codigo").value = "";
  el("li-codigo").focus();
}

function concluirLoginAdmin(d) {
  let role = d.role;
  try { role = JSON.parse(atob(d.token.split(".")[1])).role || role; } catch (e) {}
  if (!["admin", "master"].includes(role)) {
    tokenTemp2fa = null;
    erroLogin("Esta conta não tem permissão de administrador.");
    setTimeout(() => location.reload(), 2500);
    return;
  }
  token = d.token;
  localStorage.setItem("admin_token", token);
  tokenTemp2fa = null;
  showPanel(d);
}

async function verificarCodigoAdmin() {
  const codigo = v("li-codigo");
  if (!/^\d{6}$/.test(codigo)) { erroLogin("Digite os 6 dígitos do código."); return; }
  const setup = modo2fa === "setup";
  const endpoint = setup ? "ativar-inicial" : "verificar-login";
  const body = setup ? { tokenTemporario: tokenTemp2fa, codigo } : { tokenTemporario: tokenTemp2fa, codigo, recuperacao: false };
  try {
    const r = await fetch(`${API}/usuarios/2fa/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (r.ok && d.token) {
      if (setup && Array.isArray(d.codigosRecuperacao)) alert("Guarde seus códigos de recuperação:\n\n" + d.codigosRecuperacao.join("\n"));
      concluirLoginAdmin(d);
      return;
    }
    if (d.expirado) {
      tokenTemp2fa = null;
      erroLogin("O tempo acabou. Entre novamente.");
      setTimeout(() => location.reload(), 2000);
      return;
    }
    erroLogin(d.erro || "Código inválido. Tente novamente.");
  } catch { erroLogin("Não foi possível conectar ao servidor."); }
}

async function doLogin() {
  el("li-err").style.display = "none";
  if (tokenTemp2fa) return verificarCodigoAdmin();
  const email = v("li-email"), senha = v("li-senha");
  if (!email || !senha) { erroLogin("Preencha e-mail e senha."); return; }
  try {
    const r = await fetch(`${API}/usuarios/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha }),
    });
    const d = await r.json();
    if (r.ok && (d.requer2fa || d.requer2faSetup) && d.tokenTemporario) {
      tokenTemp2fa = d.tokenTemporario;
      modo2fa = d.requer2fa ? "login" : "setup";
      mostrarCampoCodigo();
      return;
    }
    if (r.ok && d.token) { concluirLoginAdmin(d); return; }
    erroLogin(d.erro || "Credenciais inválidas ou sem permissão.");
  } catch { erroLogin("Não foi possível conectar ao servidor."); }
}

function showPanel(d) {
  el("login").style.display = "none";
  el("sb").style.display = "flex";
  el("main").style.display = "flex";
  const n = d.nome_completo || d.nome || d.email || "Admin";
  el("sb-name").textContent = n;
  el("sb-av").textContent = n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  loadDash();
}

function logout() { localStorage.removeItem("admin_token"); location.reload(); }
function reload() { go(cur, null); }

function go(p, el_) {
  cur = p;
  document.querySelectorAll(".page").forEach((x) => x.classList.remove("on"));
  document.querySelectorAll(".sb-item").forEach((x) => x.classList.remove("on"));
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

/* ── utilitários ── */
function el(id) { return document.getElementById(id); }
function v(id) { return el(id)?.value?.trim() || ""; }
function esc(s) {
  if (s == null) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// Garante que um valor usado dentro de onclick="..." seja só número
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

async function api(ep) {
  const r = await fetch(`${API}/admin/${ep}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { logout(); throw new Error("Sessão expirada"); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (Array.isArray(d)) return d;
  for (const k of ["data", "usuarios", "estabelecimentos", "eventos", "avaliacoes", "ingressos", "items", "results", "records"])
    if (Array.isArray(d[k])) return d[k];
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) return d[k];
  return d;
}

async function put(ep, id, body) {
  return fetch(`${API}/admin/${ep}/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function del(ep, id, cb) {
  if (!confirm("Confirmar exclusão?")) return;
  const r = await fetch(`${API}/admin/${ep}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  r.ok ? toast("Excluído", "ok") : toast("Erro ao excluir", "err");
  if (r.ok) cb();
}

async function changeRole(id, role, cb) {
  const r = await fetch(`${API}/admin/usuarios/${id}/role`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  r.ok ? toast(role === "admin" ? "Promovido a admin" : "Admin removido", "ok") : toast("Erro", "err");
  if (r.ok) cb();
}

async function setStatus(ep, id, status, cb) {
  // Recusar/bloquear sempre pede o motivo (janela criada na seção "fila com contexto")
  if (status === "bloqueado") return pedirMotivo(ep, id, cb);
  if (status === "aprovado" && !confirm("Aprovar este cadastro? Ele passa a aparecer para o público.")) return;
  await enviarStatus(ep, id, status, null, cb);
}

async function enviarStatus(ep, id, status, motivo, cb) {
  const body = { status };
  if (motivo) body.motivo = motivo;
  const r = await fetch(`${API}/admin/${ep}/${id}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { logout(); return false; }
  let d = {};
  try { d = await r.json(); } catch (e) {}
  if (!r.ok) { toast(d.erro || "Erro ao atualizar", "err"); return false; }
  if (status === "aprovado") toast("Cadastro aprovado", "ok");
  else if (d.email_enviado === false) toast("Cadastro recusado, mas não foi possível avisar o produtor por e-mail", "err");
  else toast("Cadastro recusado e produtor avisado por e-mail", "ok");
  if (cb) cb();
  return true;
}

function showErr(id, msg) { const e = el(id); if (e) { e.textContent = "⚠ " + msg; e.style.display = "block"; } }
function hideErr(id) { const e = el(id); if (e) e.style.display = "none"; }

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
  if (fc) fc.textContent = t ? n + " resultado" + (n !== 1 ? "s" : "") : "";
}

const ICO_EDIT = '<svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>';
const fmtDH = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/* ── USUÁRIOS (versão base; o protótipo substitui por filtros/lote/CSV) ── */
async function loadU() {
  hideErr("err-u");
  el("tb-u").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try {
    const d = await api("usuarios");
    cache.u = d;
    el("c-u").textContent = d.length + " registros";
    el("nb-u").textContent = d.length;
    el("tb-u").innerHTML = d.length
      ? `<table><thead><tr><th>ID</th><th>Nome</th><th>Email</th><th>Perfil</th><th>Verificado</th><th>Cadastro</th><th></th></tr></thead><tbody>${d.map((u) => `<tr>
      <td><span class="mono">#${num(u.id)}</span></td><td><span class="bold">${esc(u.nome_completo || u.nome || "—")}</span></td>
      <td><span class="dim">${esc(u.email || "—")}</span></td>
      <td><span class="pill ${u.role === "admin" ? "p-bl" : "p-dim"}">${esc(u.role || "user")}</span></td>
      <td><span class="pill ${u.verificado ? "p-gn" : "p-dim"}">${u.verificado ? "✔ sim" : "✗ não"}</span></td>
      <td><span class="mono">${u.criado_em || u.created_at ? new Date(u.criado_em || u.created_at).toLocaleDateString("pt-BR") : "—"}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick="openUserById(${num(u.id)})">${ICO_EDIT}Editar</button>
        ${u.role === "admin" ? `<button class="act act-dn" onclick="changeRole(${num(u.id)},'user',loadU)">Remover admin</button>` : `<button class="act act-up" onclick="changeRole(${num(u.id)},'admin',loadU)">Tornar admin</button>`}
        <button class="act act-del" onclick="del('usuarios',${num(u.id)},loadU)">Arquivar</button>
      </div></td></tr>`).join("")}</tbody></table>`
      : '<div class="empty">Nenhum usuário.</div>';
  } catch (e) {
    showErr("err-u", "Erro: " + e.message);
    el("tb-u").innerHTML = '<div class="empty">Falha ao carregar.</div>';
  }
}

/* ── LOCAIS ── */
async function loadE() {
  hideErr("err-e");
  el("tb-e").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try {
    const d = await api("estabelecimentos");
    cache.e = d;
    el("c-e").textContent = d.length + " registros";
    el("nb-e").textContent = d.length;
    el("tb-e").innerHTML = d.length
      ? `<table><thead><tr><th>ID</th><th>Nome</th><th>Tipo</th><th>Cidade</th><th>Nota</th><th>Avaliações</th><th></th></tr></thead><tbody>${d.map((e) => `<tr>
      <td><span class="mono">#${num(e.id)}</span></td><td><span class="bold">${esc(e.nome || "—")}</span></td>
      <td><span class="dim">${esc(e.tipo || "—")}</span></td><td><span class="dim">${esc(e.cidade || "—")}</span></td>
      <td><span class="pill p-yw">★ ${esc(e.nota ?? "0.0")}</span></td><td><span class="mono">${esc(e.avaliacoes ?? 0)}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick="openEstabById(${num(e.id)})">${ICO_EDIT}Editar</button>
        <button class="act act-del" onclick="del('estabelecimentos',${num(e.id)},loadE)">Excluir</button>
      </div></td></tr>`).join("")}</tbody></table>`
      : '<div class="empty">Nenhum estabelecimento.</div>';
  } catch (e) {
    showErr("err-e", "Erro: " + e.message);
    el("tb-e").innerHTML = '<div class="empty">Falha ao carregar.</div>';
  }
}

/* ── EVENTOS (com aprovação) ── */
async function loadEv() {
  hideErr("err-ev");
  el("tb-ev").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try {
    const d = await api("eventos");
    d.sort((a, b) => (a.status_aprovacao === "pendente" ? 0 : 1) - (b.status_aprovacao === "pendente" ? 0 : 1));
    cache.ev = d;
    el("c-ev").textContent = d.length + " registros";
    el("nb-ev").textContent = d.length;
    el("tb-ev").innerHTML = d.length
      ? `<table class="tb-fit"><thead><tr><th>ID</th><th>Evento</th><th>Local</th><th>Quando</th><th>Situação</th><th></th></tr></thead><tbody>${d.map((e) => {
          const ini = e.data_inicio || e.data, fim = e.data_fim, now = new Date();
          const dF = fim ? new Date(fim) : null, dI = ini ? new Date(ini) : null;
          const s = !dF ? (!dI || dI < now ? "passado" : "futuro") : dF < now ? "passado" : !dI || dI > now ? "futuro" : "em andamento";
          const ap = e.status_aprovacao || "aprovado";
          const apPill = ap === "pendente" ? '<span class="pill p-yw">pendente</span>' : ap === "bloqueado" ? '<span class="pill p-rd">recusado</span>' : '<span class="pill p-gn">aprovado</span>';
          const btnAprovar = ap !== "aprovado" ? `<button class="act act-up" onclick="setStatus('eventos',${num(e.id)},'aprovado',loadEv)">Aprovar</button>` : "";
          const btnRecusar = ap === "pendente" ? `<button class="act act-del" onclick="setStatus('eventos',${num(e.id)},'bloqueado',loadEv)">Recusar</button>` : ap === "aprovado" ? `<button class="act act-del" onclick="setStatus('eventos',${num(e.id)},'bloqueado',loadEv)">Bloquear</button>` : "";
          const nome = e.nome || "—", local = e.local_nome || "—";
          return `<tr><td><span class="mono">#${num(e.id)}</span></td>
        <td><span class="bold cut" title="${esc(nome)}">${esc(nome)}</span>${e.assunto ? `<span class="sub">${esc(e.assunto)}</span>` : ""}</td>
        <td><span class="dim cut" title="${esc(local)}">${esc(local)}</span>${e.cidade ? `<span class="sub">${esc(e.cidade)}</span>` : ""}</td>
        <td><span class="mono">${fmtDH(ini)}</span>${s !== "futuro" ? `<span class="sub">${s}</span>` : ""}</td>
        <td>${apPill}</td>
        <td><div class="acts">${ap === "pendente" ? `<button class="act act-edit" onclick="verCadastro('eventos',${num(e.id)})">Detalhes</button>` : ""}${btnAprovar}${btnRecusar}
          <button class="act act-edit" onclick="openEventoById(${num(e.id)})">${ICO_EDIT}Editar</button>
          <button class="act act-del" onclick="del('eventos',${num(e.id)},loadEv)">Arquivar</button>
        </div></td></tr>`;
        }).join("")}</tbody></table>`
      : '<div class="empty">Nenhum evento.</div>';
  } catch (e) {
    showErr("err-ev", "Erro: " + e.message);
    el("tb-ev").innerHTML = '<div class="empty">Falha ao carregar.</div>';
  }
}

/* ── AVALIAÇÕES ── */
async function loadAv() {
  hideErr("err-av");
  el("tb-av").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try {
    const d = await api("avaliacoes");
    el("c-av").textContent = d.length + " registros";
    el("nb-av").textContent = d.length;
    el("tb-av").innerHTML = d.length
      ? `<table><thead><tr><th>ID</th><th>Estabelecimento</th><th>Usuário</th><th>Nota</th><th>Comentário</th><th></th></tr></thead><tbody>${d.map((a) => `<tr>
      <td><span class="mono">#${num(a.id)}</span></td>
      <td><span class="mono">${esc(a.estabelecimento_nome || "#" + (a.estabelecimento_id || "—"))}</span></td>
      <td><span class="mono">${esc(a.nome_autor || a.usuario_nome || "#" + (a.usuario_id || "—"))}</span></td>
      <td><span class="pill p-yw">★ ${esc(a.nota ?? "—")}</span></td>
      <td><span class="dim" style="max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">${esc(a.comentario || "—")}</span></td>
      <td><button class="act act-del" onclick="del('avaliacoes',${num(a.id)},loadAv)">Excluir</button></td>
    </tr>`).join("")}</tbody></table>`
      : '<div class="empty">Nenhuma avaliação.</div>';
  } catch (e) {
    showErr("err-av", "Erro: " + e.message);
    el("tb-av").innerHTML = '<div class="empty">Falha ao carregar.</div>';
  }
}

/* ── INGRESSOS ── */
async function loadI() {
  hideErr("err-i");
  el("tb-i").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try {
    const d = await api("ingressos");
    cache.i = d;
    el("c-i").textContent = d.length + " registros";
    el("nb-i").textContent = d.length;
    el("tb-i").innerHTML = d.length
      ? `<table><thead><tr><th>ID</th><th>Título</th><th>Evento</th><th>Tipo</th><th>Valor</th><th>Qtd.</th><th></th></tr></thead><tbody>${d.map((i) => `<tr>
      <td><span class="mono">#${num(i.id)}</span></td><td><span class="bold">${esc(i.titulo || "—")}</span></td>
      <td><span class="dim">${esc(i.evento_nome || "#" + (i.evento_id || "—"))}</span></td>
      <td><span class="pill ${i.tipo === "gratuito" ? "p-gn" : "p-yw"}">${esc(i.tipo || "—")}</span></td>
      <td><span class="mono">${i.tipo === "gratuito" ? "Grátis" : "R$ " + Number(i.valor || 0).toFixed(2)}</span></td>
      <td><span class="mono">${esc(i.quantidade_total ?? "—")}</span></td>
      <td><div class="acts">
        <button class="act act-edit" onclick="openIngressoById(${num(i.id)})">${ICO_EDIT}Editar</button>
        <button class="act act-del" onclick="del('ingressos',${num(i.id)},loadI)">Excluir</button>
      </div></td></tr>`).join("")}</tbody></table>`
      : '<div class="empty">Nenhum ingresso.</div>';
  } catch (e) {
    showErr("err-i", "Erro: " + e.message);
    el("tb-i").innerHTML = '<div class="empty">Falha ao carregar.</div>';
  }
}

/* ── PEDIDOS ── */
async function loadPedidos() {
  el("pedidos-body").innerHTML = `<tr><td colspan="6"><div class="loading"><div class="spin"></div>carregando...</div></td></tr>`;
  try {
    const d = await api("pedidos");
    el("pedidos-body").innerHTML = d.length
      ? d.map((p) => `<tr>
      <td><span class="mono">#${num(p.id)}</span></td>
      <td><span class="bold">${esc(p.nome_completo || "#" + (p.usuario_id || "—"))}</span></td>
      <td><span class="dim">${esc(p.evento_nome || "#" + (p.evento_id || "—"))}</span></td>
      <td><span class="mono">R$ ${Number(p.valor_total || 0).toFixed(2)}</span></td>
      <td><span class="mono">${p.criado_em ? new Date(p.criado_em).toLocaleDateString("pt-BR") : "—"}</span></td>
      <td><button class="act act-del" onclick="del('pedidos',${num(p.id)},loadPedidos)">Excluir</button></td>
    </tr>`).join("")
      : `<tr><td colspan="6"><div class="empty">Nenhum pedido.</div></td></tr>`;
  } catch (e) {
    el("pedidos-body").innerHTML = `<tr><td colspan="6"><div class="empty">Falha ao carregar: ${esc(e.message)}</div></td></tr>`;
  }
}

/* ── MENSAGENS ── */
function msgInitials(nome) { return (nome || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase(); }
function msgAvClass(id) { return AV_CLASSES[id % AV_CLASSES.length]; }
function msgFmtDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " · " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
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
  el("tb-msg").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
  try { allMsgs = await api("mensagens"); updateMsgStats(); renderMsg(); }
  catch (e) { showErr("err-msg", "Erro: " + e.message); el("tb-msg").innerHTML = '<div class="empty">Falha ao carregar.</div>'; }
}

function setMsgFilter(btn) {
  document.querySelectorAll(".msg-filter-btn").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  msgFilterStatus = btn.dataset.status;
  renderMsg();
}

function renderMsg() {
  const q = (el("s-msg")?.value || "").toLowerCase();
  let filtered = allMsgs;
  if (msgFilterStatus !== "all") filtered = filtered.filter((m) => m.status === msgFilterStatus);
  if (q) filtered = filtered.filter((m) => (m.nome + m.email + m.assunto + m.tipo + m.mensagem).toLowerCase().includes(q));
  const fc = el("fc-msg");
  if (fc) fc.textContent = q || msgFilterStatus !== "all" ? filtered.length + " resultado" + (filtered.length !== 1 ? "s" : "") : "";
  if (!filtered.length) { el("tb-msg").innerHTML = '<div class="empty">Nenhuma mensagem encontrada.</div>'; return; }
  el("tb-msg").innerHTML = `<div class="msg-list">${filtered.map((m) => `
    <div class="msg-card ${m.status === "novo" ? "unread" : ""}">
      <div class="msg-card-top">
        <div class="msg-card-left">
          <div class="msg-avatar ${msgAvClass(num(m.id))}">${esc(msgInitials(m.nome))}</div>
          <div class="msg-card-info"><div class="msg-card-name">${esc(m.nome)}</div><div class="msg-card-email">${esc(m.email)}</div></div>
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
          <button class="msg-act-btn reply" onclick="openMsgById(${num(m.id)})">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z"/></svg>
            ${m.status === "respondido" ? "Ver resposta" : "Responder"}
          </button>
          <button class="msg-act-btn del" onclick="del('mensagens',${num(m.id)},loadMsg)">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>
            Excluir
          </button>
        </div>
      </div>
    </div>`).join("")}</div>`;
}

const ICO_SEND = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" style="margin-right:4px"><path d="M14 1L1 6l5 3 2 5 6-13z"/></svg>';

function openMsgById(id) {
  const m = byId(allMsgs, id);
  if (m) openMsg(m);
}

function openMsg(m) {
  el("mm-id").value = m.id;
  el("mm-titulo").textContent = m.nome;
  el("mm-hd-sub").textContent = m.email;
  const avEl = el("mm-hd-avatar");
  avEl.textContent = msgInitials(m.nome);
  avEl.className = "mmsg-hd-avatar " + msgAvClass(num(m.id));
  el("mm-meta").innerHTML = `
    <div class="mmsg-meta-item"><span>De</span><strong>${esc(m.nome)}</strong></div>
    <div class="mmsg-meta-item"><span>E-mail</span><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
    <div class="mmsg-meta-item"><span>Motivo</span><strong>${esc(TIPO_MAP[m.tipo] || m.tipo)}</strong></div>
    <div class="mmsg-meta-item"><span>Data</span><strong>${new Date(m.criado_em).toLocaleString("pt-BR")}</strong></div>`;
  el("mm-corpo").textContent = m.mensagem;
  const replySection = el("mm-reply-section");
  const sendBtn = el("mm-send-btn");
  if (m.status === "respondido") {
    replySection.innerHTML = `<div class="mmsg-body-lbl" style="color:var(--green)">✔ Resposta enviada</div><div class="mmsg-reply-responded">${esc(m.resposta || "—")}</div>`;
    sendBtn.style.display = "none";
  } else {
    replySection.innerHTML = `
      <div class="mmsg-reply-lbl"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 1L1 6l5 3 2 5 6-13z"/></svg>Escrever resposta</div>
      <textarea class="mmsg-reply-area" id="mm-resposta" placeholder="Escreva sua resposta aqui…"></textarea>
      <p class="mmsg-reply-hint"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z"/></svg>A resposta será enviada para o e-mail do usuário</p>`;
    sendBtn.style.display = "";
    sendBtn.innerHTML = ICO_SEND + "Enviar resposta";
    sendBtn.disabled = false;
  }
  om("mensagem");
  if (m.status === "novo") {
    fetch(`${API}/admin/mensagens/${m.id}/lido`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }).then(() => {
      const idx = allMsgs.findIndex((x) => x.id === m.id);
      if (idx !== -1) allMsgs[idx].status = "lido";
      updateMsgStats();
    });
  }
}

async function enviarResposta() {
  const id = el("mm-id").value;
  const resposta = (el("mm-resposta")?.value || "").trim();
  if (!resposta) { toast("Escreva uma resposta antes de enviar", "err"); return; }
  const btn = el("mm-send-btn");
  btn.textContent = "Enviando…";
  btn.disabled = true;
  try {
    const r = await fetch(`${API}/admin/mensagens/${id}/responder`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ resposta }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || "Erro ao enviar");
    const idx = allMsgs.findIndex((x) => x.id == id);
    if (idx !== -1) { allMsgs[idx].status = "respondido"; allMsgs[idx].resposta = resposta; }
    updateMsgStats();
    toast("Resposta enviada com sucesso!", "ok");
    cm("mensagem");
    renderMsg();
  } catch (e) {
    toast("Erro: " + e.message, "err");
    btn.innerHTML = ICO_SEND + "Enviar resposta";
    btn.disabled = false;
  }
}

/* ── Modais CRUD ── */
function om(id) { el("mw-" + id).classList.add("on"); }
function cm(id) { el("mw-" + id).classList.remove("on"); }
document.querySelectorAll(".modal-wrap").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("on"); }));

function openUserById(id) { const u = byId(cache.u, id); if (u) openUser(u); }
function openEstabById(id) { const e = byId(cache.e, id); if (e) openEstab(e); }
function openEventoById(id) { const e = byId(cache.ev, id); if (e) openEvento(e); }
function openIngressoById(id) { const i = byId(cache.i, id); if (i) openIngresso(i); }

function openUser(u) {
  el("mu-id").value = u.id;
  el("mu-nome").value = u.nome_completo || u.nome || "";
  el("mu-email").value = u.email || "";
  el("mu-role").value = u.role || "user";
    el("mu-ver").value = [true, 1, "1", "true", "t"].includes(u.verificado) ? "true" : "false";
  om("usuario");
}
async function saveUser() {
  const id = el("mu-id").value;
  const r = await put("usuarios", id, {
    nome_completo: el("mu-nome").value, email: el("mu-email").value,
    role: el("mu-role").value, verificado: el("mu-ver").value === "true",
  });
  if (r.status === 401) { logout(); return; }
  if (r.ok) { toast("Usuário salvo", "ok"); cm("usuario"); loadU(); return; }
  let d = {};
  try { d = await r.json(); } catch (e) {}
  toast(d.erro || "Erro ao salvar", "err");
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
    nome: el("me-nome").value, tipo: el("me-tipo").value, cidade: el("me-cidade").value,
    endereco: el("me-end").value, descricao: el("me-desc").value,
  });
  r.ok ? (toast("Estabelecimento salvo", "ok"), cm("estab"), loadE()) : toast("Erro ao salvar", "err");
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
  } else { el("mev-di").value = ""; el("mev-hi").value = ""; }
  if (e.data_fim) {
    const d = new Date(e.data_fim);
    el("mev-df").value = d.toISOString().split("T")[0];
    el("mev-hf").value = d.toTimeString().slice(0, 5);
  } else { el("mev-df").value = ""; el("mev-hf").value = ""; }
  om("evento");
}
async function saveEvento() {
  const id = el("mev-id").value;
  const dI = el("mev-di").value, hI = el("mev-hi").value || "00:00";
  const dF = el("mev-df").value, hF = el("mev-hf").value || "00:00";
  const r = await put("eventos", id, {
    nome: el("mev-nome").value, assunto: el("mev-assunto").value, categoria: el("mev-cat").value,
    descricao: el("mev-desc").value, nome_produtor: el("mev-prod").value, local: el("mev-local").value,
    cidade: el("mev-cid").value, estado: el("mev-est").value, cep: el("mev-cep").value, rua: el("mev-rua").value,
    data_inicio: dI ? `${dI} ${hI}:00` : null, data_fim: dF ? `${dF} ${hF}:00` : null,
  });
  r.ok ? (toast("Evento salvo", "ok"), cm("evento"), loadEv()) : toast("Erro ao salvar", "err");
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
    titulo: el("mi-titulo").value, tipo,
    valor: tipo === "gratuito" ? 0 : parseFloat(el("mi-val").value || 0),
    quantidade_total: parseInt(el("mi-qtd").value || 1),
  });
  r.ok ? (toast("Ingresso salvo", "ok"), cm("ingresso"), loadI()) : toast("Erro ao salvar", "err");
}

function toast(msg, type = "ok") {
  const t = el("toast");
  el("toast-msg").textContent = msg;
  t.className = `toast ${type} on`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("on"), 3000);
}

/* ── Sidebar mobile ── */
function toggleSb() {
  document.getElementById("sb").classList.toggle("open");
  document.getElementById("sb-overlay").classList.toggle("on");
}
function closeSb() {
  document.getElementById("sb").classList.remove("open");
  document.getElementById("sb-overlay").classList.remove("on");
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sb-item").forEach((item) => {
    item.addEventListener("click", () => { if (window.innerWidth <= 900) closeSb(); });
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && el("login").style.display !== "none") doLogin();
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-wrap.on").forEach((m) => m.classList.remove("on"));
    closeSb();
  }
});


// =====================================================
// CENTRAL DE TRABALHO — Visão geral, Minhas tarefas, Fila de aprovação
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const arr = (x) => (Array.isArray(x) ? x : []);
  const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const HORA = 36e5;

  let tarefas = [];
  let msgs = [];
  let filtro = "todas";
  let acesso = null;
  let atrib = {};   // "mensagem:12" -> { usuario_id, nome }
  let admins = [];  // lista de administradores (só o Master carrega, para atribuir tarefas)

  // Tipo de atribuição de cada tarefa (usuários sem confirmação não têm responsável)
  const TIPO_ATR = (t) => (t.tipo === "mensagem" ? "mensagem" : t.tipo === "cadastro" ? (t.ep === "eventos" ? "evento" : "local") : null);
  const dono = (t) => { const k = TIPO_ATR(t); return k ? atrib[k + ":" + t.id] || null : null; };
  const euId = () => (acesso && acesso.id != null ? String(acesso.id) : null);
  const souDono = (d) => !!d && String(d.usuario_id) === euId();

  document.querySelector("#pg-tarefas .tk-filters").insertAdjacentHTML("beforeend",
    '<button class="tk-chip" data-f="minhas" onclick="setTkFiltro(this)">Minhas <i>0</i></button>' +
    '<button class="tk-chip" data-f="livres" onclick="setTkFiltro(this)">Sem responsável <i>0</i></button>');

  // Estilos do controle de responsável (ficam aqui para não depender de mexer no CSS)
  const estilo = document.createElement("style");
  estilo.textContent = `
    .tk-own { display: flex; align-items: center; gap: 6px; min-width: 150px; flex-shrink: 0; }
    .tk-own .pill { display: inline-block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tk-row .acts { min-width: 250px; justify-content: flex-end; flex-shrink: 0; }
    .tk-x, .tk-mais { width: 24px; height: 24px; padding: 0; border-radius: 7px; border: 1px solid var(--border-md); background: transparent; color: var(--text-3); cursor: pointer; font: inherit; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .tk-x:hover, .tk-mais:hover { background: var(--surface2); color: var(--text); }
    .tk-row .tk-mais { opacity: 0; transition: opacity 0.12s; }
    .tk-row:hover .tk-mais, .tk-row .tk-mais:focus-visible { opacity: 1; }
    @media (hover: none) { .tk-row .tk-mais { opacity: 1; } }
    @media (max-width: 900px) { .tk-own, .tk-row .acts { min-width: 0; } }
  `;
  document.head.appendChild(estilo);

  // Janela para o Master passar uma tarefa a outra pessoa
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-atribuir">
      <div class="modal" style="width: 380px">
        <div class="modal-hd"><h2>Atribuir tarefa</h2><button class="modal-x" onclick="cm('atribuir')">✕</button></div>
        <div class="modal-bd"><div class="tk-filters" id="at-lista" style="margin: 0"></div></div>
        <div class="modal-ft"><button class="btn-cancel" onclick="cm('atribuir')">Fechar</button></div>
      </div>
    </div>`);
  $("mw-atribuir").addEventListener("click", (e) => { if (e.target === e.currentTarget) cm("atribuir"); });
  window.tkMenu = function (k, id) {
    $("at-lista").innerHTML = admins.length
      ? admins.map((a) => `<button type="button" class="tk-chip" onclick="cm('atribuir');tkAtribuir('${k}',${id},'atribuir',${num(a.id)})">${esc(a.nome_completo || a.email)}</button>`).join("")
      : '<div class="empty" style="padding:12px">Nenhum administrador encontrado.</div>';
    om("atribuir");
  };

  TITLES.tarefas = "Minhas tarefas";
  TITLES.fila = "Fila de aprovação";

  function idade(d) {
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isFinite(t) ? Date.now() - t : 0;
  }
  function fmtIdade(ms) {
    const h = Math.floor(ms / HORA);
    if (h < 1) return "há " + Math.max(1, Math.floor(ms / 6e4)) + " min";
    if (h < 24) return "há " + h + " h";
    const d = Math.floor(h / 24);
    return "há " + d + (d === 1 ? " dia" : " dias");
  }

  function montar(ev, es, ms, us) {
    const t = [];
    const cadastros = (lista, ep, rotulo) =>
      arr(lista)
        .filter((x) => (x.status_aprovacao || "aprovado") === "pendente")
        .forEach((x) => {
          const age = idade(x.criado_em || x.created_at);
          const venceu = age > 24 * HORA;
          t.push({
            tipo: "cadastro", ep, id: x.id, age,
            prio: venceu ? "Urgente" : "Hoje",
            titulo: `Aprovar ${rotulo} "${x.nome || "#" + x.id}"`,
            sub: rotulo === "evento"
              ? "Cadastro de evento" + (x.nome_produtor ? " · " + x.nome_produtor : "")
              : "Cadastro de local" + (x.cidade ? " · " + x.cidade : ""),
            tempo: venceu ? "prazo vencido · " + fmtIdade(age) : "enviado " + fmtIdade(age),
          });
        });
    cadastros(ev, "eventos", "evento");
    cadastros(es, "estabelecimentos", "local");

    arr(ms).filter((m) => m.status !== "respondido").forEach((m) => {
      const age = idade(m.criado_em);
      t.push({
        tipo: "mensagem", id: m.id, age,
        prio: age > 4 * HORA ? "Urgente" : "Hoje",
        titulo: `Responder mensagem #${m.id}`,
        sub: (TIPO_MAP[m.tipo] || m.tipo || "Contato") + " · " + (m.nome || "—"),
        tempo: fmtIdade(age),
      });
    });

    if (us) {
      const n = us.filter((u) => !u.verificado).length;
      if (n > 0)
        t.push({
          tipo: "usuarios", age: 0, prio: "Semana",
          titulo: `Verificar ${plural(n, "usuário", "usuários")} sem confirmação de e-mail`,
          sub: "Reenviar código ou excluir contas inativas",
          tempo: "esta semana",
        });
    }
    const ordem = { Urgente: 0, Hoje: 1, Semana: 2 };
    const meu = (x) => (souDono(dono(x)) ? 0 : 1);
    return t.sort((a, b) => ordem[a.prio] - ordem[b.prio] || meu(a) - meu(b) || b.age - a.age);
  }

  function linha(t) {
    const cor = { Urgente: "p-rd", Hoje: "p-yw", Semana: "p-cy" }[t.prio];
    let acoes;
    if (t.tipo === "cadastro")
      acoes = `<button class="act act-edit" onclick="verCadastro('${t.ep}',${num(t.id)})">Detalhes</button><button class="act act-up" onclick="tkAprovar('${t.ep}',${num(t.id)},'aprovado')">Aprovar</button><button class="act act-del" onclick="tkAprovar('${t.ep}',${num(t.id)},'bloqueado')">Recusar</button>`;
    else if (t.tipo === "mensagem") acoes = `<button class="act act-reply" onclick="tkMsg(${num(t.id)})">Responder</button>`;
    else acoes = `<button class="act act-edit" onclick="goTo('usuarios')">Abrir</button>`;

    // Responsável: "Assumir" (um clique), ou quem está com a tarefa. O Master também vê o "⋯" para atribuir.
    const k = TIPO_ATR(t);
    let resp = "";
    if (k) {
      const d = dono(t), master = !!(acesso && acesso.role === "master");
      const soltar = `<button type="button" class="tk-x" title="Soltar tarefa" aria-label="Soltar tarefa" onclick="tkAtribuir('${k}',${num(t.id)},'soltar')">×</button>`;
      if (!d) resp = `<button class="act act-edit" onclick="tkAtribuir('${k}',${num(t.id)},'assumir')">Assumir</button>`;
      else if (souDono(d)) resp = `<span class="pill p-gn">Com você</span>${soltar}`;
      else resp = `<span class="pill p-dim" title="${esc(d.nome)}">Com ${esc(d.nome)}</span>${master ? soltar : ""}`;
      if (master) resp += `<button type="button" class="tk-mais" title="Atribuir a outra pessoa" aria-label="Atribuir a outra pessoa" onclick="tkMenu('${k}',${num(t.id)})">⋯</button>`;
    }
    return `<div class="tk-row"><span class="tk-prio"><span class="pill ${cor}">${t.prio}</span></span><div class="tk-info"><b>${esc(t.titulo)}</b><span>${esc(t.sub)}</span></div><span class="tk-time">${esc(t.tempo)}</span><span class="tk-own">${resp}</span><div class="acts">${acoes}</div></div>`;
  }

  function filtrar(lista, f) {
    if (f === "urgentes") return lista.filter((t) => t.prio === "Urgente");
    if (f === "hoje") return lista.filter((t) => t.prio === "Hoje");
    if (f === "semana") return lista.filter((t) => t.prio === "Semana");
    if (f === "cadastros") return lista.filter((t) => t.tipo === "cadastro");
    if (f === "mensagens") return lista.filter((t) => t.tipo === "mensagem");
    if (f === "minhas") return lista.filter((t) => souDono(dono(t)));
    if (f === "livres") return lista.filter((t) => TIPO_ATR(t) && !dono(t));
    return lista;
  }

  function renderTarefas() {
    const vazio = '<div class="empty">Tudo em dia. Nenhuma tarefa por aqui.</div>';
    const top = tarefas.slice(0, 6);
    if ($("ct-tasks")) $("ct-tasks").innerHTML = top.length ? top.map(linha).join("") : vazio;
    const lista = filtrar(tarefas, filtro);
    if ($("tk-all")) {
      if (window.tkPainel) window.tkPainel(lista, { dono, souDono, TIPO_ATR, acesso, vazio });
      else $("tk-all").innerHTML = lista.length ? lista.map(linha).join("") : vazio;
    }
    const fila = tarefas.filter((t) => t.tipo === "cadastro");
    if ($("fq-all")) $("fq-all").innerHTML = fila.length ? fila.map(linha).join("") : vazio;
    document.querySelectorAll(".tk-chip").forEach((c) => {
      if (!c.dataset.f) return;
      c.classList.toggle("on", c.dataset.f === filtro);
      const b = c.querySelector("i");
      if (b) b.textContent = filtrar(tarefas, c.dataset.f).length;
    });
  }

  window.goTo = function (p) { go(p, document.querySelector('.sb-item[data-page="' + p + '"]')); };
  window.tkAprovar = function (ep, id, status) {
    const d = atrib[(ep === "eventos" ? "evento" : "local") + ":" + id];
    if (d && !souDono(d) && !confirm(`Este cadastro está com ${d.nome}. Continuar mesmo assim?`)) return;
    setStatus(ep, id, status, loadDash);
  };

  async function carregarAtribuicoes() {
    try {
      const r = await fetch(`${API}/admin/atribuicoes`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return; // tabela ainda não criada ou sem acesso: o painel segue sem responsáveis
      const novo = {};
      arr(await r.json()).forEach((a) => { novo[a.tipo + ":" + a.ref_id] = { usuario_id: a.usuario_id, nome: a.nome_completo || "outra pessoa" }; });
      atrib = novo;
    } catch (e) {}
  }

  window.tkAtribuir = async function (tipo, id, acao, usuarioId) {
    if (acao === "atribuir" && !usuarioId) return;
    const body = { tipo, ref_id: id, acao };
    if (usuarioId) body.usuario_id = Number(usuarioId);
    const r = await fetch(`${API}/admin/atribuicoes`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 401) { logout(); return; }
    let d = {};
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) toast(d.erro || "Erro ao atualizar a tarefa", "err");
    else toast(acao === "assumir" ? "Tarefa assumida" : acao === "soltar" ? "Tarefa liberada" : "Tarefa atribuída", "ok");
    await carregarAtribuicoes();
    renderTarefas();
  };

  window.tkMsg = function (id) {
    const dm = atrib["mensagem:" + id];
    if (dm && !souDono(dm) && !confirm(`Esta mensagem está com ${dm.nome}. Responder mesmo assim?`)) return;
    const m = msgs.find((x) => x.id == id);
    if (!m) return;
    allMsgs = msgs;
    openMsg(m);
  };
  window.setTkFiltro = function (btn) { filtro = btn.dataset.f; renderTarefas(); };

  loadDash = async function () {
    hideErr("err-dash");
    const h = { headers: { Authorization: `Bearer ${token}` } };
    const get = (ep) => api(ep).then(arr).catch(() => null);
    const [cont, ac, ev, es, ms, us, av] = await Promise.all([
      fetch(`${API}/admin/dashboard`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API}/admin/acesso`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      get("eventos"), get("estabelecimentos"), get("mensagens"), get("usuarios"), get("avaliacoes"),
    ]);
    if (!cont && !ev && !es && !ms) showErr("err-dash", "Não foi possível carregar os dados. Entre novamente.");

    acesso = ac || acesso;
    await carregarAtribuicoes();
    if (acesso && acesso.role === "master" && !admins.length) {
      try {
        const re = await fetch(`${API}/admin/equipe`, h);
        if (re.ok) admins = arr(await re.json());
      } catch (e) {}
    }
    msgs = arr(ms);
    tarefas = montar(ev, es, ms, us);

    if (acesso) {
      const nome = acesso.nome_completo || "";
      if (nome) {
        setT("sb-name", nome);
        setT("sb-av", nome.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase());
      }
      setT("sb-role", acesso.role === "master" ? "MASTER" : (acesso.cargo || "ADMIN").toUpperCase());
      if (acesso.role !== "master") {
        const p = acesso.permissoes || {};
        document.querySelectorAll(".sb-item[data-mod]").forEach((i) => {
          i.style.display = p[i.dataset.mod] && p[i.dataset.mod].ver ? "" : "none";
        });
      }
    }

    const nCad = tarefas.filter((t) => t.tipo === "cadastro").length;
    const numv = (v, lista) => (v != null ? v : lista ? lista.length : "—");
    setT("nb-u", numv(cont && cont.usuarios, us));
    setT("nb-e", numv(cont && cont.estabelecimentos, es));
    setT("nb-ev", numv(cont && cont.eventos, ev));
    setT("nb-av", numv(cont && cont.avaliacoes, av));
    setT("nb-i", cont && cont.ingressos != null ? cont.ingressos : "—");
    setT("nb-msg", cont && cont.mensagens != null ? cont.mensagens : msgs.filter((m) => m.status === "novo").length);
    setT("nb-tk", tarefas.length);
    setT("nb-fila", nCad);

    const hora = new Date().getHours();
    const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const nomeBase = (acesso && acesso.nome_completo) || ($("sb-name") && $("sb-name").textContent) || "";
    const primeiro = nomeBase && nomeBase !== "—" && !nomeBase.includes("@") ? nomeBase.split(" ")[0] : "";
    setT("ct-hello", primeiro ? `${saud}, ${primeiro}` : saud);
    const urg = tarefas.filter((t) => t.prio === "Urgente").length;
    setT("ct-sub", !tarefas.length
      ? "Tudo em dia. Nenhuma tarefa pendente agora."
      : `Você tem ${plural(tarefas.length, "tarefa", "tarefas")}` + (urg ? ` e ${urg} ${urg === 1 ? "está urgente" : "estão urgentes"}.` : ", nenhuma urgente."));

    const todos = [...arr(ev), ...arr(es)];
    const st = (x) => x.status_aprovacao || "aprovado";
    const aprov = todos.filter((x) => st(x) === "aprovado").length;
    const recus = todos.filter((x) => st(x) === "bloqueado").length;
    const dec = aprov + recus;
    const pct = dec ? Math.round((aprov / dec) * 100) : null;
    setT("ct-ring-pct", pct === null ? "—" : pct + "%");
    if ($("ct-ring")) $("ct-ring").style.background = `conic-gradient(#7c3aed 0 ${pct || 0}%, var(--border-md) 0)`;
    setT("ct-ring-sub", dec ? `${aprov} aprovados de ${dec} avaliados` : "Nenhum cadastro avaliado");

    const venc = tarefas.filter((t) => t.tipo === "cadastro" && t.prio === "Urgente").length;
    setT("ct-k1v", nCad);
    setT("ct-k1s", venc ? `${venc} passaram do prazo de 24h` : "nenhum fora do prazo");
    const semResp = msgs.filter((m) => m.status !== "respondido");
    setT("ct-k2v", ms ? semResp.length : "—");
    setT("ct-k2s", semResp.length ? "a mais antiga: " + fmtIdade(Math.max(...semResp.map((m) => idade(m.criado_em)))).replace("há ", "") : "nenhuma esperando");
    const naoVer = us ? us.filter((u) => !u.verificado).length : null;
    setT("ct-k3v", naoVer === null ? "—" : naoVer);
    setT("ct-k3s", us ? `de ${plural(us.length, "usuário", "usuários")}` : "sem acesso");
    const agora = new Date();
    const noAr = ev ? ev.filter((e) => st(e) === "aprovado" && new Date(e.data_fim || e.data_inicio || e.data) >= agora).length : null;
    setT("ct-k4v", noAr === null ? "—" : noAr);
    setT("ct-k4s", ev ? `de ${ev.length} cadastrados` : "sem acesso");

    const res = [
      ["usuarios", "Usuários", numv(cont && cont.usuarios, us)],
      ["estabelecimentos", "Locais", numv(cont && cont.estabelecimentos, es)],
      ["eventos", "Eventos", numv(cont && cont.eventos, ev)],
      ["avaliacoes", "Avaliações", numv(cont && cont.avaliacoes, av)],
      ["ingressos", "Ingressos", cont && cont.ingressos != null ? cont.ingressos : "—"],
    ];
    if ($("ct-sum"))
      $("ct-sum").innerHTML = res.map(([p, n, v]) => `<div class="ct-row" onclick="goTo('${p}')"><span>${n}</span><b>${esc(v)}</b></div>`).join("");

    renderTarefas();
  };

  const goBase = go;
  go = function (p, el_) {
    goBase(p, el_);
    if (p === "tarefas" || p === "fila") renderTarefas();
  };

  const enviarBase = enviarResposta;
  enviarResposta = async function () {
    await enviarBase();
    loadDash();
  };
})();


// admin-prototipo.js — carregar DEPOIS do admin-central.js
// Completa o painel conforme o protótipo: cabeçalho, Meu dia, Usuários,
// Meu perfil, Equipe e Central Master.
(function () {
  const $ = (id) => document.getElementById(id);
  const H = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const call = (m, p, b) => fetch(`${API}${p}`, { method: m, headers: H(), body: b ? JSON.stringify(b) : undefined });
  const nomeU = (u) => u.nome_completo || u.nome || u.email || "—";
  const ini = (n) => String(n).split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  let ac = null, users = [], filtroU = "todos", sel = new Set(), eqList = [], eqSel = null, prev = null;

  TITLES.dashboard = "Visão geral";
  TITLES.perfil = "Meu perfil";
  TITLES.equipe = "Equipe";
  TITLES.master = "Central Master";
  TITLES.auditoria = "Auditoria";

  async function getAc() {
    if (!ac) { try { const r = await call("GET", "/admin/acesso"); if (r.ok) ac = await r.json(); } catch (e) {} }
    return ac;
  }

  /* ── páginas novas ── */
  const content = document.querySelector(".content");
  const mk = (id, html) => { const d = document.createElement("div"); d.className = "page"; d.id = "pg-" + id; d.innerHTML = html; content.appendChild(d); };

  mk("perfil", `
    <div class="pf-head"><div class="pf-av" id="pf-av">—</div><div><b id="pf-nm">—</b><span id="pf-em"></span></div></div>
    <div class="pf-grid">
      <div class="ct-card"><div class="ct-card-hd"><b>Dados pessoais</b></div>
        <div class="mf"><label>Nome completo</label><input id="pf-nome"></div>
        <div class="mf"><label>E-mail</label><input id="pf-email" type="email"></div>
        <div class="mf"><label>Telefone</label><input id="pf-tel"></div>
        <button class="btn-save" onclick="pfSalvar()">Salvar</button></div>
      <div class="ct-card"><div class="ct-card-hd"><b>Alterar senha</b></div>
        <div class="mf"><label>Senha atual</label><input id="pf-sa" type="password"></div>
        <div class="mf"><label>Nova senha</label><input id="pf-sn" type="password" oninput="pfForca()"></div>
        <div class="mf"><label>Confirmar</label><input id="pf-sc" type="password"></div>
        <div class="pf-forca" id="pf-forca"></div>
        <button class="btn-save" onclick="pfSenha()">Atualizar senha</button></div>
      <div class="ct-card"><div class="ct-card-hd"><b>Segurança</b></div>
        <p class="dim">Verificação em 2 etapas por e-mail: o código de 6 dígitos é pedido a cada entrada no painel.</p></div>
    </div>`);

  mk("equipe", `
    <div class="eq-cards" id="eq-cards"></div>
    <div class="ct-card" id="eq-perm"></div>`);

  mk("master", `
    <div class="pf-grid">
      <div class="ct-card"><div class="ct-card-hd"><b>Configurações do sistema</b></div>
        <div class="cf-row"><div><b>Aprovação manual de eventos e locais</b><span>Novos cadastros ficam pendentes</span></div><label class="tg"><input type="checkbox" id="cf-aprov"><i></i></label></div>
        <div class="cf-row"><div><b>Taxa de serviço nos ingressos</b><span>Cobrada do comprador (%)</span></div><input class="cf-num" id="cf-taxa" type="number" min="0" step="0.5"></div>
        <div class="cf-row"><div><b>Tempo de reserva de assento</b><span>Minutos antes de liberar de volta</span></div><input class="cf-num" id="cf-reserva" type="number" min="1"></div>
        <div class="cf-row"><div><b>Modo manutenção</b><span>Mostra aviso no site</span></div><label class="tg"><input type="checkbox" id="cf-manut"><i></i></label></div>
        <button class="btn-save" onclick="cfSalvar()">Salvar configurações</button></div>
      <div class="ct-card"><div class="ct-card-hd"><b>Convidar administrador</b></div>
        <div class="mf"><label>E-mail</label><input id="cv-email" type="email" placeholder="novo@email.com"></div>
        <div class="mf"><label>Cargo</label><select id="cv-cargo"><option>Moderador</option><option>Suporte</option><option>Financeiro</option></select></div>
        <button class="btn-save" onclick="cvEnviar()">Enviar convite</button></div>
    </div>`);

  mk("auditoria", `
    <div class="err-bar" id="err-au"></div>
    <div class="card">
      <div class="card-head">
        <div class="card-head-left"><span class="card-title">Histórico de ações</span><span class="card-badge" id="c-au">—</span></div>
      </div>
      <div class="tbar">
        <div class="srch">
          <svg class="srch-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4" /></svg
          ><input class="srch-inp" type="text" placeholder="Buscar por pessoa ou ação…" id="au-q" />
        </div>
        <select class="cf-num" id="au-p" style="width:auto;text-align:left"><option value="">Todas as pessoas</option></select>
        <span class="filter-ct" id="au-n"></span>
      </div>
      <div id="tb-au"><div class="loading"><div class="spin"></div>carregando...</div></div>
    </div>`);
  $("au-q").addEventListener("input", () => rAu());
  $("au-p").addEventListener("change", () => rAu());

  /* ── cabeçalho: data, busca Ctrl K e alertas ── */
  const d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  document.querySelector(".tb-path").insertAdjacentHTML("beforeend", `<span class="tb-date">${d[0].toUpperCase() + d.slice(1)}</span>`);
  document.querySelector(".tb-right").insertAdjacentHTML("afterbegin",
    `<input class="tb-search" id="tb-q" placeholder="Buscar no menu… Ctrl K"><button class="tb-btn tb-alert" id="tb-al" type="button">Alertas <b id="tb-al-n">0</b></button>`);
  // A busca do campo do topo (Ctrl K) fica na seção "BUSCA GLOBAL", no fim do arquivo
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("tb-q").focus(); }
  });
  $("tb-al").onclick = () => { goTo("tarefas"); document.querySelector('.tk-chip[data-f="urgentes"]').click(); };

  /* botão do cartão de boas-vindas */
  const hb = document.querySelector(".ct-hero-btn");
  hb.textContent = "Começar pelas urgentes";
  hb.onclick = () => $("tb-al").onclick();

  /* ── menu: Equipe e Central Master saem do "em breve" ── */
  document.querySelectorAll(".sb-item.soon").forEach((i) => {
    const t = i.textContent;
    const p = t.includes("Equipe") ? "equipe" : t.includes("Master") ? "master" : t.includes("Auditoria") ? "auditoria" : null;
    if (!p) return;
    i.classList.remove("soon"); i.dataset.page = p; i.dataset.master = "1";
    i.removeAttribute("title"); i.querySelector(".sb-soon")?.remove();
    i.onclick = () => goTo(p);
  });
  const su = document.querySelector(".sb-user");
  su.style.cursor = "pointer"; su.title = "Meu perfil";
  su.onclick = () => goTo("perfil");
  su.lastElementChild.insertAdjacentHTML("beforeend", '<div class="sb-link">Meu perfil · Sair</div>');

  /* ── Meu dia (tarefas concluídas hoje) ── */
  const KEY = "admin_dia_" + new Date().toISOString().slice(0, 10);
  const lerDone = () => { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
  const baseLoad = loadDash;
  loadDash = async function () {
    await baseLoad();
    await getAc();
    const n = parseInt($("nb-tk").textContent) || 0;
    let done = lerDone();
    if (prev !== null && n < prev) { done += prev - n; try { localStorage.setItem(KEY, done); } catch (e) {} }
    prev = n;
    const total = done + n, pct = total ? Math.round((done / total) * 100) : 0;
    $("ct-ring-pct").textContent = `${done}/${total}`;
    $("ct-ring").style.background = `conic-gradient(#7c3aed 0 ${pct}%, var(--border-md) 0)`;
    document.querySelector(".ct-ringcard b").textContent = "Meu dia";
    $("ct-ring-sub").textContent = `${done} ${done === 1 ? "tarefa concluída" : "tarefas concluídas"}. Faltam ${n}.`;
    $("tb-al-n").textContent = document.querySelector('.tk-chip[data-f="urgentes"] i')?.textContent || 0;
    const master = ac && ac.role === "master";
    document.querySelectorAll("[data-master]").forEach((i) => (i.style.display = master ? "" : "none"));
  };

  /* ── roteamento das páginas novas ── */
  const baseGo = go;
  go = function (p, e) {
    baseGo(p, e);
    if (p === "perfil") rPerfil();
    if (p === "equipe") rEquipe();
    if (p === "master") rMaster();
    if (p === "auditoria") rAuditoria();
  };

  /* ── USUÁRIOS ── */
  document.querySelector("#pg-usuarios .card-head").insertAdjacentHTML("beforeend", '<button class="act act-edit" onclick="uCsv()">Exportar CSV</button>');
  const tbar = document.querySelector("#pg-usuarios .tbar");
  tbar.insertAdjacentHTML("afterbegin", '<div class="tk-filters" id="u-chips" style="margin:0"></div>');
  tbar.insertAdjacentHTML("afterend", '<div class="bulk" id="u-bulk"></div>');

  const FU = { todos: () => true, admins: (u) => u.role !== "user", nao: (u) => !u.verificado };
  function rU() {
    $("u-chips").innerHTML = [["todos", "Todos"], ["admins", "Admins"], ["nao", "Não verificados"]]
      .map(([k, t]) => `<button class="tk-chip ${filtroU === k ? "on" : ""}" onclick="uF('${k}')">${t} <i>${users.filter(FU[k]).length}</i></button>`).join("");
    $("c-u").textContent = users.length + " registros";
    $("nb-u").textContent = users.length;
    const b = $("u-bulk");
    b.style.display = sel.size ? "flex" : "none";
    b.innerHTML = `<b>${sel.size} selecionados</b><button class="act act-up" onclick="uBulk('v')">Verificar</button><button class="act act-del" onclick="uBulk('d')">Excluir</button>`;
    const l = users.filter(FU[filtroU]);
    $("tb-u").innerHTML = l.length
      ? `<table><thead><tr><th><input type="checkbox" onchange="uAll(this.checked)"></th><th>Usuário</th><th>Perfil</th><th>Verificado</th><th>Cadastro</th><th></th></tr></thead><tbody>${l.map((u) => `<tr>
        <td><input type="checkbox" ${sel.has(u.id) ? "checked" : ""} onchange="uSel(${num(u.id)},this.checked)"></td>
        <td><div class="u-cell"><i class="u-av">${esc(ini(nomeU(u)))}</i><div><span class="bold">${esc(nomeU(u))}</span><br><span class="mono">${esc(u.email)}</span></div></div></td>
        <td><span class="pill ${u.role === "user" ? "p-dim" : "p-bl"}">${esc((u.role || "user").toUpperCase())}</span></td>
        <td><span class="pill ${u.verificado ? "p-gn" : "p-dim"}">${u.verificado ? "sim" : "não"}</span></td>
        <td><span class="mono">${u.criado_em || u.created_at ? new Date(u.criado_em || u.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—"}</span></td>
        <td><div class="acts"><button class="act act-edit" onclick="uOpen(${num(u.id)})">Abrir</button><button class="act act-del" onclick="del('usuarios',${num(u.id)},loadU)">Arquivar</button></div></td></tr>`).join("")}</tbody></table>`
      : '<div class="empty">Nenhum usuário.</div>';
  }
  loadU = async function () {
    hideErr("err-u");
    $("tb-u").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try { users = await api("usuarios"); cache.u = users; sel.clear(); rU(); }
    catch (e) { showErr("err-u", "Erro: " + e.message); $("tb-u").innerHTML = '<div class="empty">Falha ao carregar.</div>'; }
  };
  window.uF = (k) => { filtroU = k; rU(); };
  window.uSel = (id, on) => { on ? sel.add(id) : sel.delete(id); rU(); };
  window.uAll = (on) => { sel.clear(); if (on) users.filter(FU[filtroU]).forEach((u) => sel.add(u.id)); rU(); };
  window.uOpen = (id) => openUser(users.find((u) => u.id === id));
  window.uBulk = async (k) => {
    const l = users.filter((u) => sel.has(u.id));
    if (!l.length || !confirm(k === "v" ? `Verificar ${l.length} usuário(s)?` : `Arquivar ${l.length} usuário(s)? Eles saem da lista e o Master pode restaurar depois.`)) return;
    let ok = 0;
    for (const u of l) {
      const r = k === "v"
        ? await put("usuarios", u.id, { nome_completo: nomeU(u), email: u.email, role: u.role || "user", verificado: true })
        : await fetch(`${API}/admin/usuarios/${u.id}/arquivar`, { method: "PUT", headers: H(), body: JSON.stringify({ motivo: "Arquivado em lote" }) });
      if (r.ok) ok++;
    }
    toast(`${ok} de ${l.length} concluídos`, ok === l.length ? "ok" : "err");
    loadU();
  };
  window.uCsv = () => {
    const rows = [["id", "nome", "email", "perfil", "verificado", "cadastro"], ...users.map((u) => [u.id, nomeU(u), u.email || "", u.role || "user", u.verificado ? "sim" : "não", u.criado_em || u.created_at || ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "usuarios.csv"; a.click();
  };

  /* ── MEU PERFIL ── */
  async function rPerfil() {
    await getAc();
    const a = ac || {}, n = a.nome_completo || "";
    $("pf-av").textContent = ini(n || "?");
    $("pf-nm").textContent = n || "—";
    $("pf-em").textContent = a.email || "";
    $("pf-nome").value = n; $("pf-email").value = a.email || ""; $("pf-tel").value = a.telefone || "";
  }
  window.pfSalvar = async () => {
    const r = await call("PUT", "/admin/perfil", { nome_completo: $("pf-nome").value.trim(), email: $("pf-email").value.trim(), telefone: $("pf-tel").value.trim() });
    if (r.ok) { ac = null; toast("Dados salvos", "ok"); loadDash(); } else toast("Erro ao salvar", "err");
  };
  window.pfForca = () => {
    const s = $("pf-sn").value;
    const pts = [s.length >= 8, /[A-Z]/.test(s), /\d/.test(s), /[^A-Za-z0-9]/.test(s)].filter(Boolean).length;
    $("pf-forca").textContent = s ? ["Senha fraca", "Senha fraca", "Senha média", "Senha boa", "Senha forte"][pts] : "";
  };
  window.pfSenha = async () => {
    const n = $("pf-sn").value;
    if (n.length < 8) return toast("A nova senha precisa de 8 caracteres ou mais", "err");
    if (n !== $("pf-sc").value) return toast("As senhas não conferem", "err");
    const r = await call("PUT", "/admin/perfil/senha", { senhaAtual: $("pf-sa").value, novaSenha: n });
    if (r.ok) { toast("Senha atualizada", "ok"); ["pf-sa", "pf-sn", "pf-sc"].forEach((i) => ($(i).value = "")); } else toast("Erro ao atualizar a senha", "err");
  };

  /* ── EQUIPE ── */
  const MODS = [["usuarios", "Usuários"], ["estabelecimentos", "Locais"], ["eventos", "Eventos"], ["avaliacoes", "Avaliações"], ["ingressos", "Ingressos"], ["pedidos", "Pedidos"], ["mensagens", "Mensagens"]];
  const ACOES = ["ver", "editar", "aprovar", "excluir"];
  async function rEquipe() {
    $("eq-cards").innerHTML = '<div class="loading"><div class="spin"></div></div>';
    try { eqList = (await api("usuarios")).filter((u) => u.role === "admin" || u.role === "master"); }
    catch (e) { $("eq-cards").innerHTML = '<div class="empty">Falha ao carregar.</div>'; return; }
    if (!eqList.find((u) => u.id === eqSel)) eqSel = (eqList.find((u) => u.role === "admin") || eqList[0] || {}).id;
    drawEq(); loadPerm();
  }
  function drawEq() {
    $("eq-cards").innerHTML = eqList.map((u) => `<div class="eq-card ${u.id === eqSel ? "on" : ""}" onclick="eqPick(${num(u.id)})"><i class="u-av">${esc(ini(nomeU(u)))}</i><div><b>${esc(nomeU(u))}</b><span class="pill ${u.role === "master" ? "p-bl" : "p-yw"}">${u.role === "master" ? "MASTER" : "ADMIN"}</span></div></div>`).join("")
      + '<div class="eq-card inv" onclick="goTo(\'master\')">+ Convidar administrador</div>';
  }
  async function loadPerm() {
    const u = eqList.find((x) => x.id === eqSel), box = $("eq-perm");
    if (!u) { box.innerHTML = '<div class="empty">Nenhum administrador.</div>'; return; }
    if (u.role === "master") { box.innerHTML = '<div class="empty">O Master tem acesso total.</div>'; return; }
    let p = u.permissoes || {};
    try { const r = await call("GET", `/admin/equipe/${u.id}/permissoes`); if (r.ok) { const d = await r.json(); p = d.permissoes || d; } } catch (e) {}
    box.innerHTML = `<div class="ct-card-hd"><b>Permissões de ${esc(nomeU(u))}</b></div>
      <table><thead><tr><th>Módulo</th>${ACOES.map((a) => `<th>${a}</th>`).join("")}</tr></thead><tbody>${MODS.map(([m, t]) => `<tr><td>${t}</td>${ACOES.map((a) => `<td><label class="tg"><input type="checkbox" data-m="${m}" data-a="${a}" ${p[m] && p[m][a] ? "checked" : ""}><i></i></label></td>`).join("")}</tr>`).join("")}</tbody></table>
      <div style="text-align:right;margin-top:14px"><button class="btn-save" onclick="eqSave()">Salvar permissões</button></div>`;
  }
  window.eqPick = (id) => { eqSel = id; drawEq(); loadPerm(); };
  window.eqSave = async () => {
    const p = {};
    document.querySelectorAll("#eq-perm input[data-m]").forEach((c) => { (p[c.dataset.m] = p[c.dataset.m] || {})[c.dataset.a] = c.checked; });
    const r = await call("PUT", `/admin/equipe/${eqSel}/permissoes`, { permissoes: p });
    toast(r.ok ? "Permissões salvas" : "Erro ao salvar", r.ok ? "ok" : "err");
  };

  /* ── AUDITORIA (só Master) ── */
  let auLista = [];
  const AU_ROTULO = { usuarios: "usuário", estabelecimentos: "local", eventos: "evento", avaliacoes: "avaliação", ingressos: "ingresso", pedidos: "pedido", mensagens: "mensagem" };
  const AU_VERBO = { PUT: "Editou", POST: "Criou", DELETE: "Excluiu" };

  // Registros antigos foram gravados como "PUT /admin/eventos/12/status"; aqui viram texto legível
  function auTexto(a) {
    const m = /^(PUT|POST|DELETE) \/admin\/([a-z]+)(?:\/(\d+))?(?:\/([a-z]+))?/.exec(a || "");
    if (!m) return a || "—";
    const [, met, mod, id, sub] = m;
    const alvo = (AU_ROTULO[mod] || mod) + (id ? " #" + id : "");
    if (sub === "status") return "Status alterado: " + alvo;
    if (sub === "role") return "Cargo alterado: " + alvo;
    if (sub === "responder") return "Resposta enviada: " + alvo;
    return (AU_VERBO[met] || met) + " " + alvo;
  }

    let auCat = "todas";
  window.auCat = (k) => { auCat = k; rAu(); };

  function auInfo(r) {
    const txt = auTexto(r.acao);
    const m = /^([\s\S]*?)\s*\(motivo:\s*([\s\S]*?)\)\s*$/.exec(txt);
    const acao = m ? m[1] : txt, motivo = m ? m[2] : "";
    const w = acao.split(" ")[0];
    const tom = /^(Recusou|Bloqueou|Reembolsou|Cancelou|Excluiu|Arquivou)/.test(w) ? "au-r"
      : /^(Aprovou|Respondeu|Criou)/.test(w) ? "au-g"
      : /^(Assumiu|Atribuiu|Liberou|Soltou)/.test(w) ? "au-p" : "au-n";
    const cat = /^Status/.test(acao) || tom === "au-r" || /^Aprovou/.test(w) ? "decisoes" : tom === "au-p" ? "tarefas" : "outras";
    return { acao, motivo, tom, cat };
  }

  function auDia(d) {
    const t = new Date(d), h = new Date();
    if (isNaN(t)) return "Sem data";
    if (t.toDateString() === h.toDateString()) return "Hoje";
    h.setDate(h.getDate() - 1);
    if (t.toDateString() === h.toDateString()) return "Ontem";
        const s = t.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

    function rAu() {
    const q = $("au-q").value.toLowerCase().trim(), pe = $("au-p").value;
    const tb = document.querySelector("#pg-auditoria .tbar");
    if (tb && !$("au-chips")) tb.insertAdjacentHTML("afterbegin", '<div class="tk-filters" id="au-chips" style="margin:0"></div>');
    const base = auLista.map((r) => ({ r, i: auInfo(r) }));
    const CATS = [["todas", "Todas"], ["decisoes", "Decisões"], ["tarefas", "Tarefas"], ["outras", "Outras"]];
    $("au-chips").innerHTML = CATS.map(([k, t]) =>
      `<button type="button" class="tk-chip ${auCat === k ? "on" : ""}" onclick="auCat('${k}')">${t} <i>${base.filter((x) => k === "todas" || x.i.cat === k).length}</i></button>`).join("");

    const l = base.filter(({ r, i }) =>
      (auCat === "todas" || i.cat === auCat) &&
      (!pe || String(r.usuario_id) === pe) &&
      (!q || (i.acao + " " + i.motivo + " " + (r.nome_completo || "") + " " + (r.email || "")).toLowerCase().includes(q)));
    $("au-n").textContent = q || pe || auCat !== "todas" ? l.length + " resultado" + (l.length !== 1 ? "s" : "") : "";

    if (!l.length) { $("tb-au").innerHTML = '<div class="empty">Nenhum registro encontrado.</div>'; return; }
    let h = "", dia = "";
    const TAGS = { Reembolsou: "reembolso", Recusou: "recusa", Bloqueou: "bloqueio", Respondeu: "resposta", Aprovou: "aprovação", Assumiu: "tarefa", Atribuiu: "tarefa", Liberou: "tarefa", Soltou: "tarefa", Criou: "criação", Excluiu: "exclusão", Arquivou: "arquivo", Cancelou: "cancelamento", Desbloqueou: "desbloqueio", Reenviou: "reenvio" };
    l.forEach(({ r, i }) => {
      const d = auDia(r.criado_em);
      if (d !== dia) { dia = d; h += `<div class="au-dia">${esc(d)}</div>`; }
      const nome = r.nome_completo || r.email || "#" + r.usuario_id;
      const hora = r.criado_em ? new Date(r.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
      const tag = TAGS[i.acao.split(" ")[0]] || (/^Status/.test(i.acao) ? "status" : "edição");
      const acaoHtml = esc(i.acao).replace(/((?:evento|local|pedido|mensagem|usuário|avaliação|ingresso) #\d+)/g, "<b>$1</b>");
      h += `<div class="au-r2">
        <span class="au-h">${esc(hora)}</span>
        <span class="au-p" title="${esc(r.email || "")}">${esc(String(nome).split(" ")[0])}</span>
        <span class="au-t">${acaoHtml}</span>
        <span class="au-tag ${i.tom}">${tag}</span>
      </div>${i.motivo ? `<div class="au-m">Motivo: ${esc(i.motivo)}</div>` : ""}`;
    });
    $("tb-au").innerHTML = `<div class="au-list">${h}</div>`;
  }

  async function rAuditoria() {
    hideErr("err-au");
    $("tb-au").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
      const r = await call("GET", "/admin/auditoria");
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error(r.status === 403 ? "Apenas o Master vê a auditoria" : "HTTP " + r.status);
      auLista = await r.json();
      const pessoas = new Map();
      auLista.forEach((x) => pessoas.set(String(x.usuario_id), x.nome_completo || x.email || "#" + x.usuario_id));
      const atual = $("au-p").value;
      $("au-p").innerHTML = '<option value="">Todas as pessoas</option>' +
        [...pessoas].map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("");
      $("au-p").value = atual;
      $("c-au").textContent = auLista.length + " registros";
      rAu();
    } catch (e) {
      showErr("err-au", "Erro: " + e.message);
      $("tb-au").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
  }

  /* ── CENTRAL MASTER ── */
  async function rMaster() {
    try {
      const r = await call("GET", "/admin/config");
      if (!r.ok) return;
      const c = await r.json();
      $("cf-aprov").checked = !!c.aprovacao_manual;
      $("cf-taxa").value = c.taxa_servico ?? "";
      $("cf-reserva").value = c.tempo_reserva ?? "";
      $("cf-manut").checked = !!c.manutencao;
    } catch (e) {}
  }
  window.cfSalvar = async () => {
    const r = await call("PUT", "/admin/config", { aprovacao_manual: $("cf-aprov").checked, taxa_servico: Number($("cf-taxa").value || 0), tempo_reserva: Number($("cf-reserva").value || 10), manutencao: $("cf-manut").checked });
    toast(r.ok ? "Configurações salvas" : "Erro ao salvar", r.ok ? "ok" : "err");
  };
  window.cvEnviar = async () => {
    const email = $("cv-email").value.trim();
    if (!email) return toast("Informe o e-mail", "err");
    const r = await call("POST", "/admin/equipe/convite", { email, cargo: $("cv-cargo").value });
    if (r.ok) { toast("Convite enviado", "ok"); $("cv-email").value = ""; } else toast("Erro ao enviar o convite", "err");
  };

})();

// =====================================================
// FILA DE APROVAÇÃO COM CONTEXTO — detalhes do cadastro e motivo da recusa
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);

  const MODELOS = [
    ["Informações incompletas", "O cadastro está com informações incompletas ou pouco claras (descrição, data, local ou valores)."],
    ["Imagem inadequada", "A imagem enviada está ilegível, com baixa qualidade ou não é adequada."],
    ["Conteúdo não permitido", "O conteúdo do cadastro não está de acordo com as regras da plataforma."],
    ["Cadastro duplicado", "Este cadastro parece duplicado de outro já existente na plataforma."],
    ["Dados incorretos", "Os dados informados (endereço, data ou contato) parecem incorretos."],
  ];

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-cadastro">
      <div class="mmsg-modal">
        <div class="mmsg-hd">
          <div class="mmsg-hd-left"><div><h2 id="cd-titulo">Cadastro</h2><div class="mmsg-hd-sub" id="cd-sub">—</div></div></div>
          <button class="modal-x" onclick="cm('cadastro')">✕</button>
        </div>
        <div class="mmsg-bd" id="cd-corpo"></div>
        <div class="mmsg-ft" id="cd-ft"></div>
      </div>
    </div>
    <div class="modal-wrap" id="mw-motivo">
      <div class="modal">
        <div class="modal-hd"><h2>Recusar cadastro</h2><button class="modal-x" onclick="cm('motivo')">✕</button></div>
        <div class="modal-bd">
          <div class="mf">
            <label>Motivo (o produtor recebe por e-mail)</label>
            <div class="tk-filters" id="mo-chips" style="margin-bottom:10px"></div>
            <textarea id="mo-texto" placeholder="Explique o que precisa ser corrigido"></textarea>
          </div>
          <div class="err-bar" id="err-mo"></div>
        </div>
        <div class="modal-ft">
          <button class="btn-cancel" onclick="cm('motivo')">Cancelar</button>
          <button class="btn-save" id="mo-ok">Confirmar recusa</button>
        </div>
      </div>
    </div>`);
  ["cadastro", "motivo"].forEach((id) =>
    $("mw-" + id).addEventListener("click", (e) => { if (e.target === e.currentTarget) cm(id); }));
  $("mo-chips").innerHTML = MODELOS.map(([t], i) => `<button type="button" class="tk-chip" onclick="moModelo(${i})">${esc(t)}</button>`).join("");

  window.moModelo = (i) => {
    const t = $("mo-texto"), atual = t.value.trim();
    t.value = atual ? atual + " " + MODELOS[i][1] : MODELOS[i][1];
    t.focus();
  };

  window.pedirMotivo = (ep, id, cb) => {
    $("mo-texto").value = "";
    hideErr("err-mo");
    $("mo-ok").onclick = async () => {
      const motivo = $("mo-texto").value.trim();
      if (motivo.length < 10) { showErr("err-mo", "Explique o motivo em pelo menos 10 caracteres."); return; }
      $("mo-ok").disabled = true;
      const ok = await enviarStatus(ep, id, "bloqueado", motivo, cb);
      $("mo-ok").disabled = false;
      if (ok) cm("motivo");
    };
    om("motivo");
    $("mo-texto").focus();
  };

  window.cdAcao = (ep, id, st) =>
    setStatus(ep, id, st, () => { cm("cadastro"); loadDash(); if (cur === "eventos") loadEv(); });

  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const campo = (rot, v) => `<div class="mmsg-meta-item"><span>${rot}</span><strong>${dado(v)}</strong></div>`;
  const juntar = (...p) => p.filter((x) => x != null && String(x).trim() !== "").join(", ");

  function srcImg(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    return `${API}/uploads/${encodeURI(s.replace(/^\/?(uploads\/)?/, ""))}`;
  }

  function avisos(ep, d) {
    const a = [];
    if (!d.descricao || !String(d.descricao).trim()) a.push("Sem descrição");
    if (d.duplicados > 0) a.push("Existe outro cadastro com o mesmo nome");
    if (ep === "eventos") {
      if (!d.imagem) a.push("Sem imagem");
      if (!(d.ingressos || []).length) a.push("Nenhum ingresso cadastrado");
      const fim = d.data_fim || d.data_inicio;
      if (fim && new Date(fim) < new Date()) a.push("A data do evento já passou");
    } else {
      if (!d.img_capa && !d.img_logo) a.push("Sem imagem");
      if (!d.telefone) a.push("Sem telefone");
      if (!d.endereco && !d.rua) a.push("Sem endereço");
    }
    return a;
  }

  function desenhar(ep, d) {
    const ev = ep === "eventos";
    const ap = d.status_aprovacao || "aprovado";
    const prod = d.produtor;
    const por = prod ? [prod.nome_completo, prod.email ? "(" + prod.email + ")" : ""].filter(Boolean).join(" ") : "Não identificado";
    const statusTxt = ap === "pendente" ? "Pendente" : ap === "bloqueado" ? "Recusado" : "Aprovado";

    $("cd-titulo").textContent = d.nome || "Cadastro #" + d.id;
    $("cd-sub").textContent = (ev ? "Evento" : "Local") + " · #" + d.id;

    let h = "";
    const img = srcImg(ev ? d.imagem : d.img_capa || d.img_logo);
    if (img) h += `<img src="${esc(img)}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:16px" onerror="this.style.display='none'">`;

    const av = avisos(ep, d);
    if (av.length) h += `<div style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:6px">${av.map((x) => `<span class="pill p-yw">${esc(x)}</span>`).join("")}</div>`;

    h += '<div class="mmsg-meta">';
    if (ev) {
      h += campo("Produtor", d.nome_produtor) + campo("Cadastrado por", por)
        + campo("Categoria", d.categoria) + campo("Assunto", d.assunto)
        + campo("Início", d.data_inicio ? fmtDH(d.data_inicio) : "") + campo("Fim", d.data_fim ? fmtDH(d.data_fim) : "")
        + campo("Local", d.local_nome || d.nome_local) + campo("Endereço", juntar(d.rua, d.cidade, d.estado, d.cep))
        + campo("Enviado em", d.criado_em ? fmtDH(d.criado_em) : "") + campo("Status", statusTxt);
    } else {
      h += campo("Tipo", d.tipo) + campo("Especialidade", d.especialidade)
        + campo("Faixa de preço", d.faixa_preco) + campo("Capacidade", d.capacidade)
        + campo("Telefone", d.telefone) + campo("Horário", d.horario)
        + campo("Site", d.site) + campo("CNPJ", d.cnpj)
        + campo("Endereço", d.endereco || juntar(d.rua, d.numero, d.bairro, d.cidade, d.estado, d.cep))
        + campo("Cadastrado por", por)
        + campo("Enviado em", d.criado_em ? fmtDH(d.criado_em) : "") + campo("Status", statusTxt);
    }
    h += "</div>";

    h += `<div class="mmsg-body-lbl">Descrição</div><div class="mmsg-body">${esc(d.descricao && String(d.descricao).trim() ? d.descricao : "Sem descrição")}</div>`;

    if (ev) {
      const ing = d.ingressos || [];
      h += `<div class="mmsg-body-lbl">Ingressos</div><div class="mmsg-body">${ing.length
        ? ing.map((t) => `${esc(t.titulo)} · ${t.tipo === "gratuito" ? "Grátis" : "R$ " + Number(t.valor || 0).toFixed(2)} · ${esc(t.quantidade_total ?? "—")} un.`).join("<br>")
        : "Nenhum ingresso cadastrado."}</div>`;
    }
    $("cd-corpo").innerHTML = h;

    const id = num(d.id);
    $("cd-ft").innerHTML = ap === "aprovado"
      ? `<button class="btn-cancel" onclick="cm('cadastro')">Fechar</button><button class="act act-del" onclick="cdAcao('${ep}',${id},'bloqueado')">Bloquear</button>`
      : `<button class="btn-cancel" onclick="cm('cadastro')">Fechar</button><button class="act act-del" onclick="cdAcao('${ep}',${id},'bloqueado')">Recusar</button><button class="btn-save" onclick="cdAcao('${ep}',${id},'aprovado')">Aprovar</button>`;
  }

  window.verCadastro = async (ep, id) => {
    $("cd-titulo").textContent = "Carregando…";
    $("cd-sub").textContent = "";
    $("cd-corpo").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    $("cd-ft").innerHTML = "";
    om("cadastro");
    try {
      const r = await fetch(`${API}/admin/${ep}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error(r.status === 403 ? "Sem permissão para ver este cadastro" : "HTTP " + r.status);
      desenhar(ep, await r.json());
    } catch (e) {
      $("cd-titulo").textContent = "Cadastro";
      $("cd-corpo").innerHTML = `<div class="empty">Falha ao carregar: ${esc(e.message)}</div>`;
      $("cd-ft").innerHTML = '<button class="btn-cancel" onclick="cm(\'cadastro\')">Fechar</button>';
    }
  };
})();

// =====================================================
// BUSCA GLOBAL (Ctrl K) — usuários, eventos, locais, mensagens e páginas do menu
// =====================================================
(function () {
  const inp = document.getElementById("tb-q");
  if (!inp) return;
  inp.placeholder = "Buscar usuários, eventos, mensagens… Ctrl K";
  inp.autocomplete = "off";

  const wrap = document.createElement("div");
  wrap.className = "tb-search-wrap";
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  const box = document.createElement("div");
  box.className = "bq-res";
  wrap.appendChild(box);

  let itens = [], sel = -1, timer = null, seq = 0;
  const STATUS = { pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Recusado" };

  function paginas(q) {
    return [...document.querySelectorAll(".sb-item[data-page]")]
      .filter((i) => i.style.display !== "none")
      .map((i) => ({
        i,
        nome: [...i.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(),
      }))
      .filter((x) => x.nome && x.nome.toLowerCase().includes(q))
      .slice(0, 4)
      .map((x) => ({ grupo: "Páginas", titulo: x.nome, sub: "Abrir página", acao: () => goTo(x.i.dataset.page) }));
  }

  function desenhar() {
    if (!itens.length) { box.innerHTML = '<div class="bq-vazio">Nenhum resultado.</div>'; return; }
    let h = "", g = "";
    itens.forEach((it, i) => {
      if (it.grupo !== g) { g = it.grupo; h += `<div class="bq-grp">${esc(g)}</div>`; }
      h += `<button type="button" class="bq-item${i === sel ? " sel" : ""}" data-i="${i}"><b>${esc(it.titulo)}</b><span>${esc(it.sub)}</span></button>`;
    });
    box.innerHTML = h;
  }

  function fechar() { box.classList.remove("on"); sel = -1; }

  function abrir(i) {
    const it = itens[i];
    if (!it) return;
    fechar();
    inp.value = "";
    it.acao();
  }

  async function buscar(q) {
    const meu = ++seq;
    const base = paginas(q);
    itens = base; sel = itens.length ? 0 : -1;
    desenhar();
    box.classList.add("on");
    if (q.length < 2) return;
    try {
      const r = await fetch(`${API}/admin/busca?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      if (meu !== seq) return; // chegou depois de uma busca mais nova
      const novos = [];
      (d.usuarios || []).forEach((u) => novos.push({
        grupo: "Usuários", titulo: u.nome_completo || u.email || "#" + u.id,
        sub: `${u.email || "sem e-mail"} · ${u.role || "user"} · #${u.id}`, acao: () => openUser(u),
      }));
      (d.eventos || []).forEach((e) => novos.push({
        grupo: "Eventos", titulo: e.nome || "#" + e.id,
        sub: `${STATUS[e.status_aprovacao] || "Aprovado"}${e.nome_produtor ? " · " + e.nome_produtor : ""} · #${e.id}`,
        acao: () => verCadastro("eventos", e.id),
      }));
      (d.estabelecimentos || []).forEach((e) => novos.push({
        grupo: "Locais", titulo: e.nome || "#" + e.id,
        sub: `${STATUS[e.status_aprovacao] || "Aprovado"}${e.cidade ? " · " + e.cidade : ""} · #${e.id}`,
        acao: () => verCadastro("estabelecimentos", e.id),
      }));
      (d.mensagens || []).forEach((m) => novos.push({
        grupo: "Mensagens", titulo: `${m.nome || "—"}: ${m.assunto || "sem assunto"}`,
        sub: `${m.email || ""} · ${m.status === "novo" ? "Nova" : m.status === "lido" ? "Lida" : "Respondida"} · #${m.id}`,
        acao: () => openMsg(m),
      }));
      (d.pedidos || []).forEach((p) => novos.push({
        grupo: "Pedidos", titulo: `Pedido #${p.id}${p.nome_completo ? " · " + p.nome_completo : ""}`,
        sub: `${p.evento_nome || "—"} · R$ ${Number(p.valor_total || 0).toFixed(2)} · ${p.status || "—"}`,
        acao: () => verPedido(p.id),
      }));
      itens = [...novos, ...base];
      sel = itens.length ? 0 : -1;
      desenhar();
    } catch (e) {
      if (meu !== seq) return;
      box.innerHTML = `<div class="bq-vazio">Não foi possível buscar agora.</div>`;
    }
  }

  inp.addEventListener("input", () => {
    clearTimeout(timer);
    const q = inp.value.toLowerCase().trim();
    if (!q) { seq++; fechar(); return; }
    timer = setTimeout(() => buscar(q), 250);
  });

  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!itens.length) return;
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length;
      desenhar();
      const s = box.querySelector(".sel");
      if (s) s.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel >= 0) abrir(sel);
    } else if (e.key === "Escape") {
      fechar();
      inp.blur();
    }
  });

  inp.addEventListener("focus", () => { if (inp.value.trim() && itens.length) box.classList.add("on"); });
  box.addEventListener("mousedown", (e) => {
    const b = e.target.closest(".bq-item");
    if (!b) return;
    e.preventDefault();
    abrir(Number(b.dataset.i));
  });
  document.addEventListener("mousedown", (e) => { if (!wrap.contains(e.target)) fechar(); });
})();

// =====================================================
// PEDIDOS — tela de Pedidos (detalhe e ações de suporte)
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ST = {
    aprovado: ["Pago", "p-gn"], pendente: ["Pendente", "p-yw"], cortesia: ["Cortesia", "p-bl"],
    cancelado: ["Cancelado", "p-rd"], reembolsado: ["Reembolsado", "p-cy"],
  };
  const FORMA = { credito: "Crédito", debito: "Débito", boleto: "Boleto", pix: "Pix", cortesia: "Cortesia", gratuito: "Gratuito" };
  const stPill = (s) => { const [t, c] = ST[s] || [s || "—", "p-dim"]; return `<span class="pill ${c}">${esc(t)}</span>`; };
  const stTxt = (s) => (ST[s] ? ST[s][0] : s || "—");
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const campo = (rot, v) => `<div class="mmsg-meta-item"><span>${rot}</span><strong>${dado(v)}</strong></div>`;

  $("pg-pedidos").innerHTML = `
    <div class="err-bar" id="err-ped"></div>
    <div class="card">
      <div class="card-head">
        <div class="card-head-left"><span class="card-title">Pedidos</span><span class="card-badge" id="c-ped">—</span></div>
      </div>
      <div class="tbar">
        <div class="tk-filters" id="ped-chips" style="margin:0"></div>
        <div class="srch">
          <svg class="srch-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4" /></svg
          ><input class="srch-inp" type="text" placeholder="Buscar por id, comprador, e-mail, evento…" id="s-ped" />
        </div>
        <span class="filter-ct" id="ped-n"></span>
      </div>
      <div id="tb-pedidos"><div class="loading"><div class="spin"></div>carregando...</div></div>
    </div>`;

  // Detalhe do pedido (reaproveita a janela do cadastro)
  window.verPedido = async (id) => {
    $("cd-titulo").textContent = "Pedido #" + id;
    $("cd-sub").textContent = "Carregando…";
    $("cd-corpo").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    $("cd-ft").innerHTML = "";
    om("cadastro");
    try {
      const r = await fetch(`${API}/admin/pedidos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error(r.status === 403 ? "Sem permissão para ver pedidos" : "HTTP " + r.status);
      const d = await r.json();
      const itens = d.itens || [];
      $("cd-sub").textContent = d.evento_nome || "Evento #" + d.evento_id;
      $("cd-corpo").innerHTML =
        `<div style="margin-bottom:14px">${stPill(d.status)}</div>
         <div class="mmsg-meta">
           ${campo("Comprador", d.nome_completo)}${campo("E-mail", d.email)}
           ${campo("Evento", d.evento_nome)}${campo("Valor total", fmtBRL(d.valor_total))}
           ${campo("Pagamento", FORMA[d.forma_pagamento] || d.forma_pagamento)}${campo("Status", stTxt(d.status))}
           ${campo("Criado em", d.criado_em ? fmtDH(d.criado_em) : "")}${campo("Atualizado em", d.atualizado_em ? fmtDH(d.atualizado_em) : "")}
         </div>
         <div class="mmsg-body-lbl">Itens do pedido</div>
         <div class="mmsg-body">${itens.length
           ? itens.map((t) => `${esc(t.titulo || "Ingresso")} · ${esc(t.quantidade)} un. · ${fmtBRL(t.valor_total)} · ${esc(stTxt(t.status))}${t.assento_id ? " · assento numerado" : ""}`).join("<br>")
           : "Nenhum item registrado neste pedido."}</div>`;
      const bt = (cls, t, st) => `<button class="${cls}" onclick="pedAcao(${num(d.id)},'${st}')">${t}</button>`;
      const reenviar = `<button class="act act-edit" onclick="pedReenviar(${num(d.id)})">Reenviar ingresso</button>`;
      let acoes = "";
      if (d.status === "pendente") acoes = bt("act act-del", "Cancelar pedido", "cancelado") + bt("btn-save", "Confirmar pagamento", "aprovado");
      else if (d.status === "aprovado") acoes = reenviar + bt("act act-del", "Cancelar pedido", "cancelado") + bt("act act-del", "Registrar reembolso", "reembolsado");
      else if (d.status === "cortesia") acoes = reenviar + bt("act act-del", "Cancelar pedido", "cancelado");
      $("cd-ft").innerHTML = `<button class="btn-cancel" onclick="cm('cadastro')">Fechar</button>` + acoes;
    } catch (e) {
      $("cd-corpo").innerHTML = `<div class="empty">Falha ao carregar: ${esc(e.message)}</div>`;
      $("cd-ft").innerHTML = '<button class="btn-cancel" onclick="cm(\'cadastro\')">Fechar</button>';
    }
  };

  // ── Ações do pedido: confirmar pagamento, cancelar e registrar reembolso ──
  const MODELOS_PED = [
    ["Pedido do comprador", "Cancelamento solicitado pelo comprador."],
    ["Pagamento não confirmado", "O pagamento não foi confirmado dentro do prazo."],
    ["Evento cancelado", "O evento foi cancelado ou adiado pelo organizador."],
    ["Compra duplicada", "Identificamos uma compra duplicada deste pedido."],
    ["Suspeita de fraude", "O pedido foi cancelado por suspeita de irregularidade na compra."],
  ];

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-motivo-ped">
      <div class="modal">
        <div class="modal-hd"><h2 id="mp-titulo">Cancelar pedido</h2><button class="modal-x" onclick="cm('motivo-ped')">✕</button></div>
        <div class="modal-bd">
          <p class="dim" id="mp-aviso" style="margin-bottom:14px;line-height:1.55"></p>
          <div class="mf">
            <label>Motivo (o comprador recebe por e-mail)</label>
            <div class="tk-filters" id="mp-chips" style="margin-bottom:10px"></div>
            <textarea id="mp-texto" placeholder="Explique o motivo"></textarea>
          </div>
          <div class="err-bar" id="err-mp"></div>
        </div>
        <div class="modal-ft">
          <button class="btn-cancel" onclick="cm('motivo-ped')">Voltar</button>
          <button class="btn-save" id="mp-ok">Confirmar</button>
        </div>
      </div>
    </div>`);
  $("mw-motivo-ped").addEventListener("click", (e) => { if (e.target === e.currentTarget) cm("motivo-ped"); });
  $("mp-chips").innerHTML = MODELOS_PED.map(([t], i) => `<button type="button" class="tk-chip" onclick="mpModelo(${i})">${esc(t)}</button>`).join("");

  window.mpModelo = (i) => {
    const t = $("mp-texto"), atual = t.value.trim();
    t.value = atual ? atual + " " + MODELOS_PED[i][1] : MODELOS_PED[i][1];
    t.focus();
  };

  async function enviarPedido(id, status, motivo) {
    const body = { status };
    if (motivo) body.motivo = motivo;
    const r = await fetch(`${API}/admin/pedidos/${id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 401) { logout(); return false; }
    let d = {};
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) { toast(d.erro || "Erro ao atualizar o pedido", "err"); return false; }
    const falhou = d.email_enviado === false;
    if (status === "aprovado") {
      toast(falhou ? "Pagamento confirmado, mas não foi possível enviar o ingresso por e-mail" : "Pagamento confirmado e ingresso enviado por e-mail", falhou ? "err" : "ok");
    } else {
      toast((status === "cancelado" ? "Pedido cancelado" : "Reembolso registrado") +
        (falhou ? ", mas não foi possível avisar o comprador por e-mail" : " e comprador avisado por e-mail"), falhou ? "err" : "ok");
    }
    cm("cadastro");
    loadPedidos();
    return true;
  }
  window.pedAcao = (id, status) => {
    if (status === "aprovado") {
      if (confirm("Confirmar o pagamento deste pedido? O comprador receberá o ingresso por e-mail.")) enviarPedido(id, status, null);
      return;
    }
    const cancelar = status === "cancelado";
    $("mp-titulo").textContent = (cancelar ? "Cancelar pedido #" : "Registrar reembolso do pedido #") + id;
    $("mp-aviso").textContent = cancelar
      ? "Os ingressos e assentos deste pedido voltam a ficar disponíveis e o comprador é avisado por e-mail."
      : "Isto registra o reembolso no sistema e libera os ingressos e assentos. A devolução do dinheiro ao comprador precisa ser feita por fora, pelo meio de pagamento usado.";
    $("mp-ok").textContent = cancelar ? "Confirmar cancelamento" : "Registrar reembolso";
    $("mp-texto").value = "";
    hideErr("err-mp");
    $("mp-ok").onclick = async () => {
      const motivo = $("mp-texto").value.trim();
      if (motivo.length < 10) { showErr("err-mp", "Explique o motivo em pelo menos 10 caracteres."); return; }
      $("mp-ok").disabled = true;
      const ok = await enviarPedido(id, status, motivo);
      $("mp-ok").disabled = false;
      if (ok) cm("motivo-ped");
    };
        om("motivo-ped");
    $("mp-texto").focus();
  };

})();

// =====================================================
// NOVIDADES DO PAINEL — arquivar, Locais com aprovação, ...

 

// =====================================================
// NOVIDADES DO PAINEL — arquivar, Locais com aprovação, fila com foco/atalhos/aviso de novos,
// respostas prontas e rascunho nas mensagens.
// COLE ESTE BLOCO INTEIRO NO admin.js, logo ANTES da seção "INICIALIZAÇÃO".
// =====================================================

/* ── 1. ARQUIVAR (substitui o Excluir: o backend bloqueia DELETE e só aceita arquivar) ── */
(function () {
  const $ = (id) => document.getElementById(id);
  const ROT = { usuarios: "usuário", estabelecimentos: "local", eventos: "evento", avaliacoes: "avaliação", ingressos: "ingresso", mensagens: "mensagem" };
  const FEM = { avaliacoes: true, mensagens: true };
  const LISTA = { usuarios: "u", estabelecimentos: "e", eventos: "ev", ingressos: "i" };
  const delBase = del;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-arquivar">
      <div class="modal" style="width: 430px">
        <div class="modal-hd"><h2 id="aq-titulo">Arquivar</h2><button class="modal-x" onclick="cm('arquivar')">✕</button></div>
        <div class="modal-bd">
          <p id="aq-texto" style="line-height:1.6;color:var(--text-2);margin-bottom:14px"></p>
          <div class="mf"><label>Motivo (opcional)</label><input id="aq-motivo" maxlength="200" autocomplete="off"></div>
        </div>
        <div class="modal-ft">
          <button class="btn-cancel" onclick="cm('arquivar')">Cancelar</button>
          <button class="btn-save" id="aq-ok">Arquivar</button>
        </div>
      </div>
    </div>`);
  $("mw-arquivar").addEventListener("click", (e) => { if (e.target === e.currentTarget) cm("arquivar"); });

  del = function (ep, id, cb) {
    if (!ROT[ep]) return delBase(ep, id, cb);
    const lista = LISTA[ep] ? cache[LISTA[ep]] : null;
    const item = lista ? byId(lista, id) : null;
    const rot = ROT[ep];
    const nome = item ? item.nome_completo || item.nome || item.titulo : null;
    const alvo = nome ? `${nome} (#${num(id)})` : `${rot} #${num(id)}`;

    let extra = "";
    if (ep === "estabelecimentos" && item && Number(item.avaliacoes) > 0) {
      const n = Number(item.avaliacoes);
      extra = n === 1 ? "a avaliação ligada a ele" : `as ${n} avaliações ligadas a ele`;
    } else if (ep === "eventos") extra = "os ingressos dele";

    $("aq-titulo").textContent = `Arquivar ${FEM[ep] ? "esta" : "este"} ${rot}?`;
    $("aq-texto").textContent =
      (extra ? `${alvo} e ${extra} saem das listagens do painel.` : `${alvo} sai das listagens do painel.`) +
      " Nada é apagado do banco e o Master pode restaurar depois.";
    $("aq-motivo").value = "";
    $("aq-ok").textContent = `Arquivar ${rot}`;
    $("aq-ok").onclick = async () => {
      $("aq-ok").disabled = true;
      try {
        const r = await fetch(`${API}/admin/${ep}/${num(id)}/arquivar`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: v("aq-motivo") }),
        });
        if (r.status === 401) { logout(); return; }
        let d = {};
        try { d = await r.json(); } catch (e) {}
        if (!r.ok) { toast(d.erro || "Erro ao arquivar", "err"); return; }
        toast("Arquivado", "ok");
        cm("arquivar");
        if (cb) cb();
      } catch (e) {
        toast("Não foi possível conectar ao servidor", "err");
      } finally {
        $("aq-ok").disabled = false;
      }
    };
    om("arquivar");
    $("aq-motivo").focus();
  };
})();

/* ── 2. LOCAIS: filtros por aprovação, coluna Aprovação, Detalhes/Aprovar/Recusar ── */
(function () {
  const $ = (id) => document.getElementById(id);
  let lista = [], filtro = "todos", ordem = null;
  const st = (x) => x.status_aprovacao || "aprovado";
  const FILTROS = {
    todos: () => true,
    pendentes: (x) => st(x) === "pendente",
    recusados: (x) => st(x) === "bloqueado",
  };
  const ROTULOS = { todos: "Todos", pendentes: "Pendentes", recusados: "Recusados" };

  const tbar = document.querySelector("#pg-estabelecimentos .tbar");
  if (tbar) tbar.insertAdjacentHTML("afterbegin", '<div class="tk-filters" id="e-chips" style="margin:0"></div>');

  window.eFiltro = (k) => { filtro = k; rE(); };
  window.eOrdem = () => { ordem = ordem === "asc" ? "desc" : "asc"; rE(); };

  function rE() {
    $("c-e").textContent = lista.length + " registros";
    $("nb-e").textContent = lista.length;
    if ($("e-chips"))
      $("e-chips").innerHTML = Object.keys(FILTROS)
        .map((k) => `<button class="tk-chip ${filtro === k ? "on" : ""}" onclick="eFiltro('${k}')">${ROTULOS[k]} <i>${lista.filter(FILTROS[k]).length}</i></button>`).join("");

    let l = lista.filter(FILTROS[filtro]);
    l = [...l].sort((a, b) => ordem
      ? String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR") * (ordem === "asc" ? 1 : -1)
      : (st(a) === "pendente" ? 0 : 1) - (st(b) === "pendente" ? 0 : 1));

    $("tb-e").innerHTML = l.length
      ? `<table><thead><tr><th>ID</th><th><button type="button" class="fq-sort" onclick="eOrdem()">Nome <span>&#8597;</span></button></th><th>Tipo</th><th>Cidade</th><th>Nota</th><th>Avaliações</th><th>Aprovação</th><th></th></tr></thead><tbody>${l.map((e) => {
          const ap = st(e);
          const pill = ap === "pendente" ? '<span class="pill p-yw">pendente</span>' : ap === "bloqueado" ? '<span class="pill p-rd">recusado</span>' : '<span class="pill p-gn">aprovado</span>';
          const detalhes = ap === "pendente" ? `<button class="act act-edit" onclick="verCadastro('estabelecimentos',${num(e.id)})">Detalhes</button>` : "";
          const aprovar = ap !== "aprovado" ? `<button class="act act-up" onclick="setStatus('estabelecimentos',${num(e.id)},'aprovado',loadE)">Aprovar</button>` : "";
          const recusar = ap === "pendente" ? `<button class="act act-del" onclick="setStatus('estabelecimentos',${num(e.id)},'bloqueado',loadE)">Recusar</button>`
            : ap === "aprovado" ? `<button class="act act-del" onclick="setStatus('estabelecimentos',${num(e.id)},'bloqueado',loadE)">Bloquear</button>` : "";
          return `<tr>
        <td><span class="mono">#${num(e.id)}</span></td><td><span class="bold">${esc(e.nome || "—")}</span></td>
        <td><span class="dim">${esc(e.tipo || "—")}</span></td><td><span class="dim">${esc(e.cidade || "—")}</span></td>
        <td><span class="pill p-yw">★ ${esc(e.nota ?? "0.0")}</span></td><td><span class="mono">${esc(e.avaliacoes ?? 0)}</span></td>
        <td>${pill}</td>
        <td><div class="acts">${detalhes}${aprovar}${recusar}
          <button class="act act-edit" onclick="openEstabById(${num(e.id)})">${ICO_EDIT}Editar</button>
          <button class="act act-del" onclick="del('estabelecimentos',${num(e.id)},loadE)">Arquivar</button>
        </div></td></tr>`;
        }).join("")}</tbody></table>`
      : '<div class="empty">Nenhum local nesta lista.</div>';
    filter("e");
  }

  loadE = async function () {
    hideErr("err-e");
    $("tb-e").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
      lista = await api("estabelecimentos");
      cache.e = lista;
      rE();
    } catch (e) {
      showErr("err-e", "Erro: " + e.message);
      $("tb-e").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
  };
})();

/* ── 3. FILA: foco no item, atalhos D/R/A, aviso de itens novos, número na aba ── */
(function () {
  const $ = (id) => document.getElementById(id);
  const fq = $("fq-all");
  if (!fq) return;

  const BASE = "Rolês Admin";
  const KEY_AUTO = "admin_fila_auto";
  let conhecidos = null;   // chaves "eventos:12" que a tela já mostra
  let ultima = Date.now(); // última vez que a lista foi recarregada
  let foco = null;         // chave do item em foco
  let pend = null;         // decisão em andamento: { key, idx }
  let auto = true;
  try { auto = localStorage.getItem(KEY_AUTO) !== "0"; } catch (e) {}

  fq.insertAdjacentHTML("beforebegin", `
    <div class="fq-novos" id="fq-novos" style="display:none">
      <span id="fq-novos-t"></span>
      <button type="button" class="act act-edit" onclick="fqVerAgora()">Ver agora</button>
    </div>
    <div class="fq-att" id="fq-att"></div>`);
  fq.insertAdjacentHTML("afterend", `
    <label class="fq-auto">
      <span class="tg"><input type="checkbox" id="fq-auto"><i></i></span>
      <span>Depois de decidir, abrir o próximo item automaticamente <em id="fq-pos"></em></span>
    </label>`);
  $("fq-auto").checked = auto;
  $("fq-auto").addEventListener("change", (e) => {
    auto = e.target.checked;
    try { localStorage.setItem(KEY_AUTO, auto ? "1" : "0"); } catch (x) {}
  });

  const linhas = () => [...fq.querySelectorAll(".tk-row")];
  const chave = (r) => {
    const b = r.querySelector('button[onclick^="verCadastro("]');
    const m = b && /verCadastro\('(\w+)',(\d+)\)/.exec(b.getAttribute("onclick"));
    return m ? m[1] + ":" + m[2] : null;
  };
  const chaves = () => linhas().map(chave).filter(Boolean);
  const rowFoco = () => linhas().find((r) => chave(r) === foco);
  const abrir = (key) => { const [ep, id] = key.split(":"); verCadastro(ep, Number(id)); };

  function marcar(acts, sel, tecla) {
    const b = acts.querySelector(sel);
    if (b && !b.querySelector(".fq-k")) b.insertAdjacentHTML("beforeend", ` <kbd class="fq-k">${tecla}</kbd>`);
  }

  function aplicar() {
    linhas().forEach((r) => r.classList.toggle("fq-foco", chave(r) === foco));
    const k = chaves(), i = k.indexOf(foco);
    $("fq-pos").textContent = k.length && i >= 0 ? `(${i + 1} de ${k.length})` : "";
  }

  // Roda a cada vez que a lista da fila é redesenhada
  function enhance() {
    const rows = linhas();
    const keys = rows.map(chave);
    if (pend) {
      const p = pend; pend = null;
      if (!keys.includes(p.key) && keys.length) {
        foco = keys[Math.min(p.idx, keys.length - 1)];
        if (auto) { const alvo = foco; setTimeout(() => abrir(alvo), 200); }
      }
    }
    if (!keys.includes(foco)) foco = keys.find(Boolean) || null;
    rows.forEach((r) => {
      const acts = r.querySelector(".acts");
      if (!acts) return;
      marcar(acts, 'button[onclick^="verCadastro("]', "D");
      marcar(acts, ".act-del", "R");
      marcar(acts, ".act-up", "A");
      if (!acts.querySelector(".fq-prox"))
        acts.insertAdjacentHTML("beforeend", '<button type="button" class="fq-prox" onclick="fqProximo()">Próximo <span>&rarr;</span></button>');
    });
    aplicar();
  }
  new MutationObserver(enhance).observe(fq, { childList: true });

  function mover(d) {
    const k = chaves();
    if (!k.length) return;
    const i = Math.max(0, k.indexOf(foco));
    foco = k[(i + d + k.length) % k.length];
    aplicar();
    const r = rowFoco();
    if (r) r.scrollIntoView({ block: "nearest" });
  }
  window.fqProximo = () => mover(1);
  window.fqVerAgora = () => loadDash();

  fq.addEventListener("click", (e) => {
    if (e.target.closest("button, a")) return;
    const r = e.target.closest(".tk-row");
    if (r && chave(r)) { foco = chave(r); aplicar(); }
  });

  // Guarda qual item está sendo decidido, para abrir o próximo depois
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    const m = /^(?:tkAprovar|cdAcao)\('(\w+)',(\d+)/.exec(b.getAttribute("onclick") || "");
    if (!m) return;
    const key = m[1] + ":" + m[2], idx = chaves().indexOf(key);
    if (idx >= 0) pend = { key, idx };
  }, true);

  // Atalhos: D detalhes, R recusar, A aprovar, setas ou J/K para navegar
  document.addEventListener("keydown", (e) => {
    if (cur !== "fila" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-wrap.on")) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j") { e.preventDefault(); mover(1); return; }
    if (k === "arrowup" || k === "k") { e.preventDefault(); mover(-1); return; }
    const r = rowFoco();
    if (!r) return;
    const alvo = k === "d" ? 'button[onclick^="verCadastro("]' : k === "r" ? ".acts .act-del" : k === "a" ? ".acts .act-up" : null;
    if (!alvo) return;
    const b = r.querySelector(alvo);
    if (b) { e.preventDefault(); b.click(); }
  });

  /* "Atualizado há X s" e número na aba */
  function rotulo() {
    const s = Math.max(0, Math.round((Date.now() - ultima) / 1000));
    $("fq-att").textContent = s < 5 ? "Atualizado agora" : s < 60 ? `Atualizado há ${s} s` : `Atualizado há ${Math.floor(s / 60)} min`;
  }
  const titulo = (n) => { document.title = n > 0 ? `(${n}) ${BASE}` : BASE; };
  setInterval(rotulo, 5000);

  const baseLoad = loadDash;
  loadDash = async function () {
    await baseLoad();
    conhecidos = new Set(chaves());
    ultima = Date.now();
    rotulo();
    $("fq-novos").style.display = "none";
    titulo(parseInt($("nb-fila") && $("nb-fila").textContent, 10) || 0);
    enhance();
  };

  /* Verifica a cada 30 s se chegaram cadastros novos (sem redesenhar a lista sozinho) */
  async function sondar() {
    if (!token || conhecidos === null) return;
    try {
      const [ev, es] = await Promise.all([api("eventos").catch(() => null), api("estabelecimentos").catch(() => null)]);
      if (!Array.isArray(ev) && !Array.isArray(es)) return;
      const pendentes = [];
      [["eventos", ev], ["estabelecimentos", es]].forEach(([m, l]) => {
        if (Array.isArray(l)) l.forEach((x) => { if ((x.status_aprovacao || "aprovado") === "pendente") pendentes.push(m + ":" + x.id); });
      });
      titulo(pendentes.length);
      const novos = pendentes.filter((k) => !conhecidos.has(k));
      if (novos.length) {
        $("fq-novos-t").textContent = novos.length === 1 ? "1 item novo chegou na fila" : `${novos.length} itens novos chegaram na fila`;
        $("fq-novos").style.display = "";
      } else $("fq-novos").style.display = "none";
    } catch (e) {}
  }
  setInterval(sondar, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sondar(); });
})();

/* ── 4. MENSAGENS: respostas prontas, salvar como modelo, rascunho e aviso ao descartar ── */
(function () {
  const $ = (id) => document.getElementById(id);
  const KM = "admin_modelos_resp", KR = "admin_rascunho_";
  const PADRAO = [
    { t: "Ingresso não chegou", c: "Olá, {nome}! Vamos reenviar o seu ingresso para {email}. Confira também a caixa de spam. Se não chegar em 10 minutos, é só responder este e-mail." },
    { t: "Dúvida de pagamento", c: "Olá, {nome}! Recebemos a sua dúvida sobre o pagamento. Pode nos informar o número do pedido e a forma de pagamento usada? Assim conseguimos verificar rapidamente." },
    { t: "Parceria comercial", c: "Olá, {nome}! Obrigado pelo interesse em ser parceiro do Rolês. Pode nos contar um pouco mais sobre o seu estabelecimento ou evento e o que você tem em mente? Voltamos a falar com você em seguida." },
    { t: "Cancelamento", c: "Olá, {nome}! Sobre o cancelamento: pode nos informar o número do pedido e o motivo? O cancelamento segue as regras do organizador do evento, e vamos verificar o seu caso com a equipe." },
  ];

  let msg = null, ultimoModelo = null, ultimoTexto = "", salvoEm = null, tAuto = null;

  const lerModelos = () => {
    try { const a = JSON.parse(localStorage.getItem(KM) || "[]"); return Array.isArray(a) ? a.filter((x) => x && x.t && x.c) : []; }
    catch (e) { return []; }
  };
  const gravarModelos = (a) => {
    try { localStorage.setItem(KM, JSON.stringify(a)); } catch (e) { toast("Não foi possível salvar o modelo neste navegador", "err"); }
  };
  const primeiro = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const preencher = (t, m) => t.replace(/\{nome\}/g, primeiro(m.nome) || "cliente").replace(/\{email\}/g, m.email || "seu e-mail");
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const limparRascunho = (id) => { try { localStorage.removeItem(KR + id); } catch (e) {} };

  function desenharChips() {
    const box = $("mm-modelos");
    if (!box) return;
    const custom = lerModelos();
    box.innerHTML =
      PADRAO.map((x, i) => `<button type="button" class="tk-chip ${ultimoModelo === "p" + i ? "mm-sel" : ""}" onclick="mmModelo('p',${i})">${esc(x.t)}</button>`).join("") +
      custom.map((x, i) => `<span class="mm-cm"><button type="button" class="tk-chip ${ultimoModelo === "c" + i ? "mm-sel" : ""}" onclick="mmModelo('c',${i})">${esc(x.t)}</button><button type="button" class="tk-x" title="Remover modelo" aria-label="Remover modelo" onclick="mmRemover(${i})">×</button></span>`).join("") +
      '<button type="button" class="tk-chip" onclick="mmSalvarModelo()">+ Salvar como modelo</button>';
  }

  function rotuloRasc() {
    const e = $("mm-rasc");
    if (!e) return;
    if (!salvoEm) { e.textContent = ""; return; }
    const s = Math.round((Date.now() - salvoEm) / 1000);
    e.textContent = s < 5 ? "Rascunho salvo agora" : s < 60 ? `Rascunho salvo há ${s} s` : `Rascunho salvo há ${Math.floor(s / 60)} min`;
  }
  setInterval(rotuloRasc, 5000);

  function salvarRascunho() {
    const ta = $("mm-resposta");
    if (!msg || !ta) return;
    try {
      if (ta.value.trim()) { localStorage.setItem(KR + msg.id, JSON.stringify({ t: ta.value, at: Date.now() })); salvoEm = Date.now(); }
      else { localStorage.removeItem(KR + msg.id); salvoEm = null; }
    } catch (e) {}
    rotuloRasc();
  }

  window.mmModelo = (tipo, i) => {
    const ta = $("mm-resposta");
    if (!ta || !msg) return;
    const modelo = tipo === "p" ? PADRAO[i] : lerModelos()[i];
    if (!modelo) return;
    const atual = ta.value.trim();
    if (atual && atual !== ultimoTexto && !confirm("Substituir o texto que você já escreveu por este modelo?")) return;
    const texto = preencher(modelo.c, msg);
    ta.value = texto;
    ultimoTexto = texto;
    ultimoModelo = tipo + i;
    ta.focus();
    salvarRascunho();
    desenharChips();
  };

  window.mmSalvarModelo = () => {
    const ta = $("mm-resposta");
    const texto = ta ? ta.value.trim() : "";
    if (!texto) { toast("Escreva o texto antes de salvar como modelo", "err"); return; }
    const l = lerModelos();
    if (l.length >= 12) { toast("Limite de 12 modelos. Remova algum primeiro.", "err"); return; }
    const nome = (prompt("Nome do modelo:") || "").trim().slice(0, 30);
    if (!nome) return;
    let c = texto;
    if (msg && msg.email) c = c.split(msg.email).join("{email}");
    const p = primeiro(msg && msg.nome);
    if (p.length >= 3) c = c.replace(new RegExp("(?<![\\p{L}\\p{N}])" + escRe(p) + "(?![\\p{L}\\p{N}])", "gu"), "{nome}");
    l.push({ t: nome, c });
    gravarModelos(l);
    desenharChips();
    toast("Modelo salvo", "ok");
  };

  window.mmRemover = (i) => {
    const l = lerModelos();
    if (!l[i] || !confirm(`Remover o modelo "${l[i].t}"?`)) return;
    l.splice(i, 1);
    gravarModelos(l);
    ultimoModelo = null;
    desenharChips();
  };

  window.mmContinuar = () => {
    const d = $("mm-desc"), ta = $("mm-resposta");
    if (d) d.style.display = "none";
    if (ta) ta.focus();
  };
  window.mmDescartar = () => cm("mensagem");

  function prepararResposta(m) {
    msg = m; ultimoModelo = null; ultimoTexto = ""; salvoEm = null;
    clearTimeout(tAuto);
    const ta = $("mm-resposta");
    if (!ta) return; // mensagem já respondida: não há campo de resposta
    ta.insertAdjacentHTML("beforebegin", '<div class="mmsg-reply-lbl">Respostas prontas</div><div class="tk-filters" id="mm-modelos"></div>');
    ta.insertAdjacentHTML("afterend", `
      <div class="mm-rasc" id="mm-rasc"></div>
      <div class="mm-desc" id="mm-desc" style="display:none">
        <span>Descartar a resposta? O texto digitado será perdido.</span>
        <div class="acts">
          <button type="button" class="act act-edit" onclick="mmContinuar()">Continuar editando</button>
          <button type="button" class="act act-del" onclick="mmDescartar()">Descartar</button>
        </div>
      </div>`);
    try {
      const r = JSON.parse(localStorage.getItem(KR + m.id) || "null");
      if (r && r.t) { ta.value = r.t; salvoEm = r.at; }
    } catch (e) {}
    ta.addEventListener("input", () => {
      const d = $("mm-desc");
      if (d) d.style.display = "none";
      clearTimeout(tAuto);
      tAuto = setTimeout(salvarRascunho, 600);
    });
    desenharChips();
    rotuloRasc();
  }

  const baseOpen = openMsg;
  openMsg = function (m) { baseOpen(m); prepararResposta(m); };

  // Cancelar, X e o fechamento após enviar passam por aqui: o rascunho some junto
  const baseCm = cm;
  cm = function (id) {
    if (id === "mensagem" && msg) limparRascunho(msg.id);
    baseCm(id);
  };

  // Clique fora e Esc: só fecha direto se não houver texto; com texto, mostra o aviso vermelho
  const aberto = () => $("mw-mensagem") && $("mw-mensagem").classList.contains("on");
  const temTexto = () => !!(($("mm-resposta") && $("mm-resposta").value) || "").trim();
  function tentarFechar() {
    const d = $("mm-desc");
    if (d && temTexto()) { d.style.display = "flex"; d.scrollIntoView({ block: "nearest" }); }
    else cm("mensagem");
  }
  document.addEventListener("click", (e) => {
    if (aberto() && e.target === $("mw-mensagem")) { e.stopPropagation(); tentarFechar(); }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !aberto()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const d = $("mm-desc");
    if (d && d.style.display !== "none") mmContinuar();
    else tentarFechar();
  }, true);
})();

// =====================================================
// INICIALIZAÇÃO — roda por último, quando tudo já está definido
// =====================================================
if (token) {
  try {
    const p = JSON.parse(atob(token.split(".")[1]));
    if (p.exp && p.exp * 1000 < Date.now()) {
      localStorage.removeItem("admin_token");
      token = null;
    } else if (["admin", "master"].includes(p.role)) showPanel(p);
    else token = null;
  } catch (e) {
    token = null;
  }
}

// =====================================================
// EVENTOS COM PAINEL LATERAL — lista enxuta à esquerda, detalhes e decisão à direita.
// COLE ESTE BLOCO INTEIRO NO admin.js, logo ANTES da seção "INICIALIZAÇÃO"
// (depois do bloco "admin-novidades"). Se você já colou a versão anterior deste bloco,
// apague ela e cole esta no lugar.
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const st = (x) => x.status_aprovacao || "aprovado";
  const FIL = {
    todos: () => true,
    pendentes: (x) => st(x) === "pendente",
    aprovados: (x) => st(x) === "aprovado",
    recusados: (x) => st(x) === "bloqueado",
  };
  const ROT = { todos: "Todos", pendentes: "Pendentes", aprovados: "Aprovados", recusados: "Recusados" };

  let lista = [], filtro = "todos", selId = null, det = {}, falhou = {};

  const tbar = document.querySelector("#pg-eventos .tbar");
  if (tbar && !$("ev-chips")) tbar.insertAdjacentHTML("afterbegin", '<div class="tk-filters" id="ev-chips" style="margin:0"></div>');

  const visiveis = () => lista.filter(FIL[filtro]);
  const achar = (id) => lista.find((x) => String(x.id) === String(id));
  const pillAp = (ap) =>
    ap === "pendente" ? '<span class="pill p-yw">pendente</span>'
    : ap === "bloqueado" ? '<span class="pill p-rd">recusado</span>'
    : '<span class="pill p-gn">aprovado</span>';
  const juntar = (...p) => p.filter((x) => x != null && String(x).trim() !== "").join(", ");
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const kv = (rot, html) => `<div class="ev-kv"><span>${rot}</span><div>${html}</div></div>`;

  function tile(d) {
    const t = d ? new Date(d) : null;
    if (!t || isNaN(t)) return '<div class="ev-dia"><b>--</b><span>sem data</span></div>';
    return `<div class="ev-dia"><b>${String(t.getDate()).padStart(2, "0")}</b><span>${esc(t.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}</span></div>`;
  }
  const hora = (d) => {
    const t = d ? new Date(d) : null;
    return t && !isNaN(t) ? t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  };

  function srcImg(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    return `${API}/uploads/${encodeURI(s.replace(/^\/?(uploads\/)?/, ""))}`;
  }

  function avisos(e, d) {
    const a = [];
    if (!e.descricao || !String(e.descricao).trim()) a.push("Sem descrição");
    if (!e.imagem) a.push("Sem imagem");
    const fim = e.data_fim || e.data_inicio;
    if (fim && new Date(fim) < new Date()) a.push("A data do evento já passou");
    if (d) {
      if (d.duplicados > 0) a.push("Existe outro cadastro com o mesmo nome");
      if (!(d.ingressos || []).length) a.push("Nenhum ingresso cadastrado");
    }
    return a;
  }

  /* ── lista ── */
  function rEv() {
    $("c-ev").textContent = lista.length + " registros";
    $("nb-ev").textContent = lista.length;
    if ($("ev-chips"))
      $("ev-chips").innerHTML = Object.keys(FIL)
        .map((k) => `<button class="tk-chip ${filtro === k ? "on" : ""}" onclick="evFiltro('${k}')">${ROT[k]} <i>${lista.filter(FIL[k]).length}</i></button>`).join("");

    const v = visiveis();
    const linhas = v.length
      ? v.map((e) => {
          const ini = e.data_inicio || e.data;
          const sub = [hora(ini), e.local_nome].filter(Boolean).join(" · ");
          return `<tr class="ev-row ${String(e.id) === String(selId) ? "ev-sel" : ""}" data-id="${num(e.id)}" onclick="evSel(${num(e.id)})"><td>
          <div class="ev-cell">
            ${tile(ini)}
            <div class="ev-nm"><b>${esc(e.nome || "—")}</b><span>${esc(sub || "—")}</span></div>
            ${pillAp(st(e))}
          </div></td></tr>`;
        }).join("")
      : '<tr><td><div class="empty">Nenhum evento nesta lista.</div></td></tr>';

    $("tb-ev").innerHTML = `<div class="ev-split">
      <div class="ev-list"><table><tbody>${linhas}</tbody></table></div>
      <aside class="ev-panel" id="ev-panel"></aside>
    </div>`;
    if (typeof filter === "function") filter("ev");
    pintar();
  }

  /* ── painel ── */
  function pintar() {
    const box = $("ev-panel");
    if (!box) return;
    const e = achar(selId);
    if (!e) { box.innerHTML = '<div class="empty">Selecione um evento para ver os detalhes.</div>'; return; }

    const d = det[e.id] || null;
    const ap = st(e);
    const prod = d && d.produtor;
    const por = d ? (prod ? [prod.nome_completo, prod.email ? "(" + prod.email + ")" : ""].filter(Boolean).join(" ") : "Não identificado") : falhou[e.id] ? "—" : "carregando…";
    const ing = d ? d.ingressos || [] : null;
    const ingTxt = ing
      ? ing.length
        ? ing.map((t) => `${esc(t.titulo)} · ${t.tipo === "gratuito" ? "Grátis" : "R$ " + Number(t.valor || 0).toFixed(2)} · ${esc(t.quantidade_total ?? "—")} un.`).join("<br>")
        : "Nenhum ingresso cadastrado"
      : falhou[e.id] ? "—" : "carregando…";
    const ini = e.data_inicio || e.data, fim = e.data_fim;
    const av = avisos(e, d);
    const img = srcImg(e.imagem);
    const id = num(e.id);

    let acoes = "";
    if (ap === "pendente")
      acoes = `<button class="btn-cancel ev-no" onclick="evDecidir('bloqueado')">Recusar</button><button class="btn-save" onclick="evDecidir('aprovado')">Aprovar</button>`;
    else if (ap === "aprovado")
      acoes = `<button class="btn-cancel ev-no" onclick="evDecidir('bloqueado')">Bloquear</button>`;
    else acoes = `<button class="btn-save" onclick="evDecidir('aprovado')">Aprovar</button>`;

    box.innerHTML = `
      <div class="ev-ph"><div><b class="ev-t">${esc(e.nome || "—")}</b><div class="ev-sub">${dado(e.assunto || e.categoria)}</div></div>${pillAp(ap)}</div>
      ${img ? `<img class="ev-img" src="${esc(img)}" alt="" onerror="this.style.display='none'">` : ""}
      ${ap === "pendente" && av.length ? `<div class="ev-av">${av.map((x) => `<span class="pill p-yw">${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="ev-kvs">
        ${kv("Local", dado(e.local_nome))}
        ${kv("Endereço", dado(juntar(e.rua, e.cidade, e.estado, e.cep)))}
        ${kv("Quando", (ini ? esc(fmtDH(ini)) : "—") + (fim && fim !== ini ? "<br>até " + esc(fmtDH(fim)) : ""))}
        ${kv("Produtor", dado(e.nome_produtor))}
        ${kv("Cadastrado por", esc(por))}
        ${kv("Categoria", dado(e.categoria))}
        ${kv("Ingressos", ingTxt)}
      </div>
      <div class="ev-lbl">Descrição</div>
      <div class="ev-desc">${e.descricao && String(e.descricao).trim() ? esc(e.descricao) : "Sem descrição"}</div>
      <div class="ev-acts">${acoes}</div>
      <div class="ev-mais"><button type="button" onclick="openEventoById(${id})">Editar</button><span>·</span><button type="button" onclick="del('eventos',${id},loadEv)">Arquivar</button></div>
      <div class="ev-hint">Atalhos: A aprova, R recusa, setas navegam</div>`;
  }

  async function carregarDetalhe(id) {
    if (det[id] || falhou[id]) return;
    try {
      const r = await fetch(`${API}/admin/eventos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      det[id] = await r.json();
    } catch (e) {
      falhou[id] = true;
    }
    if (String(selId) === String(id)) pintar();
  }

  function selecionar(id) {
    selId = id;
    document.querySelectorAll("#tb-ev .ev-row").forEach((r) => r.classList.toggle("ev-sel", r.dataset.id === String(id)));
    pintar();
    carregarDetalhe(id);
    const r = document.querySelector("#tb-ev .ev-row.ev-sel");
    if (r) r.scrollIntoView({ block: "nearest" });
  }

  window.evSel = (id) => selecionar(id);
  window.evFiltro = (k) => {
    filtro = k;
    const v = visiveis();
    if (!v.some((x) => String(x.id) === String(selId))) selId = v[0] ? v[0].id : null;
    rEv();
    if (selId != null) carregarDetalhe(selId);
  };

  // Decide o item aberto e, se houver outro pendente, já abre o próximo
  window.evDecidir = (status) => {
    if (selId == null) return;
    setStatus("eventos", selId, status, async () => {
      await loadEv();
      const prox = visiveis().find((x) => st(x) === "pendente");
      if (prox) selecionar(prox.id);
    });
  };

  loadEv = async function () {
    hideErr("err-ev");
    $("tb-ev").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
      const d = await api("eventos");
      d.sort((a, b) => (st(a) === "pendente" ? 0 : 1) - (st(b) === "pendente" ? 0 : 1));
      lista = d;
      cache.ev = d;
      det = {}; falhou = {};
      if (!achar(selId) || !visiveis().some((x) => String(x.id) === String(selId))) selId = null;
      if (selId == null) { const v = visiveis()[0]; if (v) selId = v.id; }
      rEv();
      if (selId != null) carregarDetalhe(selId);
    } catch (e) {
      showErr("err-ev", "Erro: " + e.message);
      $("tb-ev").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
  };

  // Atalhos na tela de Eventos: setas para navegar, A aprova, R recusa
  document.addEventListener("keydown", (e) => {
    if (cur !== "eventos" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-wrap.on")) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "arrowup") {
      e.preventDefault();
      const v = visiveis();
      if (!v.length) return;
      const i = Math.max(0, v.findIndex((x) => String(x.id) === String(selId)));
      selecionar(v[Math.min(Math.max(i + (k === "arrowdown" ? 1 : -1), 0), v.length - 1)].id);
      return;
    }
    const x = achar(selId);
    if (!x) return;
    const ap = st(x);
    if (k === "a" && ap !== "aprovado") { e.preventDefault(); evDecidir("aprovado"); }
    if (k === "r" && ap !== "bloqueado") { e.preventDefault(); evDecidir("bloqueado"); }
  });
})();

// =====================================================
// PAINEL LATERAL (lista + detalhes) — Locais, Avaliações, Ingressos e Pedidos
// Mesmo modelo da tela de Eventos, montado por uma função só.
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const st = (x) => x.status_aprovacao || "aprovado";
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const kv = (rot, html) => `<div class="ev-kv"><span>${rot}</span><div>${html}</div></div>`;
  const juntar = (...p) => p.filter((x) => x != null && String(x).trim() !== "").join(", ");
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pillAp = (ap) =>
    ap === "pendente" ? '<span class="pill p-yw">pendente</span>'
    : ap === "bloqueado" ? '<span class="pill p-rd">recusado</span>'
    : '<span class="pill p-gn">aprovado</span>';

  function srcImg(v) {
    if (!v) return "";
    const s = String(v).trim();
    if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    return `${API}/uploads/${encodeURI(s.replace(/^\/?(uploads\/)?/, ""))}`;
  }
  const imgTag = (src) => (src ? `<img class="ev-img" src="${esc(src)}" alt="" onerror="this.style.display='none'">` : "");
  const avTag = (a) => (a.length ? `<div class="ev-av">${a.map((x) => `<span class="pill p-yw">${esc(x)}</span>`).join("")}</div>` : "");
  const tileTxt = (b, s) => `<div class="ev-dia"><b>${esc(b)}</b><span>${esc(s)}</span></div>`;
  function tileData(d) {
    const t = d ? new Date(d) : null;
    if (!t || isNaN(t)) return '<div class="ev-dia"><b>--</b><span>sem data</span></div>';
    return `<div class="ev-dia"><b>${String(t.getDate()).padStart(2, "0")}</b><span>${esc(t.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))}</span></div>`;
  }

  /* ── fábrica ── */
  function criar(c) {
    let lista = [], filtro = "todos", selId = null, det = {}, falhou = {};
    const box = $(c.box);
    if (!box) return null;

    // chips de filtro (usa o que já existe na barra ou cria um)
    let chips = $(c.chips);
    if (!chips) {
      const tbar = document.querySelector("#pg-" + c.page + " .tbar");
      const html = `<div class="tk-filters" id="${c.chips}" style="margin:0"></div>`;
      if (tbar) tbar.insertAdjacentHTML("afterbegin", html);
      else box.insertAdjacentHTML("beforebegin", html);
      chips = $(c.chips);
    }
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (b) setFiltro(b.dataset.k);
    });

    // busca: troca o campo por uma cópia para soltar os ouvintes antigos
    let busca = $(c.search);
    if (busca) {
      const n = busca.cloneNode(true);
      busca.replaceWith(n);
      n.removeAttribute("onkeyup");
      n.removeAttribute("oninput");
      n.addEventListener("input", () => { ajustarSel(); render(); if (selId != null) carregarDetalhe(selId); });
      busca = n;
    }
    const termo = () => (busca ? busca.value.toLowerCase().trim() : "");

    const achar = (id) => lista.find((x) => String(x.id) === String(id));
    const visiveis = () => {
      const q = termo();
      return lista.filter(c.filtros[filtro][1]).filter((x) => !q || String(c.texto(x)).toLowerCase().includes(q));
    };
    function ajustarSel() {
      const v = visiveis();
      if (!v.some((x) => String(x.id) === String(selId))) selId = v[0] ? v[0].id : null;
    }

    function render() {
      if ($(c.count)) $(c.count).textContent = lista.length + " registros";
      if (c.nb && $(c.nb)) $(c.nb).textContent = lista.length;
      chips.innerHTML = Object.keys(c.filtros)
        .map((k) => `<button type="button" class="tk-chip ${filtro === k ? "on" : ""}" data-k="${k}">${esc(c.filtros[k][0])} <i>${lista.filter(c.filtros[k][1]).length}</i></button>`).join("");

      const v = visiveis();
      if ($(c.fc)) $(c.fc).textContent = termo() || filtro !== "todos" ? v.length + " resultado" + (v.length !== 1 ? "s" : "") : "";

      const linhas = v.length
        ? v.map((x) => `<tr class="ev-row ${String(x.id) === String(selId) ? "ev-sel" : ""}" data-id="${num(x.id)}"><td>
            <div class="ev-cell">${c.tile(x)}
              <div class="ev-nm"><b>${esc(c.titulo(x))}</b><span>${esc(c.sub(x) || "—")}</span></div>
              ${c.pill(x)}
            </div></td></tr>`).join("")
        : `<tr><td><div class="empty">${esc(c.vazio)}</div></td></tr>`;

      box.innerHTML = `<div class="ev-split">
        <div class="ev-list"><table><tbody>${linhas}</tbody></table></div>
        <aside class="ev-panel" id="${c.box}-panel"></aside>
      </div>`;
      pintar();
    }

    function pintar() {
      const p = $(c.box + "-panel");
      if (!p) return;
      const x = achar(selId);
      if (!x) { p.innerHTML = '<div class="empty">Selecione um item para ver os detalhes.</div>'; return; }
      const d = det[x.id] || null, f = !!falhou[x.id];
      const acoes = c.acoes ? c.acoes(x) : "";
      const mais = c.mais ? c.mais(x) : "";
      p.innerHTML = `
        <div class="ev-ph"><div><b class="ev-t">${esc(c.titulo(x))}</b><div class="ev-sub">${c.sub2(x)}</div></div>${c.pill(x)}</div>
        ${c.corpo(x, d, f)}
        ${acoes ? `<div class="ev-acts">${acoes}</div>` : ""}
        ${mais ? `<div class="ev-mais">${mais}</div>` : ""}
        <div class="ev-hint">${c.aprov ? "Atalhos: A aprova, R recusa, setas navegam" : "Atalho: setas navegam"}</div>`;
    }

    async function carregarDetalhe(id) {
      if (!c.detalhe || det[id] || falhou[id]) return;
      try {
        const r = await fetch(`${API}/admin/${c.detalhe}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401) { logout(); return; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        det[id] = await r.json();
      } catch (e) { falhou[id] = true; }
      if (String(selId) === String(id)) pintar();
    }

    function selecionar(id) {
      selId = id;
      box.querySelectorAll(".ev-row").forEach((r) => r.classList.toggle("ev-sel", r.dataset.id === String(id)));
      pintar();
      carregarDetalhe(id);
      const r = box.querySelector(".ev-row.ev-sel");
      if (r) r.scrollIntoView({ block: "nearest" });
    }

    function setFiltro(k) {
      if (!c.filtros[k]) return;
      filtro = k;
      ajustarSel();
      render();
      if (selId != null) carregarDetalhe(selId);
    }

    function decidir(status) {
      if (selId == null || !c.aprov) return;
      setStatus(c.aprov, selId, status, async () => {
        await load();
        const prox = visiveis().find((x) => st(x) === "pendente");
        if (prox) selecionar(prox.id);
      });
    }

    // cliques: linha da lista e botões Aprovar/Recusar do painel
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-decidir]");
      if (b) { decidir(b.dataset.decidir); return; }
      const r = e.target.closest(".ev-row");
      if (r) selecionar(r.dataset.id);
    });

    async function load() {
      hideErr(c.err);
      box.innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
      try {
        const d = await api(c.api);
        if (c.ordem) d.sort(c.ordem);
        lista = d;
        if (c.cache) cache[c.cache] = d;
        det = {}; falhou = {};
        ajustarSel();
        render();
        if (selId != null) carregarDetalhe(selId);
      } catch (e) {
        showErr(c.err, "Erro: " + e.message);
        box.innerHTML = '<div class="empty">Falha ao carregar.</div>';
      }
    }

    // atalhos de teclado
    document.addEventListener("keydown", (e) => {
      if (cur !== c.page || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".modal-wrap.on")) return;
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "arrowdown" || k === "arrowup") {
        e.preventDefault();
        const v = visiveis();
        if (!v.length) return;
        const i = Math.max(0, v.findIndex((x) => String(x.id) === String(selId)));
        selecionar(v[Math.min(Math.max(i + (k === "arrowdown" ? 1 : -1), 0), v.length - 1)].id);
        return;
      }
      if (!c.aprov) return;
      const x = achar(selId);
      if (!x) return;
      const ap = st(x);
      if (k === "a" && ap !== "aprovado") { e.preventDefault(); decidir("aprovado"); }
      if (k === "r" && ap !== "bloqueado") { e.preventDefault(); decidir("bloqueado"); }
    });

    return { load, setFiltro };
  }

  const btnNo = (t) => `<button class="btn-cancel ev-no" data-decidir="bloqueado">${t}</button>`;
  const btnOk = '<button class="btn-save" data-decidir="aprovado">Aprovar</button>';
  const acoesAprov = (x) => {
    const ap = st(x);
    return ap === "pendente" ? btnNo("Recusar") + btnOk : ap === "aprovado" ? btnNo("Bloquear") : btnOk;
  };

  /* ══════════ LOCAIS ══════════ */
  function avisosLocal(x, d) {
    const o = d || x, a = [];
    if (!o.descricao || !String(o.descricao).trim()) a.push("Sem descrição");
    if (d) {
      if (d.duplicados > 0) a.push("Existe outro cadastro com o mesmo nome");
      if (!d.img_capa && !d.img_logo) a.push("Sem imagem");
      if (!d.telefone) a.push("Sem telefone");
      if (!d.endereco && !d.rua) a.push("Sem endereço");
    }
    return a;
  }
  const L = criar({
    page: "estabelecimentos", box: "tb-e", api: "estabelecimentos", cache: "e", err: "err-e",
    count: "c-e", nb: "nb-e", fc: "fc-e", chips: "e-chips", search: "s-e",
    aprov: "estabelecimentos", detalhe: "estabelecimentos",
    vazio: "Nenhum local nesta lista.",
    filtros: {
      todos: ["Todos", () => true],
      pendentes: ["Pendentes", (x) => st(x) === "pendente"],
      aprovados: ["Aprovados", (x) => st(x) === "aprovado"],
      recusados: ["Recusados", (x) => st(x) === "bloqueado"],
    },
    ordem: (a, b) => (st(a) === "pendente" ? 0 : 1) - (st(b) === "pendente" ? 0 : 1),
    texto: (x) => [x.id, x.nome, x.tipo, x.cidade].join(" "),
    tile: (x) => tileTxt(x.nota ?? "0.0", "★"),
    titulo: (x) => x.nome || "—",
    sub: (x) => [x.tipo, x.cidade].filter(Boolean).join(" · "),
    sub2: (x) => dado(x.tipo),
    pill: (x) => pillAp(st(x)),
    corpo: (x, d, f) => {
      const o = d || x, prod = d && d.produtor;
      const por = d ? (prod ? [prod.nome_completo, prod.email ? "(" + prod.email + ")" : ""].filter(Boolean).join(" ") : "Não identificado") : f ? "—" : "carregando…";
      const av = st(x) === "pendente" ? avisosLocal(x, d) : [];
      return `${imgTag(srcImg(o.img_capa || o.img_logo))}${avTag(av)}
        <div class="ev-kvs">
          ${kv("Tipo", dado(o.tipo))}
          ${kv("Especialidade", dado(o.especialidade))}
          ${kv("Endereço", dado(o.endereco || juntar(o.rua, o.numero, o.bairro, o.cidade, o.estado, o.cep)))}
          ${kv("Telefone", dado(o.telefone))}
          ${kv("Horário", dado(o.horario))}
          ${kv("Faixa de preço", dado(o.faixa_preco))}
          ${kv("Capacidade", dado(o.capacidade))}
          ${kv("Site", dado(o.site))}
          ${kv("CNPJ", dado(o.cnpj))}
          ${kv("Cadastrado por", esc(por))}
          ${kv("Nota", "★ " + esc(x.nota ?? "0.0") + " · " + esc(x.avaliacoes ?? 0) + " avaliações")}
        </div>
        <div class="ev-lbl">Descrição</div>
        <div class="ev-desc">${o.descricao && String(o.descricao).trim() ? esc(o.descricao) : "Sem descrição"}</div>`;
    },
    acoes: acoesAprov,
    mais: (x) => `<button type="button" onclick="openEstabById(${num(x.id)})">Editar</button><span>·</span><button type="button" onclick="del('estabelecimentos',${num(x.id)},loadE)">Arquivar</button>`,
  });
  if (L) loadE = L.load;

  /* ══════════ AVALIAÇÕES ══════════ */
  const nota = (a) => Number(a.nota) || 0;
  const AV = criar({
    page: "avaliacoes", box: "tb-av", api: "avaliacoes", err: "err-av",
    count: "c-av", nb: "nb-av", fc: "fc-av", chips: "av-chips", search: "s-av",
    vazio: "Nenhuma avaliação nesta lista.",
    filtros: {
      todos: ["Todas", () => true],
      boas: ["Boas (4–5)", (a) => nota(a) >= 4],
      medias: ["Médias (3)", (a) => nota(a) === 3],
      ruins: ["Ruins (1–2)", (a) => nota(a) > 0 && nota(a) <= 2],
    },
    texto: (a) => [a.id, a.estabelecimento_nome, a.nome_autor, a.usuario_nome, a.comentario].join(" "),
    tile: (a) => tileTxt(a.nota ?? "—", "★"),
    titulo: (a) => a.estabelecimento_nome || "Estabelecimento #" + (a.estabelecimento_id || "—"),
    sub: (a) => (a.nome_autor || a.usuario_nome || "Usuário #" + (a.usuario_id || "—")) + (a.comentario ? " · " + a.comentario : ""),
    sub2: (a) => "Avaliação #" + num(a.id),
    pill: (a) => `<span class="pill p-yw">★ ${esc(a.nota ?? "—")}</span>`,
    corpo: (a) => `<div class="ev-kvs">
        ${kv("Local", dado(a.estabelecimento_nome || "#" + (a.estabelecimento_id || "—")))}
        ${kv("Autor", dado(a.nome_autor || a.usuario_nome || "#" + (a.usuario_id || "—")))}
        ${kv("Nota", "★ " + esc(a.nota ?? "—"))}
        ${a.criado_em ? kv("Data", esc(fmtDH(a.criado_em))) : ""}
      </div>
      <div class="ev-lbl">Comentário</div>
      <div class="ev-desc">${a.comentario && String(a.comentario).trim() ? esc(a.comentario) : "Sem comentário"}</div>`,
    acoes: (a) => `<button class="btn-cancel ev-no" onclick="del('avaliacoes',${num(a.id)},loadAv)">Arquivar</button>`,
  });
  if (AV) loadAv = AV.load;

  /* ══════════ INGRESSOS ══════════ */
  const IG = criar({
    page: "ingressos", box: "tb-i", api: "ingressos", cache: "i", err: "err-i",
    count: "c-i", nb: "nb-i", fc: "fc-i", chips: "i-chips", search: "s-i",
    detalhe: null,
    vazio: "Nenhum ingresso nesta lista.",
    filtros: {
      todos: ["Todos", () => true],
      gratuitos: ["Gratuitos", (i) => i.tipo === "gratuito"],
      pagos: ["Pagos", (i) => i.tipo !== "gratuito"],
    },
    texto: (i) => [i.id, i.titulo, i.evento_nome, i.tipo].join(" "),
    tile: (i) => tileTxt(i.quantidade_total ?? "—", "un."),
    titulo: (i) => i.titulo || "—",
    sub: (i) => (i.evento_nome || "Evento #" + (i.evento_id || "—")) + " · " + (i.tipo === "gratuito" ? "Grátis" : fmtBRL(i.valor)),
    sub2: (i) => dado(i.evento_nome || "#" + (i.evento_id || "—")),
    pill: (i) => `<span class="pill ${i.tipo === "gratuito" ? "p-gn" : "p-yw"}">${esc(i.tipo || "—")}</span>`,
    corpo: (i) => `<div class="ev-kvs">
        ${kv("Evento", dado(i.evento_nome || "#" + (i.evento_id || "—")))}
        ${kv("Tipo", dado(i.tipo))}
        ${kv("Valor", i.tipo === "gratuito" ? "Grátis" : esc(fmtBRL(i.valor)))}
        ${kv("Quantidade", dado(i.quantidade_total))}
      </div>`,
    acoes: (i) => `<button class="btn-save" onclick="openIngressoById(${num(i.id)})">Editar</button>`,
    mais: (i) => `<button type="button" onclick="del('ingressos',${num(i.id)},loadI)">Arquivar</button>`,
  });
  if (IG) loadI = IG.load;

  /* ══════════ PEDIDOS ══════════ */
  const ST = {
    aprovado: ["Pago", "p-gn"], pendente: ["Pendente", "p-yw"], cortesia: ["Cortesia", "p-bl"],
    cancelado: ["Cancelado", "p-rd"], reembolsado: ["Reembolsado", "p-cy"],
  };
  const FORMA = { credito: "Crédito", debito: "Débito", boleto: "Boleto", pix: "Pix", cortesia: "Cortesia", gratuito: "Gratuito" };
  const stTxt = (s) => (ST[s] ? ST[s][0] : s || "—");
  const stPill = (s) => { const [t, k] = ST[s] || [s || "—", "p-dim"]; return `<span class="pill ${k}">${esc(t)}</span>`; };
  const bPed = (cls, t, id, s) => `<button class="${cls}" onclick="pedAcao(${num(id)},'${s}')">${t}</button>`;

  const filtrosPed = { todos: ["Todos", () => true] };
  ["pendente", "aprovado", "cortesia", "cancelado", "reembolsado"].forEach((k) => { filtrosPed[k] = [stTxt(k), (p) => p.status === k]; });

  const PD = criar({
    page: "pedidos", box: "tb-pedidos", api: "pedidos", err: "err-ped",
    count: "c-ped", fc: "ped-n", chips: "ped-chips", search: "s-ped",
    detalhe: "pedidos",
    vazio: "Nenhum pedido encontrado.",
    filtros: filtrosPed,
    texto: (p) => [p.id, p.nome_completo, p.email, p.evento_nome].join(" "),
    tile: (p) => tileData(p.criado_em),
    titulo: (p) => p.nome_completo || "Usuário #" + (p.usuario_id || "—"),
    sub: (p) => (p.evento_nome || "Evento #" + (p.evento_id || "—")) + " · " + fmtBRL(p.valor_total),
    sub2: (p) => "Pedido #" + num(p.id),
    pill: (p) => stPill(p.status),
    corpo: (p, d, f) => {
      const itens = d ? d.itens || [] : null;
      const itensTxt = itens
        ? itens.length
          ? itens.map((t) => `${esc(t.titulo || "Ingresso")} · ${esc(t.quantidade)} un. · ${fmtBRL(t.valor_total)} · ${esc(stTxt(t.status))}${t.assento_id ? " · assento numerado" : ""}`).join("<br>")
          : "Nenhum item registrado"
        : f ? "—" : "carregando…";
      const at = d && d.atualizado_em;
      return `<div class="ev-kvs">
          ${kv("Comprador", dado(p.nome_completo))}
          ${kv("E-mail", dado(p.email))}
          ${kv("Evento", dado(p.evento_nome || "#" + (p.evento_id || "—")))}
          ${kv("Quantidade", dado(p.quantidade))}
          ${kv("Valor total", esc(fmtBRL(p.valor_total)))}
          ${kv("Pagamento", dado(FORMA[p.forma_pagamento] || p.forma_pagamento))}
          ${kv("Criado em", p.criado_em ? esc(fmtDH(p.criado_em)) : "—")}
          ${at ? kv("Atualizado em", esc(fmtDH(at))) : ""}
        </div>
        <div class="ev-lbl">Itens do pedido</div>
        <div class="ev-desc">${itensTxt}</div>`;
    },
        acoes: (p) => {
      const re = `<button class="btn-cancel" onclick="pedReenviar(${num(p.id)})">Reenviar ingresso</button>`;
      return p.status === "pendente" ? bPed("btn-cancel ev-no", "Cancelar pedido", p.id, "cancelado") + bPed("btn-save", "Confirmar pagamento", p.id, "aprovado")
        : p.status === "aprovado" ? re + bPed("btn-cancel ev-no", "Cancelar pedido", p.id, "cancelado") + bPed("btn-cancel ev-no", "Registrar reembolso", p.id, "reembolsado")
        : p.status === "cortesia" ? re + bPed("btn-cancel ev-no", "Cancelar pedido", p.id, "cancelado")
        : "";
    },
  });
  if (PD) {
    loadPedidos = PD.load;
    window.pedFiltro = (k) => PD.setFiltro(k); // usado pelos cards da Visão geral
  }
})();

// =====================================================
// MINHAS TAREFAS — mesmo estilo da Fila de aprovação
//
// SUBSTITUI o bloco "MINHAS TAREFAS — lista enxuta + painel lateral" (o último do arquivo).
// APAGUE aquele bloco inteiro e cole este no lugar, ANTES da seção "INICIALIZAÇÃO".
//
// Usa as mesmas classes de estilo da Fila (fq-novos, fq-att, fq-auto, fq-foco, fq-k, fq-prox),
// então o visual é idêntico e não precisa mexer no CSS.
// Depende do bloco da Fila ("FILA: foco no item, atalhos...") que já está no seu arquivo:
// é ele que abre os detalhes do próximo cadastro depois de uma decisão.
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const box = $("tk-all");
  if (!box) return;

  // Sem painel lateral: a lista volta a usar as linhas da Fila (a função linha() da central de trabalho)
  window.tkPainel = null;

  const KEY_AUTO = "admin_fila_auto"; // mesma opção da Fila
  const autoLigado = () => { try { return localStorage.getItem(KEY_AUTO) !== "0"; } catch (e) { return true; } };
  let conhecidos = null;   // tarefas pendentes que a tela já conhece, ex.: "cad:eventos:12", "msg:7"
  let ultima = Date.now(); // última vez que a lista foi recarregada
  let foco = null;         // tarefa em foco
  let pend = null;         // decisão em andamento: { key, idx }

  box.insertAdjacentHTML("beforebegin", `
    <div class="fq-novos" id="tk-novos" style="display:none">
      <span id="tk-novos-t"></span>
      <button type="button" class="act act-edit" onclick="tkVerAgora()">Ver agora</button>
    </div>
    <div class="fq-att" id="tk-att"></div>`);
  box.insertAdjacentHTML("afterend", `
    <label class="fq-auto">
      <span class="tg"><input type="checkbox" id="tk-auto"><i></i></span>
      <span>Depois de decidir, abrir o próximo item automaticamente <em id="tk-pos"></em></span>
    </label>`);
  $("tk-auto").checked = autoLigado();
  $("tk-auto").addEventListener("change", (e) => {
    try { localStorage.setItem(KEY_AUTO, e.target.checked ? "1" : "0"); } catch (x) {}
    const f = $("fq-auto"); // mantém a opção da Fila igual
    if (f && f.checked !== e.target.checked) { f.checked = e.target.checked; f.dispatchEvent(new Event("change")); }
  });

  /* ── identifica cada linha pelos botões dela ── */
  const linhas = () => [...box.querySelectorAll(".tk-row")];
  function chave(r) {
    for (const b of r.querySelectorAll("button[onclick]")) {
      const o = b.getAttribute("onclick") || "";
      let m = /^verCadastro\('(\w+)',(\d+)\)/.exec(o);
      if (m) return `cad:${m[1]}:${m[2]}`;
      m = /^tkMsg\((\d+)\)/.exec(o);
      if (m) return `msg:${m[1]}`;
      if (/^goTo\('usuarios'\)/.test(o)) return "usr";
    }
    return null;
  }
  const chaves = () => linhas().map(chave).filter(Boolean);
  const rowFoco = () => linhas().find((r) => chave(r) === foco);

  // Botões de cada linha (para as teclas e para as dicas D / R / A / S)
  const bDetalhes = (r) => r.querySelector('.acts button[onclick^="verCadastro("]');
  const bRecusar = (r) => r.querySelector(".acts .act-del");
  const bAprovar = (r) => r.querySelector(".acts .act-up");
  const bResponder = (r) => r.querySelector(".acts .act-reply");
  const bAbrir = (r) => r.querySelector('.acts button[onclick^="goTo("]');
  const bAssumir = (r) => [...r.querySelectorAll(".tk-own button")].find((b) => /'assumir'/.test(b.getAttribute("onclick") || ""));

  function marcar(botao, tecla) {
    if (botao && !botao.querySelector(".fq-k")) botao.insertAdjacentHTML("beforeend", ` <kbd class="fq-k">${tecla}</kbd>`);
  }

  function aplicar() {
    linhas().forEach((r) => r.classList.toggle("fq-foco", chave(r) === foco));
    const k = chaves(), i = k.indexOf(foco);
    $("tk-pos").textContent = k.length && i >= 0 ? `(${i + 1} de ${k.length})` : "";
  }

  // Roda cada vez que a lista é redesenhada
  function enhance() {
    const rows = linhas();
    const keys = rows.map(chave);
    if (pend) {
      const p = pend; pend = null;
      if (!keys.includes(p.key) && keys.length) {
        // Se a opção estiver ligada, o foco vai para o próximo CADASTRO (é ele que a Fila abre);
        // caso contrário, para a linha que ocupou o lugar da tarefa concluída
        const prox = p.key.startsWith("cad:") && autoLigado() ? keys.slice(p.idx).find((k) => k && k.startsWith("cad:")) : null;
        foco = prox || keys[Math.min(p.idx, keys.length - 1)];
      }
    }
    if (!keys.includes(foco)) foco = keys.find(Boolean) || null;
    rows.forEach((r) => {
      const acts = r.querySelector(".acts");
      if (!acts) return;
      marcar(bDetalhes(r), "D");
      marcar(bRecusar(r), "R");
      marcar(bResponder(r), "R");
      marcar(bAprovar(r), "A");
      marcar(bAssumir(r), "S");
      if (!acts.querySelector(".fq-prox"))
        acts.insertAdjacentHTML("beforeend", '<button type="button" class="fq-prox" onclick="tkProximo()">Próximo <span>&rarr;</span></button>');
    });
    $("tk-auto").checked = autoLigado();
    aplicar();
  }
  new MutationObserver(enhance).observe(box, { childList: true });

  function mover(d) {
    const k = chaves();
    if (!k.length) return;
    const i = Math.max(0, k.indexOf(foco));
    foco = k[(i + d + k.length) % k.length];
    aplicar();
    const r = rowFoco();
    if (r) r.scrollIntoView({ block: "nearest" });
  }
  window.tkProximo = () => mover(1);
  window.tkVerAgora = () => loadDash();

  // Clicar numa linha (fora dos botões) coloca o foco nela
  box.addEventListener("click", (e) => {
    if (e.target.closest("button, a")) return;
    const r = e.target.closest(".tk-row");
    if (r && chave(r)) { foco = chave(r); aplicar(); }
  });

  // Guarda qual tarefa está sendo concluída, para levar o foco ao próximo item
  document.addEventListener("click", (e) => {
    if (cur !== "tarefas") return;
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    let key = null;
    const m = /^(?:tkAprovar|cdAcao)\('(\w+)',(\d+)/.exec(b.getAttribute("onclick") || "");
    if (m) key = `cad:${m[1]}:${m[2]}`;
    else if (b.id === "mm-send-btn" && $("mm-id")) key = `msg:${$("mm-id").value}`; // enviar resposta
    if (!key) return;
    const idx = chaves().indexOf(key);
    if (idx >= 0) pend = { key, idx };
  }, true);

  // Atalhos: setas ou J/K navegam, D detalhes, A aprova, R recusa (cadastro) ou responde (mensagem),
  // S assume a tarefa, Enter faz a ação principal da linha
  document.addEventListener("keydown", (e) => {
    if (cur !== "tarefas" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-wrap.on")) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j") { e.preventDefault(); mover(1); return; }
    if (k === "arrowup" || k === "k") { e.preventDefault(); mover(-1); return; }
    if (k === "enter" && e.target.closest && e.target.closest("button, a")) return; // deixa o botão focado agir
    const r = rowFoco();
    if (!r) return;
    const alvo = k === "d" ? bDetalhes(r)
      : k === "a" ? bAprovar(r)
      : k === "r" ? bRecusar(r) || bResponder(r)
      : k === "s" ? bAssumir(r)
      : k === "enter" ? bDetalhes(r) || bResponder(r) || bAbrir(r)
      : null;
    if (alvo) { e.preventDefault(); alvo.click(); }
  });

  /* ── "Atualizado há X" e aviso de itens novos ── */
  function rotulo() {
    const s = Math.max(0, Math.round((Date.now() - ultima) / 1000));
    $("tk-att").textContent = s < 5 ? "Atualizado agora" : s < 60 ? `Atualizado há ${s} s` : `Atualizado há ${Math.floor(s / 60)} min`;
  }
  setInterval(rotulo, 5000);

  async function pendentes() {
    const [ev, es, ms] = await Promise.all([api("eventos").catch(() => null), api("estabelecimentos").catch(() => null), api("mensagens").catch(() => null)]);
    if (!Array.isArray(ev) && !Array.isArray(es) && !Array.isArray(ms)) return null;
    const s = new Set();
    [["eventos", ev], ["estabelecimentos", es]].forEach(([m, l]) => {
      if (Array.isArray(l)) l.forEach((x) => { if ((x.status_aprovacao || "aprovado") === "pendente") s.add(`cad:${m}:${x.id}`); });
    });
    if (Array.isArray(ms)) ms.forEach((m) => { if (m.status !== "respondido") s.add(`msg:${m.id}`); });
    return s;
  }

  // A cada 30 s, só com a tela aberta: avisa se chegou tarefa nova, sem redesenhar a lista sozinho
  async function sondar() {
    if (!token || cur !== "tarefas" || document.hidden) return;
    try {
      const s = await pendentes();
      if (!s) return;
      if (conhecidos === null) { conhecidos = s; return; } // primeira leitura vira a referência
      const n = [...s].filter((k) => !conhecidos.has(k)).length;
      if (n) {
        $("tk-novos-t").textContent = n === 1 ? "1 tarefa nova chegou" : `${n} tarefas novas chegaram`;
        $("tk-novos").style.display = "";
      } else $("tk-novos").style.display = "none";
    } catch (e) {}
  }
  setInterval(sondar, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sondar(); });

  const baseLoad = loadDash;
  loadDash = async function () {
    await baseLoad();
    ultima = Date.now();
    conhecidos = null;
    rotulo();
    $("tk-novos").style.display = "none";
    enhance();
    if (cur === "tarefas") sondar();
  };

  const baseGo = go;
  go = function (p, el_) {
    baseGo(p, el_);
    if (p === "tarefas") { conhecidos = null; rotulo(); enhance(); sondar(); }
  };
})();

// =====================================================
// FICHA DO USUÁRIO — consulta e ações de suporte (botão "Abrir" em Usuários)
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ST = {
    aprovado: ["Pago", "p-gn"], pendente: ["Pendente", "p-yw"], cortesia: ["Cortesia", "p-bl"],
    cancelado: ["Cancelado", "p-rd"], reembolsado: ["Reembolsado", "p-cy"],
  };
  const stPill = (s) => { const [t, c] = ST[s] || [s || "—", "p-dim"]; return `<span class="pill ${c}">${esc(t)}</span>`; };
  const MSG_ST = { novo: ["Nova", "p-bl"], lido: ["Lida", "p-yw"], respondido: ["Respondida", "p-gn"] };
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const campo = (rot, v) => `<div class="mmsg-meta-item"><span>${rot}</span><strong>${dado(v)}</strong></div>`;
  let atual = null;
  let ocupado = false;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .fc-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .fc-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .fc-kpi { background: var(--surface2); border-radius: 12px; padding: 10px 12px; }
    .fc-kpi span { display: block; font-size: 11.5px; color: var(--text-2); }
    .fc-kpi b { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .fc-sec { margin: 4px 0 16px; }
    .fc-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--border); font-size: 12.5px; }
    .fc-row:first-of-type { border-top: 0; }
    .fc-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fc-tl { display: flex; gap: 12px; padding: 5px 0; font-size: 12.5px; }
    .fc-tl > span:first-child { width: 112px; flex-shrink: 0; color: var(--text-3); }
    .fc-vazio { color: var(--text-3); font-size: 12.5px; padding: 6px 0; }
    #cd-ft { flex-wrap: wrap; }
    @media (max-width: 560px) { .fc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `;
  document.head.appendChild(estilo);

  function desenhar(d) {
    const u = d.usuario, r = d.resumo;
    atual = u;
    $("cd-titulo").textContent = u.nome_completo || u.email || "Usuário #" + u.id;
    $("cd-sub").textContent = (u.email || "sem e-mail") + " · #" + u.id;

    const ver = [true, 1, "1", "t", "true"].includes(u.verificado);
    const bloqueado = !!u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date();
    const pills = [
      ver ? ["e-mail verificado", "p-gn"] : ["e-mail não verificado", "p-yw"],
      [String(u.role || "user").toUpperCase(), u.role === "user" || !u.role ? "p-dim" : "p-bl"],
    ];
    if (bloqueado) pills.push(["login bloqueado", "p-rd"]);
    if (u.arquivado_em) pills.push(["arquivado", "p-rd"]);

    const v = (x) => (r ? x : "—");
    let h = `<div class="fc-pills">${pills.map(([t, c]) => `<span class="pill ${c}">${esc(t)}</span>`).join("")}</div>
      <div class="fc-kpis">
        <div class="fc-kpi"><span>Pedidos</span><b>${esc(v(r && r.pedidos))}</b></div>
        <div class="fc-kpi"><span>Ingressos ativos</span><b>${esc(v(r && r.ingressos_ativos))}</b></div>
        <div class="fc-kpi"><span>Reembolsos</span><b>${esc(v(r && r.reembolsos))}</b></div>
        <div class="fc-kpi"><span>Mensagens</span><b>${d.mensagens ? d.mensagens.length : "—"}</b></div>
      </div>
      <div class="mmsg-meta">
        ${campo("Nome", u.nome_completo)}${campo("E-mail", u.email)}
        ${campo("Telefone", u.telefone)}${campo("CPF", u.cpf_mascarado)}
        ${campo("Cidade", [u.cidade, u.estado].filter(Boolean).join(" / "))}${campo("Cliente desde", u.criado_em ? fmtDH(u.criado_em) : "")}
        ${campo("Tentativas de login", u.tentativas_login != null ? u.tentativas_login : 0)}${campo("Login liberado a partir de", bloqueado ? fmtDH(u.bloqueado_ate) : "")}
      </div>`;

    if (d.pedidos) {
      h += `<div class="mmsg-body-lbl">Pedidos recentes${r ? " · pago no total: " + esc(fmtBRL(r.pago)) : ""}</div><div class="fc-sec">` +
        (d.pedidos.length
          ? d.pedidos.map((p) => `<div class="fc-row"><span class="mono">#${num(p.id)}</span><span class="fc-t">${esc(p.evento_nome || "—")}</span><span class="mono">${esc(fmtBRL(p.valor_total))}</span>${stPill(p.status)}<button class="act act-edit" onclick="verPedido(${num(p.id)})">Detalhes</button></div>`).join("")
          : '<div class="fc-vazio">Nenhum pedido.</div>') + "</div>";
    }

    if (d.mensagens) {
      h += `<div class="mmsg-body-lbl">Mensagens enviadas por este e-mail</div><div class="fc-sec">` +
        (d.mensagens.length
          ? d.mensagens.map((m) => { const [t, c] = MSG_ST[m.status] || [m.status || "—", "p-dim"]; return `<div class="fc-row"><span class="fc-t">${esc(m.assunto || "sem assunto")}</span><span class="mono">${esc(TIPO_MAP[m.tipo] || m.tipo || "—")}</span><span class="pill ${c}">${esc(t)}</span></div>`; }).join("")
          : '<div class="fc-vazio">Nenhuma mensagem.</div>') + "</div>";
    }

    h += `<div class="mmsg-body-lbl">Linha do tempo</div><div class="fc-sec">` +
      ((d.linha_tempo || []).length
        ? d.linha_tempo.map((t) => `<div class="fc-tl"><span>${esc(fmtDH(t.em))}</span><span>${esc(t.texto)}</span></div>`).join("")
        : '<div class="fc-vazio">Sem registros.</div>') + "</div>";

    $("cd-corpo").innerHTML = h;

    const podeCodigo = !ver && !u.arquivado_em;
    const podeDesbloquear = (bloqueado || Number(u.tentativas_login) > 0) && !u.arquivado_em;
    $("cd-ft").innerHTML =
      `<button class="btn-cancel" onclick="cm('cadastro')">Fechar</button>` +
      (podeCodigo ? `<button class="act act-edit" onclick="fichaAcao('codigo')">Reenviar código</button>` : "") +
      (podeDesbloquear ? `<button class="act act-edit" onclick="fichaAcao('desbloquear')">Desbloquear login</button>` : "") +
      `<button class="btn-save" onclick="fichaEditar()">Editar dados</button>`;
  }

  window.fichaEditar = () => { if (!atual) return; cm("cadastro"); openUser(atual); };

  // Ações de suporte: reenviar código de verificação e desbloquear login
  window.fichaAcao = async (tipo) => {
    if (!atual || ocupado) return;
    const codigo = tipo === "codigo";
    const pergunta = codigo
      ? `Enviar um novo código de verificação para ${atual.email}?`
      : `Desbloquear o login de ${atual.nome_completo || atual.email}? As tentativas erradas voltam a zero.`;
    if (!confirm(pergunta)) return;
    ocupado = true;
    const id = num(atual.id), email = atual.email;
    try {
      const r = await fetch(`${API}/admin/usuarios/${id}/${codigo ? "reenviar-codigo" : "desbloquear"}`, {
        method: codigo ? "POST" : "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) { toast(d.erro || "Erro ao executar a ação", "err"); return; }
      toast(codigo ? "Código enviado para " + email : "Login desbloqueado", "ok");
      window.fichaAbrir(id);
    } catch (e) {
      toast("Não foi possível conectar ao servidor", "err");
    } finally {
      ocupado = false;
    }
  };

  window.fichaAbrir = async (id) => {
    $("cd-titulo").textContent = "Usuário #" + num(id);
    $("cd-sub").textContent = "Carregando…";
    $("cd-corpo").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    $("cd-ft").innerHTML = "";
    om("cadastro");
    try {
      const r = await fetch(`${API}/admin/usuarios/${num(id)}/ficha`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(d.erro || "HTTP " + r.status);
      desenhar(d);
    } catch (e) {
      $("cd-titulo").textContent = "Usuário";
      $("cd-sub").textContent = "";
      $("cd-corpo").innerHTML = `<div class="empty">Falha ao carregar: ${esc(e.message)}</div>`;
      $("cd-ft").innerHTML = '<button class="btn-cancel" onclick="cm(\'cadastro\')">Fechar</button>';
    }
  };

  window.uOpen = (id) => window.fichaAbrir(id);
})();

// Reenviar ingresso por e-mail (ação de suporte nos pedidos pagos)
(function () {
  let ocupado = false;
  window.pedReenviar = async (id) => {
    if (ocupado) return;
    if (!confirm(`Reenviar o ingresso do pedido #${num(id)} para o e-mail do comprador?`)) return;
    ocupado = true;
    try {
      const r = await fetch(`${API}/admin/pedidos/${num(id)}/reenviar-ingresso`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) { toast(d.erro || "Erro ao reenviar o ingresso", "err"); return; }
      toast("Ingresso reenviado por e-mail", "ok");
    } catch (e) {
      toast("Não foi possível conectar ao servidor", "err");
    } finally {
      ocupado = false;
    }
  };
})();

// =====================================================
// NOVIDADES 2 — COLE ESTE ARQUIVO INTEIRO NO FIM DO admin.js (depois do bloco "Reenviar ingresso").
// Não precisa apagar nada: estes blocos assumem o lugar dos antigos.
//   1) Ficha do usuário (visual novo + Reenviar ingresso + Suspender conta)
//   2) Mensagens como caixa de entrada (lista + painel, em andamento, pedido ligado, nota interna)
//   3) Bloquear evento com vendas (manter pedidos ou cancelar e reembolsar)
// =====================================================

/* ══════════ 1. FICHA DO USUÁRIO ══════════ */
(function () {
  const $ = (id) => document.getElementById(id);
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ST = {
    aprovado: ["Pago", "p-gn"], pendente: ["Pendente", "p-yw"], cortesia: ["Cortesia", "p-bl"],
    cancelado: ["Cancelado", "p-rd"], reembolsado: ["Reembolsado", "p-cy"],
  };
  const stPill = (s) => { const [t, c] = ST[s] || [s || "—", "p-dim"]; return `<span class="pill ${c}">${esc(t)}</span>`; };
  const MSG_ST = { novo: ["Nova", "p-bl"], lido: ["Lida", "p-yw"], respondido: ["Respondida", "p-gn"] };
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const campo = (rot, v) => `<div class="mmsg-meta-item"><span>${rot}</span><strong>${dado(v)}</strong></div>`;
  const suspensa = (u) => !!u.bloqueado_ate && new Date(u.bloqueado_ate).getFullYear() >= 2099;
  let atual = null, ocupado = false;

  function fmtTl(d) {
    const t = new Date(d);
    if (isNaN(t)) return "—";
    const h = new Date();
    const hm = t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (t.toDateString() === h.toDateString()) return "Hoje, " + hm;
    h.setDate(h.getDate() - 1);
    if (t.toDateString() === h.toDateString()) return "Ontem, " + hm;
    return t.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  }

  function desenhar(d) {
    const u = d.usuario, r = d.resumo;
    atual = u;
    const nome = u.nome_completo || u.email || "Usuário #" + u.id;
    $("cd-titulo").textContent = "Ficha do usuário";
    $("cd-sub").textContent = "#" + u.id;

    const ver = [true, 1, "1", "t", "true"].includes(u.verificado);
    const susp = suspensa(u);
    const bloq = !susp && !!u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date();
    const pills = [ver ? ["e-mail verificado", "p-gn"] : ["e-mail não verificado", "p-yw"]];
    if (u.role && u.role !== "user") pills.push([String(u.role).toUpperCase(), "p-bl"]);
    if (susp) pills.push(["conta suspensa", "p-rd"]);
    else if (bloq) pills.push(["login bloqueado", "p-rd"]);
    if (u.arquivado_em) pills.push(["arquivado", "p-rd"]);

    const desde = u.criado_em ? new Date(u.criado_em).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", "/") : "";
    const linha = [u.email || "sem e-mail", [u.cidade, u.estado].filter(Boolean).join(" / "), desde ? "cliente desde " + desde : ""].filter(Boolean).join(" · ");
    const v = (x) => (r ? x : "—");

    const ped = (d.pedidos || []).find((p) => ["aprovado", "cortesia"].includes(p.status));
    const podeCodigo = !ver && !u.arquivado_em;
    const podeDesbloquear = !susp && (bloq || Number(u.tentativas_login) > 0) && !u.arquivado_em;
    const podeSuspender = !susp && !u.arquivado_em && u.role !== "master";
    const btns =
      (ped ? `<button class="act act-edit" onclick="pedReenviar(${num(ped.id)})" title="Pedido #${num(ped.id)}">Reenviar ingresso</button>` : "") +
      (podeCodigo ? `<button class="act act-edit" onclick="fichaAcao('codigo')">Reenviar código de verificação</button>` : "") +
      (podeDesbloquear ? `<button class="act act-edit" onclick="fichaAcao('desbloquear')">Desbloquear login</button>` : "") +
      (susp ? `<button class="act act-edit" onclick="fichaAcao('desbloquear')">Reativar conta</button>` : "") +
      (podeSuspender ? `<button class="act act-del" onclick="fichaSuspender()">Suspender conta</button>` : "");

    let h = `<div class="fc-head">
        <div class="fc-av">${esc(String(nome).split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase())}</div>
        <div class="fc-hi"><b>${esc(nome)}</b><span>${esc(linha)}</span></div>
        <div class="fc-hp">${pills.map(([t, c]) => `<span class="pill ${c}">${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="fc-kpis">
        <div class="fc-kpi"><span>Pedidos</span><b>${esc(v(r && r.pedidos))}</b></div>
        <div class="fc-kpi"><span>Ingressos ativos</span><b>${esc(v(r && r.ingressos_ativos))}</b></div>
        <div class="fc-kpi"><span>Reembolsos</span><b>${esc(v(r && r.reembolsos))}</b></div>
        <div class="fc-kpi"><span>Mensagens</span><b>${d.mensagens ? d.mensagens.length : "—"}</b></div>
      </div>
      ${btns ? `<div class="fc-btns">${btns}</div>` : ""}`;

    if (d.pedidos) {
      h += `<div class="mmsg-body-lbl">Pedidos recentes${r ? " · pago no total: " + esc(fmtBRL(r.pago)) : ""}</div><div class="fc-box">` +
        (d.pedidos.length
          ? d.pedidos.map((p) => `<div class="fc-row"><span class="mono">#${num(p.id)}</span><span class="fc-t">${esc(p.evento_nome || "—")}</span><span class="mono">${esc(fmtBRL(p.valor_total))}</span>${stPill(p.status)}<button class="act act-edit" onclick="verPedido(${num(p.id)})">Detalhes</button></div>`).join("")
          : '<div class="fc-vazio">Nenhum pedido.</div>') + "</div>";
    }

    if (d.mensagens) {
      h += `<div class="mmsg-body-lbl">Mensagens enviadas por este e-mail</div><div class="fc-box">` +
        (d.mensagens.length
          ? d.mensagens.map((m) => { const [t, c] = MSG_ST[m.status] || [m.status || "—", "p-dim"]; return `<div class="fc-row"><span class="fc-t">${esc(m.assunto || "sem assunto")}</span><span class="mono">${esc(TIPO_MAP[m.tipo] || m.tipo || "—")}</span><span class="pill ${c}">${esc(t)}</span></div>`; }).join("")
          : '<div class="fc-vazio">Nenhuma mensagem.</div>') + "</div>";
    }

    h += `<div class="mmsg-body-lbl">Linha do tempo</div><div class="fc-sec">` +
      ((d.linha_tempo || []).length
        ? d.linha_tempo.map((t) => `<div class="fc-tl"><span>${esc(fmtTl(t.em))}</span><span>${esc(t.texto)}</span></div>`).join("")
        : '<div class="fc-vazio">Sem registros.</div>') + "</div>";

    h += `<details class="fc-det"><summary>Dados da conta</summary><div class="mmsg-meta">
        ${campo("Nome", u.nome_completo)}${campo("E-mail", u.email)}
        ${campo("Telefone", u.telefone)}${campo("CPF", u.cpf_mascarado)}
        ${campo("Cidade", [u.cidade, u.estado].filter(Boolean).join(" / "))}${campo("Cliente desde", u.criado_em ? fmtDH(u.criado_em) : "")}
        ${campo("Tentativas de login", u.tentativas_login != null ? u.tentativas_login : 0)}${campo("Login liberado a partir de", bloq ? fmtDH(u.bloqueado_ate) : susp ? "suspensa até ser reativada" : "")}
      </div></details>`;

    $("cd-corpo").innerHTML = h;
    $("cd-ft").innerHTML = `<button class="btn-cancel" onclick="cm('cadastro')">Fechar</button><button class="btn-save" onclick="fichaEditar()">Editar dados</button>`;
  }

  window.fichaEditar = () => { if (!atual) return; cm("cadastro"); openUser(atual); };

  async function chamar(url, metodo, corpo, okMsg) {
    ocupado = true;
    const id = num(atual.id);
    try {
      const r = await fetch(`${API}/admin/usuarios/${id}/${url}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo || {}),
      });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) { toast(d.erro || "Erro ao executar a ação", "err"); return; }
      toast(okMsg, "ok");
      window.fichaAbrir(id);
    } catch (e) {
      toast("Não foi possível conectar ao servidor", "err");
    } finally {
      ocupado = false;
    }
  }

  window.fichaAcao = async (tipo) => {
    if (!atual || ocupado) return;
    const codigo = tipo === "codigo";
    const nome = atual.nome_completo || atual.email;
    const pergunta = codigo
      ? `Enviar um novo código de verificação para ${atual.email}?`
      : suspensa(atual) ? `Reativar a conta de ${nome}? A pessoa volta a poder entrar.`
      : `Desbloquear o login de ${nome}? As tentativas erradas voltam a zero.`;
    if (!confirm(pergunta)) return;
    await chamar(codigo ? "reenviar-codigo" : "desbloquear", codigo ? "POST" : "PUT", {},
      codigo ? "Código enviado para " + atual.email : suspensa(atual) ? "Conta reativada" : "Login desbloqueado");
  };

  window.fichaSuspender = async () => {
    if (!atual || ocupado) return;
    const motivo = prompt(`Suspender a conta de ${atual.nome_completo || atual.email}?\nA pessoa não consegue mais entrar até você reativar.\n\nMotivo (opcional):`);
    if (motivo === null) return;
    await chamar("suspender", "PUT", { motivo: motivo.trim() }, "Conta suspensa");
  };

  window.fichaAbrir = async (id) => {
    $("cd-titulo").textContent = "Usuário #" + num(id);
    $("cd-sub").textContent = "Carregando…";
    $("cd-corpo").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    $("cd-ft").innerHTML = "";
    om("cadastro");
    try {
      const r = await fetch(`${API}/admin/usuarios/${num(id)}/ficha`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(d.erro || "HTTP " + r.status);
      desenhar(d);
    } catch (e) {
      $("cd-titulo").textContent = "Usuário";
      $("cd-sub").textContent = "";
      $("cd-corpo").innerHTML = `<div class="empty">Falha ao carregar: ${esc(e.message)}</div>`;
      $("cd-ft").innerHTML = '<button class="btn-cancel" onclick="cm(\'cadastro\')">Fechar</button>';
    }
  };
  window.uOpen = (id) => window.fichaAbrir(id);
})();

/* ══════════ 2. MENSAGENS: CAIXA DE ENTRADA ══════════ */
(function () {
  const $ = (id) => document.getElementById(id);
  const pg = $("pg-mensagens");
  if (!pg) return;

  const KM = "admin_modelos_resp", KR = "admin_rascunho_";
  const HORA = 36e5;
  const PADRAO = [
    { t: "Ingresso não chegou", c: "Olá, {nome}! Vamos reenviar o seu ingresso para {email}. Confira também a caixa de spam. Se não chegar em 10 minutos, é só responder este e-mail." },
    { t: "Dúvida de pagamento", c: "Olá, {nome}! Recebemos a sua dúvida sobre o pagamento. Pode nos informar o número do pedido e a forma de pagamento usada? Assim conseguimos verificar rapidamente." },
    { t: "Parceria comercial", c: "Olá, {nome}! Obrigado pelo interesse em ser parceiro do Rolês. Pode nos contar um pouco mais sobre o seu estabelecimento ou evento e o que você tem em mente? Voltamos a falar com você em seguida." },
    { t: "Cancelamento", c: "Olá, {nome}! Sobre o cancelamento: pode nos informar o número do pedido e o motivo? O cancelamento segue as regras do organizador do evento, e vamos verificar o seu caso com a equipe." },
  ];
  const PST = { aprovado: ["Pago", "p-gn"], pendente: ["Pendente", "p-yw"], cortesia: ["Cortesia", "p-bl"], cancelado: ["Cancelado", "p-rd"], reembolsado: ["Reembolsado", "p-cy"] };
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let msgs = [], filtro = "todas", selId = null, atrib = {}, eu = null, ctx = {};
  let pintado = null, tRasc = null, salvoEm = null, ultimoModelo = null, ultimoTexto = "", abrirDepois = null;

  pg.innerHTML = `
    <div class="err-bar" id="err-msg"></div>
    <div class="tk-filters" id="mx-chips"></div>
    <div class="mx-bar">
      <div class="srch">
        <svg class="srch-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4" /></svg
        ><input class="srch-inp" type="text" placeholder="Buscar por nome, e-mail, assunto…" id="s-msg" />
      </div>
      <span class="filter-ct" id="fc-msg"></span>
    </div>
    <div class="mx-split">
      <div class="mx-list" id="tb-msg"><div class="loading"><div class="spin"></div>carregando...</div></div>
      <aside class="mx-panel" id="mx-panel"></aside>
    </div>`;

  /* ── regras ── */
  const primeiro = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const idade = (d) => { const t = d ? new Date(d).getTime() : NaN; return Number.isFinite(t) ? Date.now() - t : 0; };
  function fmtIdade(ms) {
    const min = Math.floor(ms / 6e4);
    if (min < 60) return "há " + Math.max(1, min) + " min";
    const h = Math.floor(ms / HORA);
    if (h < 24) return "há " + h + " h";
    const d = Math.floor(h / 24);
    return d === 1 ? "ontem" : "há " + d + " dias";
  }
  const aberta = (m) => m.status !== "respondido";
  const dono = (m) => atrib["mensagem:" + m.id] || null;
  const souEu = (d) => !!d && !!eu && String(d.usuario_id) === String(eu.id);
  const urgente = (m) => aberta(m) && (idade(m.criado_em) > 4 * HORA || ["problema", "suporte"].includes(m.tipo));
  const achar = (id) => msgs.find((x) => String(x.id) === String(id));
  const H = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const FIL = {
    todas: ["Todas", () => true],
    novas: ["Novas", (m) => m.status === "novo"],
    andamento: ["Em andamento", (m) => aberta(m) && !!dono(m)],
    minhas: ["Minhas", (m) => aberta(m) && souEu(dono(m))],
    respondidas: ["Respondidas", (m) => m.status === "respondido"],
  };

  function visiveis() {
    const q = ($("s-msg").value || "").toLowerCase().trim();
    return msgs
      .filter(FIL[filtro][1])
      .filter((m) => !q || [m.id, m.nome, m.email, m.assunto, m.mensagem].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (urgente(b) ? 2 : 0) + (aberta(b) ? 1 : 0) - ((urgente(a) ? 2 : 0) + (aberta(a) ? 1 : 0)));
  }

  /* ── lista ── */
  function itemHtml(m) {
    const d = dono(m);
    const tags = [];
    if (urgente(m)) tags.push('<span class="pill p-rd">Urgente</span>');
    tags.push(`<span class="pill p-bl">${esc(TIPO_MAP[m.tipo] || m.tipo || "Contato")}</span>`);
    if (m.status === "respondido") tags.push('<span class="pill p-gn">Respondida</span>');
    else if (!d) tags.push('<span class="pill p-dim">Sem responsável</span>');
    else if (souEu(d)) tags.push('<span class="pill p-gn">Com você</span>');
    else tags.push('<span class="pill p-yw">Em andamento</span>', `<span class="pill p-dim">Com ${esc(primeiro(d.nome))}</span>`);
    return `<div class="mx-it ${m.status === "novo" ? "unread" : ""} ${String(m.id) === String(selId) ? "sel" : ""}" data-id="${num(m.id)}">
      <div class="mx-it-top"><b>${esc(m.nome)}</b><span>${esc(fmtIdade(idade(m.criado_em)))}</span></div>
      <div class="mx-it-sub">${esc(m.assunto)}</div>
      <div class="mx-tags">${tags.join("")}</div></div>`;
  }

  function render() {
    const lista = $("tb-msg"), sc = lista.scrollTop;
    $("mx-chips").innerHTML = Object.keys(FIL)
      .map((k) => `<button type="button" class="tk-chip ${filtro === k ? "on" : ""}" data-k="${k}">${FIL[k][0]} <i>${msgs.filter(FIL[k][1]).length}</i></button>`).join("");
    const v = visiveis();
    const q = $("s-msg").value.trim();
    $("fc-msg").textContent = q || filtro !== "todas" ? v.length + " resultado" + (v.length !== 1 ? "s" : "") : "";
    lista.innerHTML = v.length ? v.map(itemHtml).join("") : '<div class="empty">Nenhuma mensagem nesta lista.</div>';
    lista.scrollTop = sc;
    const novas = msgs.filter((m) => m.status === "novo").length;
    if ($("nb-msg")) $("nb-msg").textContent = novas > 0 ? novas : msgs.length;
  }
  updateMsgStats = function () { render(); };

  /* ── modelos de resposta (mesmas chaves do modal antigo) ── */
  const lerModelos = () => {
    try { const a = JSON.parse(localStorage.getItem(KM) || "[]"); return Array.isArray(a) ? a.filter((x) => x && x.t && x.c) : []; } catch (e) { return []; }
  };
  const gravarModelos = (a) => { try { localStorage.setItem(KM, JSON.stringify(a)); } catch (e) { toast("Não foi possível salvar o modelo neste navegador", "err"); } };
  const preencher = (t, m) => t.replace(/\{nome\}/g, primeiro(m.nome) || "cliente").replace(/\{email\}/g, m.email || "seu e-mail");
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function chips() {
    const box = $("mx-modelos");
    if (!box) return;
    const custom = lerModelos();
    box.innerHTML =
      PADRAO.map((x, i) => `<button type="button" class="tk-chip ${ultimoModelo === "p" + i ? "mm-sel" : ""}" onclick="mxModelo('p',${i})">${esc(x.t)}</button>`).join("") +
      custom.map((x, i) => `<span class="mm-cm"><button type="button" class="tk-chip ${ultimoModelo === "c" + i ? "mm-sel" : ""}" onclick="mxModelo('c',${i})">${esc(x.t)}</button><button type="button" class="tk-x" title="Remover modelo" aria-label="Remover modelo" onclick="mxRemover(${i})">×</button></span>`).join("") +
      '<button type="button" class="tk-chip" onclick="mxSalvarModelo()">+ Salvar como modelo</button>';
  }
  function rotuloRasc() {
    const e = $("mx-rasc");
    if (!e) return;
    if (!salvoEm) { e.textContent = ""; return; }
    const s = Math.round((Date.now() - salvoEm) / 1000);
    e.textContent = s < 5 ? "Rascunho salvo agora" : s < 60 ? `Rascunho salvo há ${s} s` : `Rascunho salvo há ${Math.floor(s / 60)} min`;
  }
  setInterval(rotuloRasc, 5000);

  function salvarRascunho() {
    const ta = $("mx-resp"), m = achar(selId);
    if (!m || !ta) return;
    try {
      if (ta.value.trim()) { localStorage.setItem(KR + m.id, JSON.stringify({ t: ta.value, at: Date.now() })); salvoEm = Date.now(); }
      else { localStorage.removeItem(KR + m.id); salvoEm = null; }
    } catch (e) {}
    rotuloRasc();
  }

  window.mxModelo = (tipo, i) => {
    const ta = $("mx-resp"), m = achar(selId);
    if (!ta || !m) return;
    const modelo = tipo === "p" ? PADRAO[i] : lerModelos()[i];
    if (!modelo) return;
    const atualTxt = ta.value.trim();
    if (atualTxt && atualTxt !== ultimoTexto && !confirm("Substituir o texto que você já escreveu por este modelo?")) return;
    ta.value = preencher(modelo.c, m);
    ultimoTexto = ta.value;
    ultimoModelo = tipo + i;
    ta.focus();
    salvarRascunho();
    chips();
  };
  window.mxSalvarModelo = () => {
    const ta = $("mx-resp"), m = achar(selId);
    const texto = ta ? ta.value.trim() : "";
    if (!texto) { toast("Escreva o texto antes de salvar como modelo", "err"); return; }
    const l = lerModelos();
    if (l.length >= 12) { toast("Limite de 12 modelos. Remova algum primeiro.", "err"); return; }
    const nome = (prompt("Nome do modelo:") || "").trim().slice(0, 30);
    if (!nome) return;
    let c = texto;
    if (m && m.email) c = c.split(m.email).join("{email}");
    const p = primeiro(m && m.nome);
    if (p.length >= 3) c = c.replace(new RegExp("(?<![\\p{L}\\p{N}])" + escRe(p) + "(?![\\p{L}\\p{N}])", "gu"), "{nome}");
    l.push({ t: nome, c });
    gravarModelos(l);
    chips();
    toast("Modelo salvo", "ok");
  };
  window.mxRemover = (i) => {
    const l = lerModelos();
    if (!l[i] || !confirm(`Remover o modelo "${l[i].t}"?`)) return;
    l.splice(i, 1);
    gravarModelos(l);
    ultimoModelo = null;
    chips();
  };

  /* ── painel ── */
  function pintar() {
    const p = $("mx-panel"), m = achar(selId);
    if (!m) { pintado = null; p.innerHTML = '<div class="empty">Selecione uma mensagem para ler e responder.</div>'; return; }
    const mesma = pintado === m.id;
    const manter = mesma && $("mx-resp") ? $("mx-resp").value : null;
    const notaTxt = mesma && $("mx-nota") ? $("mx-nota").value : "";
    const c = ctx[m.id] || null, d = dono(m), resp = !aberta(m);
    const usr = c && c.usuario, ped = c && c.pedido;

    const sub = esc(m.email) + (usr ? ` · <a class="mx-lk" onclick="mxFicha(${num(usr.id)})">Ver ficha do usuário</a>` : c ? " · sem conta no site" : "");
    const tagTopo = urgente(m) ? '<span class="pill p-rd">Urgente</span>'
      : m.status === "respondido" ? '<span class="pill p-gn">Respondida</span>'
      : m.status === "novo" ? '<span class="pill p-bl">Nova</span>' : '<span class="pill p-yw">Lida</span>';

    let pedHtml = "";
    if (ped) {
      const [pt, pc] = PST[ped.status] || [ped.status || "—", "p-dim"];
      pedHtml = `<div class="mx-ped"><span>${c.pedido_origem === "citado" ? "Pedido ligado" : "Último pedido"}: <b>#${num(ped.id)}</b> · ${esc(ped.evento_nome || "—")}</span>
        <span class="mx-ped-r"><span class="pill ${pc}">${esc(pt)}</span><b>${esc(fmtBRL(ped.valor_total))}</b><button class="act act-edit" onclick="verPedido(${num(ped.id)})">Abrir</button></span></div>`;
    }

    const resposta = resp
      ? `<div class="ev-lbl" style="color:var(--green)">✔ Resposta enviada</div><div class="mmsg-reply-responded">${esc(m.resposta || "—")}</div>`
      : `<div class="ev-lbl">Respostas prontas</div>
         <div class="tk-filters" id="mx-modelos" style="margin-bottom:10px"></div>
         <textarea class="mmsg-reply-area" id="mx-resp" placeholder="Escreva sua resposta aqui…"></textarea>
         <div class="mm-rasc" id="mx-rasc"></div>`;

    const notas = (c && c.notas) || [];
    const notasHtml = notas.map((n) => `<div class="mx-nota"><b>Nota interna (o cliente não vê)</b>${esc(n.texto)}<small>${esc(n.nome_completo || "—")} · ${esc(fmtDH(n.criado_em))}</small></div>`).join("")
      + `<div class="mx-nota-add"><input id="mx-nota" maxlength="500" placeholder="Adicionar nota interna (o cliente não vê)" autocomplete="off"><button type="button" class="act act-edit" onclick="mxNota()">Salvar nota</button></div>`;

    const bAndamento = resp ? ""
      : !d ? '<button type="button" class="btn-cancel" onclick="mxAssumir()">Marcar em andamento</button>'
      : souEu(d) ? '<button type="button" class="btn-cancel" onclick="mxSoltar()">Liberar mensagem</button>'
      : eu && eu.role === "master" ? `<button type="button" class="btn-cancel" onclick="mxSoltar()">Liberar (com ${esc(primeiro(d.nome))})</button>` : "";
    const bEnviar = resp ? "" : '<button type="button" class="btn-save" id="mx-env" onclick="mxEnviar()">Enviar resposta</button>';

    p.innerHTML = `
      <div class="ev-ph"><div><b class="ev-t">${esc(m.nome)}</b><div class="ev-sub">${sub}</div></div>${tagTopo}</div>
      <div class="ev-lbl">${esc(m.assunto)} · ${esc(TIPO_MAP[m.tipo] || m.tipo || "Contato")} · ${esc(fmtIdade(idade(m.criado_em)))}</div>
      <div class="mx-msg">${esc(m.mensagem)}</div>
      ${pedHtml}${resposta}${notasHtml}
      <div class="mx-foot"><span class="ev-hint">Atalhos: R responde, S assume, setas navegam</span><div class="mx-btns">${bAndamento}${bEnviar}</div></div>
      <div class="ev-mais"><button type="button" onclick="del('mensagens',${num(m.id)},loadMsg)">Arquivar</button></div>`;

    const ta = $("mx-resp");
    if (ta) {
      if (manter !== null) ta.value = manter;
      else {
        try { const r = JSON.parse(localStorage.getItem(KR + m.id) || "null"); if (r && r.t) { ta.value = r.t; salvoEm = r.at; } else salvoEm = null; } catch (e) {}
      }
    }
    if (notaTxt && $("mx-nota")) $("mx-nota").value = notaTxt;
    pintado = m.id;
    chips();
    rotuloRasc();
  }

  $("mx-panel").addEventListener("input", (e) => {
    if (e.target.id !== "mx-resp") return;
    clearTimeout(tRasc);
    tRasc = setTimeout(salvarRascunho, 600);
  });

  /* ── dados ── */
  async function carregarAtrib() {
    try {
      const r = await fetch(`${API}/admin/atribuicoes`, { headers: H() });
      if (!r.ok) return;
      const novo = {};
      (await r.json()).forEach((a) => { novo[a.tipo + ":" + a.ref_id] = { usuario_id: a.usuario_id, nome: a.nome_completo || "outra pessoa" }; });
      atrib = novo;
    } catch (e) {}
  }
  async function carregarEu() {
    if (eu) return;
    try { const r = await fetch(`${API}/admin/acesso`, { headers: H() }); if (r.ok) eu = await r.json(); } catch (e) {}
  }
  async function carregarCtx(id, forcar) {
    if (ctx[id] && !forcar) return;
    try {
      const r = await fetch(`${API}/admin/mensagens/${num(id)}/contexto`, { headers: H() });
      if (r.status === 401) { logout(); return; }
      ctx[id] = r.ok ? await r.json() : { erro: true, notas: [] };
    } catch (e) { ctx[id] = { erro: true, notas: [] }; }
    if (String(selId) === String(id)) pintar();
  }

  function selecionar(id, marcar) {
    selId = id; ultimoModelo = null; ultimoTexto = ""; salvoEm = null; pintado = null;
    document.querySelectorAll("#tb-msg .mx-it").forEach((r) => r.classList.toggle("sel", r.dataset.id === String(id)));
    pintar();
    carregarCtx(id);
    const r = document.querySelector("#tb-msg .mx-it.sel");
    if (r) r.scrollIntoView({ block: "nearest" });
    const m = achar(id);
    if (marcar && m && m.status === "novo") {
      m.status = "lido";
      fetch(`${API}/admin/mensagens/${m.id}/lido`, { method: "PUT", headers: H() }).catch(() => {});
      render();
    }
  }

  loadMsg = async function () {
    hideErr("err-msg");
    $("tb-msg").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
      const [d] = await Promise.all([api("mensagens"), carregarAtrib(), carregarEu()]);
      msgs = d; allMsgs = d;
      if (abrirDepois != null) { filtro = "todas"; $("s-msg").value = ""; if (achar(abrirDepois)) selId = abrirDepois; abrirDepois = null; }
      if (!achar(selId)) { const v = visiveis(); selId = v[0] ? v[0].id : null; }
      render();
      pintado = null;
      pintar();
      if (selId != null) carregarCtx(selId, true);
    } catch (e) {
      showErr("err-msg", "Erro: " + e.message);
      $("tb-msg").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
  };

  /* ── ações ── */
  window.mxFicha = (id) => window.fichaAbrir(id);

  window.mxAssumir = async () => {
    const m = achar(selId);
    if (!m) return;
    await window.tkAtribuir("mensagem", m.id, "assumir");
    await carregarAtrib();
    render(); pintar();
  };
  window.mxSoltar = async () => {
    const m = achar(selId);
    if (!m) return;
    await window.tkAtribuir("mensagem", m.id, "soltar");
    await carregarAtrib();
    render(); pintar();
  };

  window.mxNota = async () => {
    const m = achar(selId), inp = $("mx-nota");
    const texto = inp ? inp.value.trim() : "";
    if (!m || !texto) { toast("Escreva a nota antes de salvar", "err"); return; }
    try {
      const r = await fetch(`${API}/admin/mensagens/${num(m.id)}/notas`, { method: "POST", headers: H(), body: JSON.stringify({ texto }) });
      if (r.status === 401) { logout(); return; }
      let d = {};
      try { d = await r.json(); } catch (e) {}
      if (!r.ok) { toast(d.erro || "Erro ao salvar a nota", "err"); return; }
      inp.value = "";
      toast("Nota salva", "ok");
      await carregarCtx(m.id, true);
    } catch (e) { toast("Não foi possível conectar ao servidor", "err"); }
  };

  window.mxEnviar = async () => {
    const m = achar(selId), ta = $("mx-resp"), btn = $("mx-env");
    const texto = ta ? ta.value.trim() : "";
    if (!m) return;
    if (!texto) { toast("Escreva uma resposta antes de enviar", "err"); return; }
    const d = dono(m);
    if (d && !souEu(d) && !confirm(`Esta mensagem está com ${d.nome}. Responder mesmo assim?`)) return;
    const v = visiveis(), i = v.findIndex((x) => String(x.id) === String(m.id));
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      const r = await fetch(`${API}/admin/mensagens/${num(m.id)}/responder`, { method: "POST", headers: H(), body: JSON.stringify({ resposta: texto }) });
      if (r.status === 401) { logout(); return; }
      let j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(j.erro || "Erro ao enviar");
      m.status = "respondido"; m.resposta = texto;
      try { localStorage.removeItem(KR + m.id); } catch (e) {}
      toast("Resposta enviada com sucesso!", "ok");
      await carregarAtrib();
      render();
      const prox = v.slice(i + 1).find(aberta);
      if (prox) selecionar(prox.id, true); else { pintado = null; pintar(); }
      loadDash();
    } catch (e) {
      toast("Erro: " + e.message, "err");
      btn.disabled = false; btn.textContent = "Enviar resposta";
    }
  };

  // a lista de tarefas leva para cá em vez de abrir a janela antiga
  window.tkMsg = (id) => {
    abrirDepois = id;
    window.goTo("mensagens");
  };

  /* ── cliques e teclado ── */
  $("mx-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    filtro = b.dataset.k;
    const v = visiveis();
    render();
    if (!v.some((x) => String(x.id) === String(selId))) { if (v[0]) selecionar(v[0].id, false); else { selId = null; pintar(); } }
  });
  $("s-msg").addEventListener("input", render);
  $("tb-msg").addEventListener("click", (e) => {
    const r = e.target.closest(".mx-it");
    if (r) selecionar(r.dataset.id, true);
  });

  function mover(dir) {
    const v = visiveis();
    if (!v.length) return;
    const i = Math.max(0, v.findIndex((x) => String(x.id) === String(selId)));
    selecionar(v[Math.min(Math.max(i + dir, 0), v.length - 1)].id, true);
  }

  document.addEventListener("keydown", (e) => {
    if (cur !== "mensagens") return;
    if (e.target && e.target.id === "mx-resp") {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); window.mxEnviar(); }
      else if (e.key === "Escape") e.target.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector(".modal-wrap.on")) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j") { e.preventDefault(); mover(1); }
    else if (k === "arrowup" || k === "k") { e.preventDefault(); mover(-1); }
    else if (k === "r") { const ta = $("mx-resp"); if (ta) { e.preventDefault(); ta.focus(); } }
    else if (k === "s") { const m = achar(selId); if (m && aberta(m) && !dono(m)) { e.preventDefault(); window.mxAssumir(); } }
  });
})();

/* ══════════ 3. BLOQUEAR EVENTO COM VENDAS ══════════ */
(function () {
  const $ = (id) => document.getElementById(id);
  const wrap = $("mw-motivo");
  if (!wrap) return;
  const fmtBRL = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  wrap.querySelector(".mf").insertAdjacentHTML("beforebegin", '<div id="mo-extra"></div>');
  let escolha = "manter", seq = 0;

  window.moEscolha = (v) => {
    escolha = v;
    document.querySelectorAll("#mo-extra .mo-op").forEach((l) => l.classList.toggle("on", l.dataset.v === v));
  };

  window.pedirMotivo = (ep, id, cb) => {
    const meu = ++seq;
    escolha = "manter";
    $("mo-texto").value = "";
    hideErr("err-mo");
    const item = ep === "eventos" ? byId(cache.ev, id) : null;
    const bloquear = !!item && (item.status_aprovacao || "aprovado") === "aprovado";
    wrap.querySelector(".modal-hd h2").textContent = bloquear ? "Bloquear evento" : "Recusar cadastro";
    $("mo-ok").textContent = bloquear ? "Bloquear evento" : "Confirmar recusa";
    $("mo-extra").innerHTML = bloquear
      ? `<p class="mo-intro">${esc(item.nome || "Este evento")} sai do ar e deixa de vender ingressos.</p><div id="mo-vendas"></div>` : "";
    let pagos = 0;

    $("mo-ok").onclick = async () => {
      const motivo = $("mo-texto").value.trim();
      if (motivo.length < 10) { showErr("err-mo", "Explique o motivo em pelo menos 10 caracteres."); return; }
      const cancelar = escolha === "cancelar" && pagos > 0;
      if (cancelar && !confirm(`Cancelar ${pagos} pedido(s) pago(s) e registrar o reembolso? Os compradores serão avisados por e-mail.`)) return;
      $("mo-ok").disabled = true;
      try {
        const body = { status: "bloqueado", motivo };
        if (cancelar) body.pedidos = "cancelar";
        const r = await fetch(`${API}/admin/${ep}/${num(id)}/status`, {
          method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (r.status === 401) { logout(); return; }
        let d = {};
        try { d = await r.json(); } catch (e) {}
        if (!r.ok) { toast(d.erro || "Erro ao atualizar", "err"); return; }
        let msg = bloquear ? "Evento bloqueado" : "Cadastro recusado", erro = false;
        if (cancelar) {
          const n = Number(d.pedidos_reembolsados) || 0;
          msg += `, ${n} pedido(s) reembolsado(s)`;
          if (d.pedidos_falhas) { msg += `, ${d.pedidos_falhas} não puderam ser cancelados`; erro = true; }
          if (d.emails_falhos) { msg += `, ${d.emails_falhos} comprador(es) sem aviso por e-mail`; erro = true; }
        }
        if (d.email_enviado === false) { msg += ", mas não foi possível avisar o produtor por e-mail"; erro = true; }
        else msg += " e produtor avisado por e-mail";
        toast(msg, erro ? "err" : "ok");
        cm("motivo");
        if (cb) cb();
      } catch (e) {
        toast("Não foi possível conectar ao servidor", "err");
      } finally {
        $("mo-ok").disabled = false;
      }
    };

    om("motivo");
    $("mo-texto").focus();

    if (bloquear) {
      fetch(`${API}/admin/eventos/${num(id)}/vendas`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (meu !== seq || !v || !(Number(v.pedidos_pagos) > 0)) return;
          pagos = Number(v.pedidos_pagos);
          $("mo-vendas").innerHTML = `
            <div class="mo-aviso"><b>Este evento já tem vendas</b>${pagos} pedido${pagos === 1 ? " pago" : "s pagos"}, ${esc(fmtBRL(v.valor))}. Os compradores continuam com ingresso válido, a menos que você cancele os pedidos.</div>
            <div class="mo-lbl">O que fazer com os pedidos pagos</div>
            <label class="mo-op on" data-v="manter"><input type="radio" name="mo-ped" checked onchange="moEscolha('manter')"><span><b>Manter os pedidos</b><small>Só bloqueia novas vendas.</small></span></label>
            <label class="mo-op" data-v="cancelar"><input type="radio" name="mo-ped" onchange="moEscolha('cancelar')"><span><b>Cancelar e registrar reembolso</b><small>Compradores são avisados por e-mail. A devolução do dinheiro é feita por fora, pelo meio de pagamento usado.</small></span></label>`;
        })
        .catch(() => {});
    }
  };
})();

// =====================================================
// DIÁLOGOS PRÓPRIOS — substitui os alert/confirm/prompt do navegador
// COLE ESTE ARQUIVO INTEIRO NO FIM DO admin.js (depois de todos os outros blocos).
// Não precisa mexer em mais nada: as funções que usavam confirm/prompt/alert passam a usar a janela nova.
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);

  /* ── estilo ── */
  const estilo = document.createElement("style");
  estilo.textContent = `
    #mw-dlg { z-index: 9500; }
    .dlg-box { width: 420px; }
    .dlg-body { display: flex; gap: 14px; padding: 22px 22px 6px; align-items: flex-start; }
    .dlg-ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--accent-light); color: var(--accent); }
    .dlg-ico.perigo { background: var(--red-bg); color: var(--red); }
    .dlg-body h2 { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.3; margin: 0; overflow-wrap: anywhere; }
    .dlg-body p { margin-top: 6px; font-size: 13px; line-height: 1.55; color: var(--text-2); white-space: pre-line; user-select: text; overflow-wrap: anywhere; }
    .dlg-inp { padding: 12px 22px 2px; }
    .dlg-inp label { display: block; font-size: 12px; font-weight: 700; color: var(--text-2); margin-bottom: 6px; }
    .dlg-inp input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-md); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; font-size: 13px; outline: none; }
    .dlg-inp input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12); }
    .dlg-ft { border-top: 0; padding: 16px 22px 20px; }
    .btn-save.dlg-danger { background: var(--red) !important; box-shadow: none; }
  `;
  document.head.appendChild(estilo);

  const ICO_PERG = '<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M6.2 6.2a1.9 1.9 0 113 1.5c-.7.5-1.2.8-1.2 1.6M8 11.4v.1"/></svg>';
  const ICO_AVISO = '<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.6v.1"/></svg>';

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-dlg">
      <div class="modal dlg-box" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
        <div class="dlg-body">
          <div class="dlg-ico" id="dlg-ico"></div>
          <div style="min-width:0;flex:1"><h2 id="dlg-t"></h2><p id="dlg-p"></p></div>
        </div>
        <div class="dlg-inp" id="dlg-in-wrap" style="display:none"><label id="dlg-lb" for="dlg-in"></label><input id="dlg-in" maxlength="200" autocomplete="off"></div>
        <div class="modal-ft dlg-ft"><button type="button" class="btn-cancel" id="dlg-no">Voltar</button><button type="button" class="btn-save" id="dlg-ok">Confirmar</button></div>
      </div>
    </div>`);

  const wrap = $("mw-dlg");
  let ativo = null;
  let cadeia = Promise.resolve();

  function mostrar(c) {
    return new Promise((res) => {
      $("dlg-t").textContent = c.titulo;
      $("dlg-p").textContent = c.texto || "";
      $("dlg-p").style.display = c.texto ? "" : "none";
      const ico = $("dlg-ico");
      ico.className = "dlg-ico" + (c.perigo ? " perigo" : "");
      ico.innerHTML = c.perigo ? ICO_AVISO : ICO_PERG;
      $("dlg-in-wrap").style.display = c.campo ? "" : "none";
      if (c.campo) { $("dlg-lb").textContent = c.rotulo || ""; $("dlg-in").value = c.valor || ""; }
      $("dlg-ok").textContent = c.ok || "Confirmar";
      $("dlg-ok").className = "btn-save" + (c.perigo ? " dlg-danger" : "");
      $("dlg-no").textContent = c.voltar || "Voltar";
      $("dlg-no").style.display = c.soOk ? "none" : "";
      ativo = { res, campo: !!c.campo, soOk: !!c.soOk, anterior: document.activeElement };
      wrap.classList.add("on");
      setTimeout(() => (c.campo ? $("dlg-in") : $("dlg-ok")).focus(), 30);
    });
  }

  function fechar(valor) {
    if (!ativo) return;
    const a = ativo;
    ativo = null;
    wrap.classList.remove("on");
    if (a.anterior && a.anterior.focus) { try { a.anterior.focus(); } catch (e) {} }
    a.res(valor);
  }
  const confirmarOk = () => ativo && fechar(ativo.campo ? $("dlg-in").value : true);
  const cancelar = () => ativo && !ativo.soOk && fechar(ativo.campo ? null : false);

  $("dlg-ok").addEventListener("click", confirmarOk);
  $("dlg-no").addEventListener("click", cancelar);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) cancelar(); });

  // Esc cancela só esta janela (sem fechar as outras que estejam por baixo); Enter confirma; Tab fica dentro
  document.addEventListener("keydown", (e) => {
    if (!ativo) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); cancelar(); return; }
    if (e.key === "Enter" && e.target === $("dlg-in")) { e.preventDefault(); e.stopImmediatePropagation(); confirmarOk(); return; }
    if (e.key === "Tab") {
      const foc = [$("dlg-in-wrap").style.display === "none" ? null : $("dlg-in"), ativo.soOk ? null : $("dlg-no"), $("dlg-ok")].filter(Boolean);
      const i = foc.indexOf(document.activeElement);
      e.preventDefault();
      foc[(i + (e.shiftKey ? -1 : 1) + foc.length) % foc.length].focus();
    }
  }, true);

  // várias janelas pedidas em seguida entram numa fila
  const abrir = (c) => { const p = cadeia.then(() => mostrar(c)); cadeia = p.catch(() => {}); return p; };

  window.dlg = {
    confirmar: (c) => abrir(c),
    perguntar: (c) => abrir({ ...c, campo: true }),
    avisar: (c) => abrir({ ok: "Entendi", ...c, soOk: true }),
  };

  /* ── transforma o texto antigo (do confirm/prompt) em título + explicação + botão ── */
  const PERIGO = /^(Suspender|Arquivar|Remover|Excluir|Cancelar|Descartar|Recusar|Bloquear)/;
  const VERBOS = /^(Suspender|Reativar|Desbloquear|Aprovar|Arquivar|Verificar|Enviar|Reenviar|Remover|Substituir|Cancelar|Excluir|Descartar|Recusar|Bloquear|Responder|Confirmar)\b/;

  function partir(msg, ehPrompt) {
    const linhas = String(msg == null ? "" : msg).split("\n").map((s) => s.trim());
    let rotulo = "";
    if (ehPrompt) {
      while (linhas.length && !linhas[linhas.length - 1]) linhas.pop();
      const u = linhas[linhas.length - 1] || "";
      if (/:$/.test(u)) { rotulo = u.replace(/:$/, ""); linhas.pop(); }
    }
    const l = linhas.filter(Boolean);
    let titulo = l.shift() || "";
    if (!l.length) {
      const m = /^(.*?[?!])\s+(.+)$/.exec(titulo);
      if (m) { titulo = m[1]; l.push(m[2]); }
    }
    if (!titulo && rotulo) { titulo = rotulo; rotulo = ""; }
    titulo = titulo || "Confirmar";
    const v = VERBOS.exec(titulo);
    return { titulo, texto: l.join("\n"), rotulo, ok: v ? v[1] : ehPrompt ? "Salvar" : "Confirmar", perigo: PERIGO.test(titulo) };
  }

  /* ── envolve as funções que usavam confirm/prompt, sem mexer no código delas ──
     1ª tentativa: confirm/prompt "de mentira" só anotam a pergunta e cancelam;
     depois mostramos a janela bonita e, se a pessoa aceitar, roda de novo já respondendo "sim". */
  function envolver(fn) {
    return function (...args) {
      const nConfirm = window.confirm, nPrompt = window.prompt;
      let pergunta = null, ehPrompt = false;
      window.confirm = (m) => { if (pergunta === null) { pergunta = m; ehPrompt = false; } return false; };
      window.prompt = (m) => { if (pergunta === null) { pergunta = m; ehPrompt = true; } return null; };
      let r;
      try { r = fn.apply(this, args); } finally { window.confirm = nConfirm; window.prompt = nPrompt; }
      if (pergunta === null) return r; // nunca precisou perguntar: já rodou normalmente

      const p = partir(pergunta, ehPrompt);
      return abrir({ ...p, campo: ehPrompt }).then((resp) => {
        if (ehPrompt ? resp === null : !resp) return;
        window.confirm = () => true;
        window.prompt = () => resp;
        try { return fn.apply(this, args); } finally { window.confirm = nConfirm; window.prompt = nPrompt; }
      });
    };
  }

  [
    "tkAprovar", "uBulk", "pedAcao", "pedReenviar", "fichaAcao", "fichaSuspender",
    "mxModelo", "mxRemover", "mxSalvarModelo", "mxEnviar", "mmModelo", "mmRemover", "mmSalvarModelo",
  ].forEach((n) => { if (typeof window[n] === "function") window[n] = envolver(window[n]); });

  setStatus = envolver(setStatus); // "Aprovar este cadastro?"

  // "Cancelar e registrar reembolso" na janela de bloquear evento (confirm dentro do botão Confirmar)
  const baseMotivo = window.pedirMotivo;
  window.pedirMotivo = function (...a) {
    const r = baseMotivo.apply(this, a);
    const ok = $("mo-ok");
    if (ok && typeof ok.onclick === "function") ok.onclick = envolver(ok.onclick);
    return r;
  };

  // alert() (ex.: códigos de recuperação do 2FA) vira uma janela que só fecha no botão
  window.alert = (msg) => {
    const p = partir(msg, false);
    dlg.avisar({ titulo: p.titulo.replace(/:$/, ""), texto: p.texto });
  };
})();

// =====================================================
// DENÚNCIAS — denúncias de eventos e locais feitas no site chegam aqui para a equipe responder
// =====================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const H = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const ST = {
    pendente: ["Pendente", "p-yw"], em_analise: ["Em análise", "p-bl"],
    resolvida: ["Resolvida", "p-gn"], rejeitada: ["Rejeitada", "p-dim"],
  };
  const stOf = (d) => d.status || "pendente";
  const aberta = (d) => ["pendente", "em_analise"].includes(stOf(d));
  const epOf = (d) => (/^ev/i.test(String(d.tipo_alvo || "")) ? "eventos" : "estabelecimentos");
  const rotAlvo = (d) => (epOf(d) === "eventos" ? "Evento" : "Local");
  const MOTIVOS = {
    informacoes_incorretas: "Informações incorretas",
    local_fechado: "O local fechou ou não existe",
    conteudo_improprio: "Fotos ou conteúdo impróprio",
    golpe_fraude: "Golpe ou fraude",
    evento_cancelado: "Evento cancelado ou que não vai acontecer",
    outro: "Outro motivo",
  };
  const motivoTxt = (m) => MOTIVOS[m] || m || "—";
  const pill = (s) => { const [t, c] = ST[s] || [s || "—", "p-dim"]; return `<span class="pill ${c}">${esc(t)}</span>`; };
  const dado = (v) => (v == null || String(v).trim() === "" ? "—" : esc(v));
  const kv = (r, h) => `<div class="ev-kv"><span>${r}</span><div>${h}</div></div>`;
  const FIL = {
    abertas: ["Abertas", aberta],
    pendente: ["Pendentes", (d) => stOf(d) === "pendente"],
    em_analise: ["Em análise", (d) => stOf(d) === "em_analise"],
    fechadas: ["Fechadas", (d) => !aberta(d)],
    todas: ["Todas", () => true],
  };
  let lista = [], filtro = "abertas", selId = null, ocupado = false;

  $("pg-denuncias") || document.querySelector(".content").insertAdjacentHTML("beforeend", `
    <div class="page" id="pg-denuncias">
      <div class="err-bar" id="err-den"></div>
      <div class="card">
        <div class="card-head"><div class="card-head-left"><span class="card-title">Denúncias</span><span class="card-badge" id="c-den">—</span></div></div>
        <div class="tbar">
          <div class="tk-filters" id="den-chips" style="margin:0"></div>
          <div class="srch">
            <svg class="srch-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4" /></svg
            ><input class="srch-inp" type="text" placeholder="Buscar por alvo, motivo, denunciante…" id="s-den" />
          </div>
          <span class="filter-ct" id="fc-den"></span>
        </div>
        <div id="tb-den"><div class="loading"><div class="spin"></div>carregando...</div></div>
      </div>
    </div>`);
  TITLES.denuncias = "Denúncias";

  /* ── respostas prontas ──
     s: para qual desfecho serve | m: motivos para os quais a sugestão é mais indicada
     Variáveis: {nome} primeiro nome do denunciante, {alvo} nome do evento/local, {tipo} "evento" ou "local" */
  const MODELOS = [
    { s: "resolvida", t: "Providências tomadas", m: [], c: "Olá, {nome}! Obrigado por nos avisar. Analisamos o {tipo} \"{alvo}\" e tomamos as providências necessárias. Contamos com você para manter o Rolês confiável." },
    { s: "resolvida", t: "Informação corrigida", m: ["informacoes_incorretas"], c: "Olá, {nome}! Você estava certo: as informações do {tipo} \"{alvo}\" estavam incorretas. Já pedimos a correção ao responsável pelo cadastro. Obrigado por avisar." },
    { s: "resolvida", t: "Conteúdo removido", m: ["conteudo_improprio"], c: "Olá, {nome}! Confirmamos que o {tipo} \"{alvo}\" tinha conteúdo que não segue as regras da plataforma. O material foi removido. Obrigado por denunciar." },
    { s: "resolvida", t: "Item retirado da plataforma", m: ["golpe_fraude", "evento_cancelado", "local_fechado"], c: "Olá, {nome}! Verificamos a sua denúncia e o {tipo} \"{alvo}\" foi retirado da plataforma. Obrigado por nos ajudar a proteger os outros usuários." },
    { s: "rejeitada", t: "Sem irregularidade", m: [], c: "Olá, {nome}! Analisamos o {tipo} \"{alvo}\" com cuidado e não encontramos irregularidade que justifique a remoção. Agradecemos por nos avisar." },
    { s: "rejeitada", t: "Informações insuficientes", m: ["outro", "informacoes_incorretas"], c: "Olá, {nome}! Não conseguimos confirmar o problema no {tipo} \"{alvo}\" com as informações enviadas. Se puder, nos conte mais detalhes pelo formulário de contato do Rolês e analisaremos de novo." },
    { s: "rejeitada", t: "Já analisado antes", m: [], c: "Olá, {nome}! O {tipo} \"{alvo}\" já foi analisado pela nossa equipe após uma denúncia anterior e não encontramos irregularidade. Obrigado por colaborar." },
    { s: "rejeitada", t: "Fora das regras de denúncia", m: ["outro"], c: "Olá, {nome}! O motivo informado não se enquadra nas situações que tratamos como denúncia. Se você tem uma dúvida ou sugestão, fale com a nossa equipe pelo formulário de contato do Rolês." },
  ];
  const KM = "admin_modelos_den";
  const lerCustom = () => {
    try { const a = JSON.parse(localStorage.getItem(KM) || "[]"); return Array.isArray(a) ? a.filter((x) => x && x.t && x.c && x.s) : []; }
    catch (e) { return []; }
  };
  const gravarCustom = (a) => {
    try { localStorage.setItem(KM, JSON.stringify(a)); } catch (e) { toast("Não foi possível salvar o modelo neste navegador", "err"); }
  };
  const primeiro = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const preencher = (t, d) => t
    .replace(/\{nome\}/g, primeiro(d.denunciante_nome) || "tudo bem")
    .replace(/\{alvo\}/g, d.alvo_nome || rotAlvo(d))
    .replace(/\{tipo\}/g, rotAlvo(d).toLowerCase());

  /* ── janela de resposta (devolve o texto, ou null se a pessoa cancelar) ── */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-wrap" id="mw-den-resp">
      <div class="modal" style="width: 560px">
        <div class="modal-hd"><h2 id="dr-titulo">Responder denúncia</h2><button class="modal-x" onclick="cm('den-resp')">✕</button></div>
        <div class="modal-bd">
          <p class="dim" id="dr-aviso" style="margin-bottom:14px;line-height:1.55"></p>
          <div class="mf">
            <label>Respostas prontas <span id="dr-dica" style="text-transform:none;letter-spacing:0;font-weight:500"></span></label>
            <div class="tk-filters" id="dr-chips" style="margin-bottom:10px"></div>
            <textarea id="dr-texto" maxlength="1000" placeholder="Escreva a resposta ao denunciante" style="min-height:130px"></textarea>
            <div class="mm-rasc" id="dr-cont" style="text-align:right"></div>
          </div>
          <div class="err-bar" id="err-dr"></div>
        </div>
        <div class="modal-ft">
          <button class="btn-cancel" onclick="cm('den-resp')">Cancelar</button>
          <button class="btn-save" id="dr-ok">Enviar</button>
        </div>
      </div>
    </div>`);
  const wrapDr = $("mw-den-resp");
  wrapDr.addEventListener("click", (e) => { if (e.target === wrapDr) cm("den-resp"); });

  let dr = null; // { d, status, res }
  const contar = () => { $("dr-cont").textContent = $("dr-texto").value.length + " / 1000"; };
  $("dr-texto").addEventListener("input", contar);

  // Qualquer forma de fechar a janela (botão, X, clique fora, Esc) cancela a ação
  new MutationObserver(() => {
    if (!wrapDr.classList.contains("on") && dr) { const r = dr.res; dr = null; r(null); }
  }).observe(wrapDr, { attributes: true, attributeFilter: ["class"] });

  function chips() {
    if (!dr) return;
    const { d, status } = dr;
    const todos = [
      ...MODELOS.map((x, i) => ({ ...x, k: "p" + i })),
      ...lerCustom().map((x, i) => ({ ...x, k: "c" + i, custom: i })),
    ].filter((x) => x.s === status);
    const sug = (x) => x.m && x.m.includes(d.motivo);
    todos.sort((a, b) => (sug(b) ? 1 : 0) - (sug(a) ? 1 : 0));
    $("dr-dica").textContent = todos.some(sug) ? "(as destacadas combinam com o motivo desta denúncia)" : "";
    $("dr-chips").innerHTML = todos.map((x) => {
      const btn = `<button type="button" class="tk-chip ${sug(x) ? "mm-sel" : ""}" data-m="${esc(x.k)}">${esc(x.t)}</button>`;
      return x.custom != null
        ? `<span class="mm-cm">${btn}<button type="button" class="tk-x" title="Remover modelo" aria-label="Remover modelo" data-rm="${x.custom}">×</button></span>`
        : btn;
    }).join("") + '<button type="button" class="tk-chip" data-salvar="1">+ Salvar como modelo</button>';
  }

  $("dr-chips").addEventListener("click", async (e) => {
    if (!dr) return;
    const b = e.target.closest("button");
    if (!b) return;
    const ta = $("dr-texto");
    if (b.dataset.m) {
      const todos = [...MODELOS, ...lerCustom()];
      const modelo = b.dataset.m[0] === "p" ? MODELOS[Number(b.dataset.m.slice(1))] : lerCustom()[Number(b.dataset.m.slice(1))];
      if (!modelo) return;
      const atual = ta.value.trim();
      if (atual && !todos.some((x) => preencher(x.c, dr.d) === atual)) {
        const ok = window.dlg ? await window.dlg.confirmar({ titulo: "Substituir o texto?", texto: "O texto que você já escreveu será trocado por este modelo.", ok: "Substituir" }) : true;
        if (!ok) return;
      }
      ta.value = preencher(modelo.c, dr.d).slice(0, 1000);
      contar();
      ta.focus();
    } else if (b.dataset.rm != null) {
      const l = lerCustom(), i = Number(b.dataset.rm);
      if (!l[i]) return;
      const ok = window.dlg ? await window.dlg.confirmar({ titulo: `Remover o modelo "${l[i].t}"?`, ok: "Remover", perigo: true }) : true;
      if (!ok) return;
      l.splice(i, 1);
      gravarCustom(l);
      chips();
    } else if (b.dataset.salvar) {
      const texto = ta.value.trim();
      if (!texto) { toast("Escreva o texto antes de salvar como modelo", "err"); return; }
      const l = lerCustom();
      if (l.length >= 12) { toast("Limite de 12 modelos. Remova algum primeiro.", "err"); return; }
      const nome = window.dlg ? await window.dlg.perguntar({ titulo: "Salvar como modelo", rotulo: "Nome do modelo", ok: "Salvar" }) : prompt("Nome do modelo:");
      const nm = String(nome || "").trim().slice(0, 30);
      if (!nm) return;
      let c = texto;
      const alvo = dr.d.alvo_nome, p = primeiro(dr.d.denunciante_nome);
      if (alvo) c = c.split(alvo).join("{alvo}");
      if (p.length >= 3) c = c.split(p).join("{nome}");
      l.push({ s: dr.status, t: nm, c });
      gravarCustom(l);
      chips();
      toast("Modelo salvo", "ok");
    }
  });

  function pedirResposta(d, status) {
    return new Promise((res) => {
      const resolver = status === "resolvida";
      dr = { d, status, res };
      $("dr-titulo").textContent = (resolver ? "Resolver denúncia #" : "Rejeitar denúncia #") + num(d.id);
      $("dr-aviso").textContent = "Esta resposta é enviada por e-mail ao denunciante. Escolha uma resposta pronta e ajuste o texto se precisar.";
      $("dr-ok").textContent = resolver ? "Resolver e enviar" : "Rejeitar e enviar";
      $("dr-texto").value = "";
      hideErr("err-dr");
      contar();
      chips();
      $("dr-ok").onclick = () => {
        const texto = $("dr-texto").value.trim();
        if (texto.length < 5) { showErr("err-dr", "Escreva uma resposta com pelo menos 5 caracteres."); return; }
        const r = dr.res;
        dr = null;
        cm("den-resp");
        r(texto);
      };
      om("den-resp");
      $("dr-texto").focus();
    });
  }

  const achar = (id) => lista.find((x) => String(x.id) === String(id));
  // O texto da busca inclui o rótulo do motivo, não só o código interno
  const texto = (d) => [d.id, d.alvo_nome, d.motivo, motivoTxt(d.motivo), d.descricao, d.denunciante_nome, d.denunciante_email].join(" ").toLowerCase();
  const visiveis = () => {
    const q = $("s-den").value.toLowerCase().trim();
    return lista.filter(FIL[filtro][1]).filter((d) => !q || texto(d).includes(q));
  };

  // Quantas denúncias ABERTAS existem para o mesmo item (inclui a própria)
  const mesmoAlvo = (a, b) => a.tipo_alvo === b.tipo_alvo && String(a.alvo_id) === String(b.alvo_id);
  const abertasDoAlvo = (d) => (d.alvo_id ? lista.filter((x) => aberta(x) && mesmoAlvo(x, d)).length : 0);

  function render() {
    $("c-den").textContent = lista.length + " registros";
    $("den-chips").innerHTML = Object.keys(FIL)
      .map((k) => `<button type="button" class="tk-chip ${filtro === k ? "on" : ""}" data-k="${k}">${FIL[k][0]} <i>${lista.filter(FIL[k][1]).length}</i></button>`).join("");
    const v = visiveis();
    if (!v.some((x) => String(x.id) === String(selId))) selId = v[0] ? v[0].id : null;
    const q = $("s-den").value.trim();
    $("fc-den").textContent = q ? v.length + " resultado" + (v.length !== 1 ? "s" : "") : "";
    const linhas = v.length
      ? v.map((d) => {
          const n = aberta(d) ? abertasDoAlvo(d) : 0;
          const sub = motivoTxt(d.motivo) + (n > 1 ? ` · ${n} denúncias deste item` : "");
          return `<tr class="ev-row ${String(d.id) === String(selId) ? "ev-sel" : ""}" data-id="${num(d.id)}"><td>
          <div class="ev-cell"><div class="ev-dia"><b>#${num(d.id)}</b><span>${esc(rotAlvo(d))}</span></div>
          <div class="ev-nm"><b>${esc(d.alvo_nome || rotAlvo(d) + " #" + (d.alvo_id || "—"))}</b><span>${esc(sub)}</span></div>
          ${pill(stOf(d))}</div></td></tr>`;
        }).join("")
      : '<tr><td><div class="empty">Nenhuma denúncia nesta lista.</div></td></tr>';
    $("tb-den").innerHTML = `<div class="ev-split"><div class="ev-list"><table><tbody>${linhas}</tbody></table></div><aside class="ev-panel" id="den-panel"></aside></div>`;
    pintar();
    const n = lista.filter(aberta).length;
    if ($("nb-den")) $("nb-den").textContent = n;
  }

  function pintar() {
    const p = $("den-panel"), d = achar(selId);
    if (!p) return;
    if (!d) { p.innerHTML = '<div class="empty">Selecione uma denúncia para ver os detalhes.</div>'; return; }
    const ap = aberta(d), id = num(d.id);
    const n = ap ? abertasDoAlvo(d) : 0;
    const btns = ap
      ? (stOf(d) === "pendente" ? `<button class="btn-cancel" data-a="em_analise">Em análise</button>` : "") +
        `<button class="btn-cancel ev-no" data-a="rejeitada">Rejeitar</button><button class="btn-save" data-a="resolvida">Resolver</button>`
      : "";
    p.innerHTML = `
      <div class="ev-ph"><div><b class="ev-t">${esc(d.alvo_nome || rotAlvo(d) + " #" + (d.alvo_id || "—"))}</b><div class="ev-sub">Denúncia #${id} · ${esc(rotAlvo(d))}</div></div>${pill(stOf(d))}</div>
      ${n > 1 ? `<div class="ev-av"><span class="pill p-rd">${n} denúncias abertas deste ${esc(rotAlvo(d).toLowerCase())}</span></div>` : ""}
      <div class="ev-kvs">
        ${kv("Motivo", dado(motivoTxt(d.motivo)))}
        ${kv("Denunciante", dado([d.denunciante_nome, d.denunciante_email ? "(" + d.denunciante_email + ")" : ""].filter(Boolean).join(" ")))}
        ${kv("Enviada em", d.criado_em ? esc(fmtDH(d.criado_em)) : "—")}
        ${d.analisado_por_nome ? kv("Analisada por", esc(d.analisado_por_nome)) : ""}
        ${d.respondido_em ? kv("Respondida em", esc(fmtDH(d.respondido_em))) : ""}
      </div>
      <div class="ev-lbl">Detalhes da denúncia</div>
      <div class="ev-desc">${d.descricao && String(d.descricao).trim() ? esc(d.descricao) : "Sem descrição"}</div>
      ${d.resposta ? `<div class="ev-lbl" style="margin-top:14px;color:var(--green)">✔ Resposta da equipe</div><div class="mmsg-reply-responded">${esc(d.resposta)}</div>` : ""}
      ${btns ? `<div class="ev-acts">${btns}</div>` : ""}
      <div class="ev-mais">
        ${d.alvo_id ? `<button type="button" data-a="ver">Ver ${esc(rotAlvo(d).toLowerCase())}</button><span>·</span><button type="button" data-a="bloquear">Bloquear ${esc(rotAlvo(d).toLowerCase())}</button>` : ""}
      </div>`;
  }

  async function mudar(status) {
    const d = achar(selId);
    if (!d || ocupado) return;
    let resposta = "";
    if (status !== "em_analise") {
      const r = await pedirResposta(d, status);
      if (r === null) return;
      resposta = r;
    }
    ocupado = true;
    try {
      const r = await fetch(`${API}/admin/denuncias/${num(d.id)}/status`, { method: "PUT", headers: H(), body: JSON.stringify({ status, resposta }) });
      if (r.status === 401) { logout(); return; }
      let j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) { toast(j.erro || "Erro ao atualizar a denúncia", "err"); return; }
      if (j.email_enviado === false) toast("Denúncia atualizada, mas não foi possível avisar o denunciante por e-mail", "err");
      else if (j.email_enviado === true) toast("Denúncia atualizada e denunciante avisado por e-mail", "ok");
      else toast("Denúncia atualizada", "ok");
      await carregar(true);
    } catch (e) { toast("Não foi possível conectar ao servidor", "err"); }
    finally { ocupado = false; }
  }

  async function carregar(silencioso) {
    hideErr("err-den");
    if (!silencioso) $("tb-den").innerHTML = '<div class="loading"><div class="spin"></div>carregando...</div>';
    try {
      const d = await api("denuncias");
      lista = Array.isArray(d) ? d : [];
      lista.sort((a, b) => (aberta(b) ? 1 : 0) - (aberta(a) ? 1 : 0) || new Date(b.criado_em) - new Date(a.criado_em));
      render();
    } catch (e) {
      showErr("err-den", "Erro: " + e.message);
      $("tb-den").innerHTML = '<div class="empty">Falha ao carregar.</div>';
    }
  }

  // O aviso de "evento com vendas" depende de cache.ev; vindo da denúncia ele pode estar vazio
  async function garantirCache(ep, id) {
    if (ep !== "eventos" || byId(cache.ev, id)) return;
    try { cache.ev = await api("eventos"); } catch (e) {}
  }

  $("tb-den").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]");
    if (b) {
      const a = b.dataset.a, d = achar(selId);
      if (a === "ver" && d) verCadastro(epOf(d), num(d.alvo_id));
      else if (a === "bloquear" && d) {
        await garantirCache(epOf(d), num(d.alvo_id));
        setStatus(epOf(d), num(d.alvo_id), "bloqueado", () => carregar(true));
      } else mudar(a);
      return;
    }
    const r = e.target.closest(".ev-row");
    if (r) { selId = r.dataset.id; render(); }
  });
  $("den-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (b) { filtro = b.dataset.k; render(); }
  });
  $("s-den").addEventListener("input", render);

  // contador do menu (conta só as abertas)
  async function contarAbertas() {
    try {
      const d = await api("denuncias");
      if (Array.isArray(d) && $("nb-den")) $("nb-den").textContent = d.filter(aberta).length;
    } catch (e) { if ($("nb-den")) $("nb-den").textContent = "—"; }
  }

  const baseGo = go;
  go = function (p, el_) { baseGo(p, el_); if (p === "denuncias") carregar(); };
  const baseLoad = loadDash;
  loadDash = async function () { await baseLoad(); contarAbertas(); };
  if (token) contarAbertas();
})();