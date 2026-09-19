// Frontend/js/VerPerfil.js

const isLocalPerfil = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE_PERFIL = isLocalPerfil ? "http://localhost:3000" : window.location.origin;

// Mock temporário — usado apenas enquanto não existir uma tabela real de organizadores no backend.
// Assim que houver uma rota tipo GET /organizadores/:id, este objeto pode ser removido.
const DADOS_PERFIS = {
  'Produtora Ji & Cia': {
    descricao: 'Especializada em jazz, blues e eventos culturais ao ar livre. Qualidade e boa música em Goiânia.',
    avaliacao: '4.9', eventosRealizados: '42', participantes: '7.850',
    seguidores: '1.500', eventosAtivos: '5', membroDesde: 'Março de 2021',
    email: 'contato@produtorajiecia.com', telefone: '(62) 99123-4567',
    avatar: '/frontend/imagens/logo3.png'
  },
  'Drinks & Beer': {
    descricao: 'O melhor do happy hour na T-63! Chopps, drinks e música ambiente toda semana.',
    avaliacao: '4.7', eventosRealizados: '15', participantes: '2.500',
    seguidores: '950', eventosAtivos: '3', membroDesde: 'Outubro de 2022',
    email: 'contato@drinksandbeer.com.br', telefone: '(62) 98888-7777',
    avatar: '/frontend/imagens/logo3.png'
  },
  'Eventos Goiânia Premium': {
    descricao: 'Especialistas em criar experiências únicas em Goiânia. Mais de 5 anos de mercado e centenas de eventos inesquecíveis.',
    avaliacao: '4.9', eventosRealizados: '127', participantes: '15.420',
    seguidores: '2.340', eventosAtivos: '8', membroDesde: 'Janeiro de 2020',
    email: 'contato@eventosgp.com.br', telefone: '(62) 98765-4321',
    avatar: '/frontend/imagens/logo3.png'
  }
};

// Perfil neutro exibido quando não há nem id nem nome na URL, e o nome também
// não bate com nada do mock. Evita mostrar dados de outro organizador por engano.
const PERFIL_PADRAO = {
  descricao: 'Organizador ainda não configurou uma descrição.',
  avaliacao: '—', eventosRealizados: '0', participantes: '0',
  seguidores: '0', eventosAtivos: '0', membroDesde: '—',
  email: '—', telefone: '—',
  avatar: '/frontend/imagens/logo3.png'
};

function preencherPerfil(nomeExibido, d) {
  document.getElementById('nome-organizador').textContent          = nomeExibido;
  document.getElementById('descricao-organizador').textContent     = d.descricao;
  document.getElementById('avatar-organizador').src                = d.avatar;
  document.getElementById('avaliacao-perfil').textContent          = d.avaliacao;
  document.getElementById('eventos-realizados').textContent        = d.eventosRealizados;
  document.getElementById('participantes-totais').textContent      = d.participantes;
  document.getElementById('seguidores').textContent                = d.seguidores;
  document.getElementById('eventos-ativos').textContent            = d.eventosAtivos;
  document.getElementById('total-eventos-estatistica').textContent = d.eventosRealizados;
  document.getElementById('membro-desde').textContent              = d.membroDesde;
  document.getElementById('email-contato').textContent             = d.email;
  document.getElementById('telefone-contato').textContent          = d.telefone;
}

