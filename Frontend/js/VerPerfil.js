// Frontend/js/VerPerfil.js — busca os dados reais do organizador (usuario) e preenche a tela

let organizadorAtualId = null;

// Garante que a API_BASE esteja definida corretamente
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = window.API_BASE || (isLocal ? "http://localhost:3000" : window.location.origin);

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const organizadorId = params.get("id") || params.get("organizadorId");

  const meuIdLogado = pegarIdDoToken();

  // IMPORTANTE: esta página mostra o perfil de UM ORGANIZADOR ESPECÍFICO,
  // identificado pelo parâmetro ?id= na URL. Ela NUNCA deve usar o id do
  // usuário logado como fallback — antes isso fazia a página exibir o
  // perfil de quem estava logado sempre que o link chegava sem ?id=
  // (por exemplo, quando a API de detalhes do evento não retornava o id
  // do organizador). Se não houver id na URL, mostramos um erro em vez
  // de adivinhar de quem é o perfil.
  if (!organizadorId) {
    console.error(
      "VerPerfil.html foi aberta sem o parâmetro ?id= (ou ?organizadorId=) na URL. " +
      "Não é possível saber de qual organizador mostrar o perfil."
    );
    mostrarErroPerfilNaoIdentificado();
    return;
  }

  organizadorAtualId = organizadorId;

  // Esconde o botão de seguir se o usuário estiver vendo o próprio perfil
  tratarBotaoSeguirProprioPerfil(organizadorId, meuIdLogado);

  carregarPerfil(organizadorId);
  configurarAbas();
});

function mostrarErroPerfilNaoIdentificado() {
  const elNome = document.getElementById("nome-organizador");
  if (elNome) elNome.textContent = "Organizador não encontrado";

  const elDesc = document.getElementById("descricao-organizador");
  if (elDesc) {
    elDesc.textContent =
      "Não foi possível identificar este organizador. Volte para a página do evento e tente novamente.";
  }

  const btnSeguir = document.getElementById("btn-seguir");
  if (btnSeguir) btnSeguir.style.display = "none";
}

/* ═══════════════════════════════════════════
   DECODIFICADOR DO TOKEN JWT
═══════════════════════════════════════════ */
function pegarIdDoToken() {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("jwt");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    return payload?.id || payload?.userId || payload?.user_id || payload?.sub || null;
  } catch (err) {
    console.error("Erro ao decodificar token:", err);
    return null;
  }
}

/* ═══════════════════════════════════════════
   TRATAMENTO DE PERFIL PRÓPRIO
═══════════════════════════════════════════ */
function tratarBotaoSeguirProprioPerfil(perfilId, logadoId) {
  const btnSeguir = document.getElementById("btn-seguir");
  if (!btnSeguir) return;

  if (logadoId && String(perfilId) === String(logadoId)) {
    btnSeguir.style.display = "none";
  } else {
    btnSeguir.style.display = "inline-flex";
  }
}

/* ═══════════════════════════════════════════
   CARREGAR DADOS DO PERFIL (COM FALLBACKS)
═══════════════════════════════════════════ */
async function carregarPerfil(id) {
  try {
    // Lista de possíveis endpoints do seu backend para evitar erros de rotas no plural/singular/prefixo API
    const rotasParaTestar = [
      `${BASE_URL}/usuarios/${id}/perfil`,
      `${BASE_URL}/usuarios/${id}`,
      `${BASE_URL}/api/usuarios/${id}/perfil`,
      `${BASE_URL}/api/usuarios/${id}`,
      `${BASE_URL}/usuario/${id}`
    ];

    let resp = null;
    for (const url of rotasParaTestar) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resp = res;
          break;
        }
      } catch (e) {
        // ignora o erro e tenta a próxima rota da lista
      }
    }

    if (!resp) throw new Error("Não foi possível localizar as informações do usuário nas rotas da API.");

    const dados = await resp.json();

    preencherCabecalho(dados);
    preencherEstatisticas(dados);
    preencherContato(dados);
    preencherEventosProximos(dados.eventos_proximos || []);
    preencherEventosPassados(dados.eventos_passados || []);
    preencherAvaliacoes(dados);

    const meuId = pegarIdDoToken();
    if (meuId && String(id) !== String(meuId)) {
      await verificarSeSegue(id);
    }
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
    const elNome = document.getElementById("nome-organizador");
    if (elNome) elNome.textContent = "Erro ao carregar perfil";
  }
}

function formatarNumero(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

/* ═══════════════════════════════════════════
   PREENCHIMENTO DE DADOS NA TELA
═══════════════════════════════════════════ */
function preencherCabecalho(dados) {
  const nomeCompleto = dados.nome_completo || [dados.nome, dados.sobrenome].filter(Boolean).join(" ");

  const elNome = document.getElementById("nome-organizador");
  if (elNome) elNome.textContent = nomeCompleto || "Organizador";

  const elDesc = document.getElementById("descricao-organizador");
  if (elDesc) elDesc.textContent = dados.bio || dados.descricao || "Este organizador ainda não adicionou uma descrição.";

  if (dados.foto_perfil || dados.avatar) {
    const elAvatar = document.getElementById("avatar-organizador");
    if (elAvatar) elAvatar.src = dados.foto_perfil || dados.avatar;
  }

  const elAval = document.getElementById("avaliacao-perfil");
  if (elAval) elAval.textContent = dados.avaliacao_media ? Number(dados.avaliacao_media).toFixed(1) : "0.0";

  const elEvRealizados = document.getElementById("eventos-realizados");
  if (elEvRealizados) elEvRealizados.textContent = formatarNumero(dados.total_eventos);

  const elPart = document.getElementById("participantes-totais");
  if (elPart) elPart.textContent = formatarNumero(dados.participantes_totais);
}

function preencherEstatisticas(dados) {
  const elSeg = document.getElementById("seguidores");
  if (elSeg) elSeg.textContent = formatarNumero(dados.seguidores_totais || dados.seguidores);

  const elAtivos = document.getElementById("eventos-ativos");
  if (elAtivos) elAtivos.textContent = formatarNumero(dados.eventos_ativos);

  const elTotal = document.getElementById("total-eventos-estatistica");
  if (elTotal) elTotal.textContent = formatarNumero(dados.total_eventos);

  const criadoEm = dados.criado_em || dados.created_at || dados.data_cadastro;
  if (criadoEm) {
    const data = new Date(criadoEm);
    const mes = data.toLocaleString("pt-BR", { month: "long" });
    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
    const elMembro = document.getElementById("membro-desde");
    if (elMembro) elMembro.textContent = `${mesCapitalizado} de ${data.getFullYear()}`;
  }

  const badgeProximos = document.querySelector('[data-tab="proximos-eventos"] .aba-badge');
  const badgePassados = document.querySelector('[data-tab="eventos-passados"] .aba-badge');
  if (badgeProximos) badgeProximos.textContent = formatarNumero(dados.eventos_ativos);
  if (badgePassados) {
    const passados = (dados.total_eventos || 0) - (dados.eventos_ativos || 0);
    badgePassados.textContent = formatarNumero(passados < 0 ? 0 : passados);
  }
}

function preencherContato(dados) {
  const elTel = document.getElementById("telefone-contato");
  const elEmail = document.getElementById("email-contato");
  if (elTel) elTel.textContent = dados.telefone || "Não informado";
  if (elEmail) elEmail.textContent = dados.email || "Não informado";
}

function preencherEventosProximos(eventos) {
  const container = document.getElementById("proximos-eventos");
  if (!container) return;
  if (!eventos.length) {
    container.innerHTML = `<p class="sem-dados">Nenhum evento próximo no momento.</p>`;
    return;
  }

  container.innerHTML = eventos.map(ev => `
    <div class="evento-proximo-card">
      <img src="${ev.imagem ? (ev.imagem.startsWith('http') ? ev.imagem : BASE_URL + ev.imagem) : '/frontend/imagens/placeholder.png'}" alt="${ev.nome}">
      <div class="ep-info">
        <span class="ep-badge">Em breve</span>
        <h3>${ev.nome}</h3>
        <p class="ep-meta"><i class="fa-regular fa-calendar"></i> ${formatarData(ev.data_inicio)}</p>
        <p class="ep-meta"><i class="fa-solid fa-location-dot"></i> ${ev.local_nome || ev.cidade || ""}</p>
      </div>
      <button class="btn-ver-detalhes" onclick="window.location.href='/frontend/detalheseventos/detalheevento.html?id=${ev.id}'">
        Ver detalhes <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  `).join("");
}

function preencherEventosPassados(eventos) {
  const container = document.getElementById("eventos-passados");
  if (!container) return;
  if (!eventos.length) {
    container.innerHTML = `<p class="sem-dados">Nenhum evento realizado ainda.</p>`;
    return;
  }

  container.innerHTML = eventos.map(ev => `
    <div class="evento-passado-card">
      <div class="ep-icone"><i class="fa-solid fa-calendar-check"></i></div>
      <div class="ep-texto">
        <h4>${ev.nome}</h4>
        <p><i class="fa-regular fa-calendar"></i> ${formatarData(ev.data_fim || ev.data_inicio)}</p>
      </div>
    </div>
  `).join("");
}

function preencherAvaliacoes(dados) {
  const media = Number(dados.avaliacao_media || 0);
  const total = Number(dados.avaliacao_total || 0);
  const distribuicao = dados.avaliacoes_distribuicao || [];
  const lista = dados.avaliacoes_lista || [];

  const notaNumEl = document.querySelector(".nota-num");
  if (notaNumEl) notaNumEl.textContent = media.toFixed(1);

  const smallEl = document.querySelector(".nota-grande small");
  if (smallEl) smallEl.textContent = `Baseado em ${formatarNumero(total)} avaliações`;

  const contagemPorNota = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribuicao.forEach(d => { contagemPorNota[d.nota] = parseInt(d.total, 10); });

  const linhas = document.querySelectorAll(".barra-linha");
  linhas.forEach(linha => {
    const estrela = linha.querySelector("span")?.textContent.trim();
    const notaNum = parseInt(estrela, 10);
    const qtd = contagemPorNota[notaNum] || 0;
    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;

    const fill = linha.querySelector(".barra-fill");
    const label = linha.querySelectorAll("span")[1];
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;
  });

  const listaEl = document.getElementById("lista-avaliacoes");
  if (!listaEl) return;

  if (!lista.length) {
    listaEl.innerHTML = `<p class="sem-dados">Ainda não há avaliações para este organizador.</p>`;
    return;
  }

  listaEl.innerHTML = lista.map(av => {
    const inicial = (av.nome_autor || "?").charAt(0).toUpperCase();
    const estrelas = "★".repeat(av.nota || 5) + "☆".repeat(5 - (av.nota || 5));
    const data = av.created_at ? formatarData(av.created_at) : "";
    return `
      <div class="cartao-avaliacao">
        <div class="avaliacao-topo">
          <div class="avaliador-inicial">${inicial}</div>
          <div class="avaliador-info">
            <strong>${av.nome_autor || "Anônimo"}</strong>
            <span>${data}</span>
          </div>
          <div class="avaliacao-estrelas">${estrelas}</div>
        </div>
        <p>${av.comentario || ""}</p>
      </div>
    `;
  }).join("");
}

function formatarData(dataStr) {
  if (!dataStr) return "";
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) {
      const [data] = dataStr.split(" ");
      const [ano, mes, dia] = data.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    return d.toLocaleDateString("pt-BR");
  } catch (_) {
    return dataStr;
  }
}