// O "organizador" é, na verdade, o usuário que criou o evento — não existe uma
// tabela separada de organizadores. Por isso buscamos em /usuarios/:id.
// ⚠️ Confirme o prefixo real de montagem da rota no seu app.js/server.js
//    (assumindo aqui app.use("/usuarios", usuariosRoutes)).
function formatarMembroDesde(criadoEm) {
  if (!criadoEm) return PERFIL_PADRAO.membroDesde;
  const d = new Date(criadoEm);
  if (isNaN(d)) return PERFIL_PADRAO.membroDesde;
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

async function buscarOrganizadorPorId(id) {
  try {
    const res = await fetch(`${API_BASE_PERFIL}/usuarios/${id}`);
    if (!res.ok) return null; // ex: 404 se o usuário não existir
    const usuario = await res.json();

    const nomeCompleto = [usuario.nome_completo, usuario.sobrenome]
      .filter(Boolean)
      .join(' ') || 'Organizador';

    return {
      nome: nomeCompleto,
      dados: {
        // Campos que existem na tabela `usuarios`:
        descricao: PERFIL_PADRAO.descricao, // usuarios não tem bio/descrição ainda
        membroDesde: formatarMembroDesde(usuario.criado_em),
        email: usuario.email || PERFIL_PADRAO.email,
        telefone: usuario.telefone || PERFIL_PADRAO.telefone,
        avatar: usuario.foto_perfil
          ? (usuario.foto_perfil.startsWith('http') ? usuario.foto_perfil : `${API_BASE_PERFIL}${usuario.foto_perfil}`)
          : PERFIL_PADRAO.avatar,

        // Estes campos NÃO existem na tabela `usuarios` — são estatísticas de
        // organizador (deveriam vir de uma consulta agregada em `eventos`/`avaliacoes`
        // filtrando por usuario_id). Por enquanto ficam como placeholder.
        avaliacao: PERFIL_PADRAO.avaliacao,
        eventosRealizados: PERFIL_PADRAO.eventosRealizados,
        participantes: PERFIL_PADRAO.participantes,
        seguidores: PERFIL_PADRAO.seguidores,
        eventosAtivos: PERFIL_PADRAO.eventosAtivos
      }
    };
  } catch (err) {
    console.warn('Não foi possível buscar usuário/organizador na API (usando fallback):', err);
    return null;
  }
}

// ── Impede seguir/mandar mensagem para o próprio perfil ────────────────
function ajustarAcoesSeForProprioPerfil(idPerfilVisitado) {
  const userIdLogado = localStorage.getItem('userId');
  const ehProprioPerfil = userIdLogado && idPerfilVisitado && String(userIdLogado) === String(idPerfilVisitado);

  const btnSeguir   = document.getElementById('btn-seguir');
  const btnMensagem = document.querySelector('.btn-mensagem');

  if (!ehProprioPerfil) return;

  if (btnSeguir) {
    btnSeguir.disabled = true;
    btnSeguir.classList.add('desativado');
    btnSeguir.innerHTML = '<i class="fa-solid fa-user"></i> Seu perfil';
    btnSeguir.onclick = null; // remove o toggleSeguir
  }
  if (btnMensagem) {
    btnMensagem.disabled = true;
    btnMensagem.classList.add('desativado');
    btnMensagem.onclick = null;
  }

  const formAvaliacao = document.querySelector('.form-avaliacao');
  if (formAvaliacao) {
    formAvaliacao.innerHTML = '<p class="sem-dados">Você não pode avaliar o seu próprio perfil.</p>';
  }
}

// ── Carregar dados do perfil ──────────────────────────
async function carregarPerfilOrganizador() {
  const params = new URLSearchParams(window.location.search);
  const id   = params.get('id');
  const nome = params.get('nome') ? decodeURIComponent(params.get('nome')) : null;

  // 1) Se veio um ID, tenta buscar o organizador real no backend.
  if (id) {
    ajustarAcoesSeForProprioPerfil(id);
    const resultado = await buscarOrganizadorPorId(id);
    if (resultado) {
      preencherPerfil(resultado.nome, resultado.dados);
      // Eventos e avaliações dependem do usuario_id — só dá pra buscar
      // quando o perfil veio por ID de verdade (não pelo fallback de nome).
      carregarEventosEAvaliacoesOrganizador(id);
      carregarStatusSeguidor(id);
      return;
    }
    // Se a API ainda não tiver essa rota, cai para o próximo caso (nome, se houver).
  }

  // 2) Se veio um nome (fallback atual, enquanto não há tabela de organizadores),
  //    procura no mock local.
  if (nome && DADOS_PERFIS[nome]) {
    preencherPerfil(nome, DADOS_PERFIS[nome]);
    return;
  }

  // 3) Nada bateu: mostra o nome recebido (se houver) com dados padrão,
  //    em vez de forçar um organizador fixo que não tem nada a ver com o evento.
  preencherPerfil(nome || 'Organizador não encontrado', PERFIL_PADRAO);
}

/* ═══════════════════════════════════════════════════════
   EVENTOS E AVALIAÇÕES REAIS DO ORGANIZADOR
   Usa GET /eventos?criador_id=X (todos os eventos do usuário,
   passados e futuros) e GET /avaliacoes?evento_id=X (avaliações
   de cada evento). Não existe uma "nota do organizador" pronta
   no backend, então ela é calculada aqui juntando as avaliações
   de todos os eventos dele.
═══════════════════════════════════════════════════════ */

function formatarDataEvento(dataInicio) {
  if (!dataInicio) return { dataFormatada: '-', horaFormatada: '-' };
  const [ano, mes, dia] = dataInicio.substring(0, 10).split('-');
  const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  return {
    dataFormatada: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    horaFormatada: dataInicio.substring(11, 16)
  };
}

function setTextoSeExistir(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

async function carregarEventosEAvaliacoesOrganizador(usuarioId) {
  const containerProximos = document.getElementById('proximos-eventos');
  const containerPassados = document.getElementById('eventos-passados');

  try {
    const [resEventos, resAvaliacoesOrganizador] = await Promise.all([
      fetch(`${API_BASE_PERFIL}/eventos?criador_id=${usuarioId}`),
      fetch(`${API_BASE_PERFIL}/avaliacoes?organizador_id=${usuarioId}`)
    ]);

    if (!resEventos.ok) throw new Error('Falha ao buscar eventos do organizador.');
    const eventos = await resEventos.json();

    // Avaliações feitas diretamente ao organizador (não amarradas a um evento).
    const avaliacoesDiretas = resAvaliacoesOrganizador.ok ? await resAvaliacoesOrganizador.json() : [];

    // Avaliações de cada evento individual (pra nota "por evento" nos cards passados).
    const avaliacoesPorEvento = await Promise.all(
      eventos.map(async (ev) => {
        try {
          const r = await fetch(`${API_BASE_PERFIL}/avaliacoes?evento_id=${ev.id}`);
          if (!r.ok) return [];
          const lista = await r.json();
          return Array.isArray(lista) ? lista : [];
        } catch {
          return [];
        }
      })
    );

    renderizarEventosOrganizador(eventos, avaliacoesPorEvento);
    renderizarAvaliacoesOrganizador(eventos, avaliacoesPorEvento, avaliacoesDiretas);

  } catch (err) {
    console.warn('Não foi possível carregar eventos/avaliações reais do organizador:', err);
    const msgErro = '<p class="sem-dados">Não foi possível carregar os dados. Tente novamente mais tarde.</p>';
    if (containerProximos) containerProximos.innerHTML = msgErro;
    if (containerPassados) containerPassados.innerHTML = msgErro;

    const listaAvaliacoes = document.getElementById('lista-avaliacoes');
    if (listaAvaliacoes) listaAvaliacoes.innerHTML = msgErro;
  }
}

function renderizarEventosOrganizador(eventos, avaliacoesPorEvento) {
  const agora = new Date();
  const proximos = [];
  const passados = [];

  eventos.forEach((ev, i) => {
    const dataEvento = ev.data_inicio ? new Date(ev.data_inicio) : null;
    const alvo = (dataEvento && dataEvento >= agora) ? proximos : passados;
    alvo.push({ evento: ev, avaliacoes: avaliacoesPorEvento[i] || [] });
  });

  proximos.sort((a, b) => new Date(a.evento.data_inicio) - new Date(b.evento.data_inicio));
  passados.sort((a, b) => new Date(b.evento.data_inicio) - new Date(a.evento.data_inicio));

  // Badges das abas (ordem no HTML: Próximos, Passados)
  const badges = document.querySelectorAll('.aba-badge');
  if (badges[0]) badges[0].textContent = proximos.length;
  if (badges[1]) badges[1].textContent = passados.length;

  // Cards — Próximos
  const containerProximos = document.getElementById('proximos-eventos');
  if (containerProximos) {
    containerProximos.innerHTML = proximos.length
      ? proximos.map(({ evento }) => cardEventoProximoHTML(evento)).join('')
      : '<p class="sem-dados">Nenhum evento futuro cadastrado.</p>';
  }

  // Cards — Passados
  const containerPassados = document.getElementById('eventos-passados');
  if (containerPassados) {
    containerPassados.innerHTML = passados.length
      ? passados.map(({ evento, avaliacoes }) => cardEventoPassadoHTML(evento, avaliacoes)).join('')
      : '<p class="sem-dados">Nenhum evento anterior.</p>';
  }

  // Estatísticas do topo (chip de eventos, sidebar, etc.)
  const totalEventos = eventos.length;
  const totalParticipantes = eventos.reduce((acc, ev) => acc + (parseInt(ev.confirmados) || 0), 0);

  setTextoSeExistir('eventos-realizados', totalEventos);
  setTextoSeExistir('total-eventos-estatistica', totalEventos);
  setTextoSeExistir('participantes-totais', totalParticipantes.toLocaleString('pt-BR'));
  setTextoSeExistir('eventos-ativos', proximos.length);
}

function cardEventoProximoHTML(ev) {
  const { dataFormatada, horaFormatada } = formatarDataEvento(ev.data_inicio);
  const preco = parseFloat(ev.preco_minimo) || 0;
  const precoTexto = preco > 0 ? `R$ ${preco.toFixed(2).replace('.', ',')}` : 'Grátis';
  const imgUrl = ev.imagem
    ? (ev.imagem.startsWith('http') ? ev.imagem : `${API_BASE_PERFIL}${ev.imagem}`)
    : '/frontend/imagens/logo3.png';
  const local = [ev.local_nome, ev.cidade].filter(Boolean).join(', ');

  return `
    <div class="evento-proximo-card">
      <img src="${imgUrl}" alt="${ev.nome}">
      <div class="ep-info">
        <span class="ep-badge">Em breve</span>
        <h3>${ev.nome}</h3>
        <p class="ep-meta"><i class="fa-regular fa-calendar"></i> ${dataFormatada} · <i class="fa-regular fa-clock"></i> ${horaFormatada}</p>
        <p class="ep-meta"><i class="fa-solid fa-location-dot"></i> ${local || 'Local não informado'}</p>
        <div class="ep-footer">
          <span class="ep-confirmados"><i class="fa-solid fa-circle-check"></i> ${ev.confirmados || 0} confirmados</span>
          <strong class="ep-preco">${precoTexto}</strong>
        </div>
      </div>
      <button class="btn-ver-detalhes" onclick="window.location.href='/frontend/detalheseventos/detalheevento.html?id=${ev.id}'">
        Ver detalhes <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>`;
}

function cardEventoPassadoHTML(ev, avaliacoes) {
  const { dataFormatada } = formatarDataEvento(ev.data_inicio);
  const mediaEvento = avaliacoes.length
    ? (avaliacoes.reduce((acc, a) => acc + Number(a.nota), 0) / avaliacoes.length)
    : null;
  const notaHTML = mediaEvento !== null
    ? `<div class="ep-nota${mediaEvento >= 5 ? ' perfeita' : ''}"><i class="fa-solid fa-star"></i> ${mediaEvento.toFixed(1)}</div>`
    : `<div class="ep-nota">— avaliações</div>`;

  return `
    <div class="evento-passado-card">
      <div class="ep-icone"><i class="fa-solid fa-calendar-check"></i></div>
      <div class="ep-texto">
        <h4>${ev.nome}</h4>
        <p><i class="fa-regular fa-calendar"></i> ${dataFormatada} · <i class="fa-solid fa-users"></i> ${ev.confirmados || 0} participantes</p>
      </div>
      ${notaHTML}
    </div>`;
}

function estrelasHTMLPerfil(nota) {
  const cheias = Math.round(nota);
  return '★'.repeat(cheias) + '☆'.repeat(5 - cheias);
}

function renderizarAvaliacoesOrganizador(eventos, avaliacoesPorEvento, avaliacoesDiretas) {
  // Junta: (a) avaliações feitas diretamente ao organizador e (b) avaliações
  // de cada evento dele, guardando o nome do evento pra dar contexto às de (b).
  const todas = [...avaliacoesDiretas.map(a => ({ ...a, _eventoNome: null }))];
  eventos.forEach((ev, i) => {
    (avaliacoesPorEvento[i] || []).forEach(a => todas.push({ ...a, _eventoNome: ev.nome }));
  });

  // Ordena as mais recentes primeiro
  todas.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const total = todas.length;
  const media = total ? (todas.reduce((acc, a) => acc + Number(a.nota), 0) / total) : 0;

  // Header chip "avaliação" e resumo grande da aba Avaliações
  setTextoSeExistir('avaliacao-perfil', total ? media.toFixed(1) : '—');

  const notaNumEl   = document.querySelector('.nota-num');
  const estrelasEl  = document.querySelector('.estrelas-grandes');
  const baseadoEmEl = document.querySelector('.avaliacoes-resumo small');
  if (notaNumEl)   notaNumEl.textContent  = total ? media.toFixed(1) : '—';
  if (estrelasEl)  estrelasEl.textContent = total ? estrelasHTMLPerfil(media) : '☆☆☆☆☆';
  if (baseadoEmEl) baseadoEmEl.textContent = `Baseado em ${total} avaliaç${total === 1 ? 'ão' : 'ões'}`;

  // Distribuição por estrela (barras 5★ a 1★)
  const contagem = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  todas.forEach(a => {
    const n = Math.round(Number(a.nota));
    if (contagem[n] !== undefined) contagem[n]++;
  });

  const barras = document.querySelectorAll('.barra-linha'); // ordem no HTML: 5,4,3,2,1
  const ordemEstrelas = [5, 4, 3, 2, 1];
  barras.forEach((linha, idx) => {
    const estrela = ordemEstrelas[idx];
    const qtd = contagem[estrela] || 0;
    const pct = total ? Math.round((qtd / total) * 100) : 0;
    const fill = linha.querySelector('.barra-fill');
    const spans = linha.querySelectorAll('span');
    if (fill) fill.style.width = `${pct}%`;
    if (spans[1]) spans[1].textContent = `${pct}%`;
  });

  // Lista de avaliações individuais
  const lista = document.getElementById('lista-avaliacoes');
  if (!lista) return;

  if (!total) {
    lista.innerHTML = '<p class="sem-dados">Este organizador ainda não recebeu avaliações.</p>';
    return;
  }

  lista.innerHTML = todas.map(a => {
    const nome = a.nome_autor || 'Anônimo';
    const inicial = nome[0]?.toUpperCase() || '?';
    const data = a.created_at
      ? new Date(a.created_at).toLocaleDateString('pt-BR')
      : '';
    return `
      <div class="cartao-avaliacao">
        <div class="avaliacao-topo">
          <div class="avaliador-inicial">${inicial}</div>
          <div class="avaliador-info">
            <strong>${nome}</strong>
            <span>${data}${a._eventoNome ? ` · sobre "${a._eventoNome}"` : ''}</span>
          </div>
          <div class="avaliacao-estrelas">${estrelasHTMLPerfil(Number(a.nota))}</div>
        </div>
        ${a.comentario ? `<p>${a.comentario}</p>` : ''}
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   SEGUIR / DEIXAR DE SEGUIR (real — usa a tabela `seguidores`)
═══════════════════════════════════════════════════════ */

// ⚠️ Ajuste a chave abaixo se o seu app salvar o token de login com outro
//    nome no localStorage (ex.: 'authToken', 'accessToken').
function getTokenAuth() {
  return localStorage.getItem('token');
}

async function carregarStatusSeguidor(organizadorId) {
  const btnSeguir = document.getElementById('btn-seguir');
  const elSeguidores = document.getElementById('seguidores');

  // Contagem de seguidores (pública, não depende de login)
  try {
    const res = await fetch(`${API_BASE_PERFIL}/seguidores/count/${organizadorId}`);
    if (res.ok) {
      const { total } = await res.json();
      if (elSeguidores) elSeguidores.textContent = Number(total || 0).toLocaleString('pt-BR');
    }
  } catch (err) {
    console.warn('Não foi possível carregar a contagem de seguidores:', err);
  }

  // Se não tiver botão de seguir na tela (ex: é o próprio perfil), para por aqui.
  if (!btnSeguir || btnSeguir.disabled) return;

  // Status "já sigo / não sigo" só dá pra saber se tiver usuário logado.
  const token = getTokenAuth();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_PERFIL}/seguidores/verificar/${organizadorId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return; // ex.: token expirado — deixa o botão no estado padrão "Seguir"
    const { segue } = await res.json();
    if (segue) {
      btnSeguir.classList.add('seguindo');
      btnSeguir.innerHTML = '<i class="fa-solid fa-check"></i> Seguindo';
    }
  } catch (err) {
    console.warn('Não foi possível verificar status de seguidor:', err);
  }
}

// ── Botão Seguir — real (POST/DELETE em /seguidores) ──────────────────
async function toggleSeguir(btn) {
  const params = new URLSearchParams(window.location.search);
  const organizadorId = params.get('id');
  if (!organizadorId) {
    alert('Não é possível seguir: organizador sem ID válido nesta página.');
    return;
  }

  const token = getTokenAuth();
  if (!token) {
    alert('Você precisa estar logado para seguir um organizador.');
    return;
  }

  const jaSeguindo = btn.classList.contains('seguindo');
  const elSeguidores = document.getElementById('seguidores');
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE_PERFIL}/seguidores${jaSeguindo ? `/${organizadorId}` : ''}`, {
      method: jaSeguindo ? 'DELETE' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: jaSeguindo ? undefined : JSON.stringify({ organizador_id: organizadorId })
    });

    const dados = await res.json();
    if (!res.ok) throw new Error(dados.detalhes || dados.erro || 'Erro ao atualizar status de seguidor.');

    // Sucesso — atualiza botão e contagem real (recontando no backend,
    // em vez de só somar/subtrair 1 no front, pra evitar dessincronizar).
    btn.classList.toggle('seguindo', !jaSeguindo);
    btn.innerHTML = !jaSeguindo
      ? '<i class="fa-solid fa-check"></i> Seguindo'
      : '<i class="fa-solid fa-plus"></i> Seguir';

    const resCount = await fetch(`${API_BASE_PERFIL}/seguidores/count/${organizadorId}`);
    if (resCount.ok) {
      const { total } = await resCount.json();
      if (elSeguidores) elSeguidores.textContent = Number(total || 0).toLocaleString('pt-BR');
    }

  } catch (err) {
    console.error('Erro ao seguir/deixar de seguir:', err);
    alert(`Não foi possível atualizar: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

// ── Star picker interativo ────────────────────────────
let notaSelecionada = 0;

function inicializarStarPicker() {
  const picker = document.getElementById('starPicker');
  if (!picker) return;
  const stars  = picker.querySelectorAll('i');

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = +star.dataset.val;
      stars.forEach(s => {
        const sv = +s.dataset.val;
        s.className = sv <= val ? 'fa-solid fa-star' : 'fa-regular fa-star';
        s.classList.toggle('active', sv <= val);
      });
    });

    picker.addEventListener('mouseleave', () => {
      stars.forEach(s => {
        const sv = +s.dataset.val;
        s.className = sv <= notaSelecionada ? 'fa-solid fa-star' : 'fa-regular fa-star';
        s.classList.toggle('active', sv <= notaSelecionada);
      });
    });

    star.addEventListener('click', () => {
      notaSelecionada = +star.dataset.val;
      stars.forEach(s => {
        const sv = +s.dataset.val;
        s.className = sv <= notaSelecionada ? 'fa-solid fa-star' : 'fa-regular fa-star';
        s.classList.toggle('active', sv <= notaSelecionada);
      });
    });
  });
}

// ── Enviar avaliação (real — grava em /avaliacoes com organizador_id) ────
async function enviarAvaliacao() {
  const params = new URLSearchParams(window.location.search);
  const organizadorId = params.get('id');

  if (!organizadorId) {
    alert('Não é possível avaliar: organizador sem ID válido nesta página.');
    return;
  }

  const userIdLogado = localStorage.getItem('userId');
  if (userIdLogado && String(userIdLogado) === String(organizadorId)) {
    alert('Você não pode avaliar o seu próprio perfil.');
    return;
  }

  const nomeInput  = document.getElementById('nome-avaliador-input');
  const textoInput = document.getElementById('texto-avaliacao-input');

  if (!notaSelecionada) { alert('Selecione uma nota de 1 a 5 estrelas.'); return; }
  if (!nomeInput.value.trim()) { alert('Informe seu nome.'); nomeInput.focus(); return; }
  if (!textoInput.value.trim()) { alert('Escreva sua avaliação.'); textoInput.focus(); return; }

  // Se houver um token de login salvo, manda no header — o backend usa o
  // middleware authOpcional pra identificar o usuário e preencher usuario_id
  // automaticamente (ignorando o nome digitado no campo, nesse caso).
  // ⚠️ Ajuste a chave abaixo se o seu app salvar o token com outro nome
  //    (ex.: 'authToken', 'accessToken') no localStorage após o login.
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const btnEnviar = document.querySelector('.btn-enviar-avaliacao');
  if (btnEnviar) btnEnviar.disabled = true;

  try {
    const res = await fetch(`${API_BASE_PERFIL}/avaliacoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizador_id: organizadorId,
        nota: notaSelecionada,
        comentario: textoInput.value.trim(),
        nome_autor: nomeInput.value.trim()
      })
    });

    const dados = await res.json();
    if (!res.ok) {
      console.error('Resposta de erro do backend ao salvar avaliação:', dados);
      throw new Error(dados.detalhes || dados.erro || 'Erro ao enviar avaliação.');
    }

    // Reseta o formulário
    nomeInput.value   = '';
    textoInput.value  = '';
    notaSelecionada   = 0;
    document.querySelectorAll('#starPicker i').forEach(s => {
      s.className = 'fa-regular fa-star';
      s.classList.remove('active');
    });

    // Recarrega a aba de avaliações (e estatísticas) com dados reais do backend
    await carregarEventosEAvaliacoesOrganizador(organizadorId);

    alert('✅ Avaliação enviada com sucesso!');
  } catch (err) {
    console.error('Erro ao enviar avaliação:', err);
    alert(`Não foi possível enviar a avaliação: ${err.message}`);
  } finally {
    if (btnEnviar) btnEnviar.disabled = false;
  }
}

// ── Compartilhar ──────────────────────────────────────
function compartilhar(tipo) {
  const url = encodeURIComponent(window.location.href);
  if (tipo === 'whatsapp') {
    window.open(`https://wa.me/?text=Confira este perfil no Rolê.AI: ${url}`, '_blank');
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('✅ Link copiado!'))
      .catch(() => alert('Não foi possível copiar o link.'));
  }
}

// ── Abas ─────────────────────────────────────────────
function inicializarAbas() {
  const botoes  = document.querySelectorAll('.js-tab-button');
  const paineis = document.querySelectorAll('.painel-aba');
  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      botoes.forEach(b => b.classList.remove('ativo'));
      paineis.forEach(p => p.classList.remove('ativo'));
      btn.classList.add('ativo');
      document.getElementById(btn.getAttribute('data-tab'))?.classList.add('ativo');
    });
  });
}

// ── CSS fadeIn para novos cards ───────────────────────
const style = document.createElement('style');
style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  carregarPerfilOrganizador();
  inicializarAbas();
  inicializarStarPicker();
});