/* ═══════════════════════════════════════════
   SISTEMA DE SEGUIR / UNFOLLOW
═══════════════════════════════════════════ */
async function verificarSeSegue(id) {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("jwt");
  if (!token) return;

  try {
    const resp = await fetch(`${BASE_URL}/usuarios/${id}/seguindo`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) return;
    const { seguindo } = await resp.json();
    atualizarBotaoSeguir(seguindo);
  } catch (err) {
    console.error("Erro ao verificar status de seguir:", err);
  }
}

function atualizarBotaoSeguir(seguindo) {
  const btn = document.getElementById("btn-seguir");
  if (!btn) return;
  btn.dataset.seguindo = seguindo ? "true" : "false";
  btn.innerHTML = seguindo
    ? `<i class="fa-solid fa-check"></i> Seguindo`
    : `<i class="fa-solid fa-plus"></i> Seguir`;
  btn.classList.toggle("seguindo", seguindo);
}

async function toggleSeguir(btn) {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("jwt");
  if (!token) {
    alert("Você precisa estar logado para seguir um organizador.");
    return;
  }

  const id = organizadorAtualId;
  const meuId = pegarIdDoToken();

  if (meuId && String(id) === String(meuId)) {
    alert("Você não pode seguir a si mesmo.");
    return;
  }

  try {
    const resp = await fetch(`${BASE_URL}/usuarios/${id}/seguir`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const erroJson = await resp.json().catch(() => ({}));
      throw new Error(erroJson.erro || "Erro ao seguir");
    }
    const { seguindo } = await resp.json();
    atualizarBotaoSeguir(seguindo);

    const seguidoresEl = document.getElementById("seguidores");
    if (seguidoresEl) {
      const atual = parseInt(seguidoresEl.textContent.replace(/\D/g, ""), 10) || 0;
      seguidoresEl.textContent = formatarNumero(seguindo ? atual + 1 : (atual > 0 ? atual - 1 : 0));
    }
  } catch (err) {
    console.error("Erro ao seguir/deixar de seguir:", err);
    alert(err.message || "Não foi possível processar sua ação agora.");
  }
}

/* ═══════════════════════════════════════════
   CONTROLE DE ABAS E INTERAÇÕES
═══════════════════════════════════════════ */
function configurarAbas() {
  const botoes = document.querySelectorAll(".js-tab-button");
  botoes.forEach(botao => {
    botao.addEventListener("click", () => {
      document.querySelectorAll(".js-tab-button").forEach(b => b.classList.remove("ativo"));
      document.querySelectorAll(".painel-aba").forEach(p => p.classList.remove("ativo"));

      botao.classList.add("ativo");
      const alvo = document.getElementById(botao.dataset.tab);
      if (alvo) alvo.classList.add("ativo");
    });
  });
}

function enviarAvaliacao() {
  alert("Funcionalidade de avaliação em desenvolvimento.");
}

function compartilhar(tipo) {
  const url = window.location.href;
  if (tipo === "copy") {
    navigator.clipboard.writeText(url);
    alert("Link copiado!");
  } else if (tipo === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank");
  }
}