// Frontend/js/VerPerfil.js

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

// ── Carregar dados do perfil ──────────────────────────
function carregarPerfilOrganizador() {
  const params = new URLSearchParams(window.location.search);
  const nome   = decodeURIComponent(params.get('nome') || 'Eventos Goiânia Premium');
  const d      = DADOS_PERFIS[nome] || DADOS_PERFIS['Eventos Goiânia Premium'];

  document.getElementById('nome-organizador').textContent          = nome;
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

// ── Botão Seguir — toggle ─────────────────────────────
function toggleSeguir(btn) {
  const seguindo = btn.classList.toggle('seguindo');
  if (seguindo) {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Seguindo';
    const el = document.getElementById('seguidores');
    if (el) el.textContent = (parseInt(el.textContent.replace('.','')) + 1).toLocaleString('pt-BR');
  } else {
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Seguir';
    const el = document.getElementById('seguidores');
    if (el) el.textContent = (parseInt(el.textContent.replace('.','')) - 1).toLocaleString('pt-BR');
  }
}

// ── Star picker interativo ────────────────────────────
let notaSelecionada = 0;

function inicializarStarPicker() {
  const picker = document.getElementById('starPicker');
  if (!picker) return;
  const stars  = picker.querySelectorAll('i');

  stars.forEach(star => {
    // Hover: ilumina até a estrela hovered
    star.addEventListener('mouseenter', () => {
      const val = +star.dataset.val;
      stars.forEach(s => {
        const sv = +s.dataset.val;
        s.className = sv <= val ? 'fa-solid fa-star' : 'fa-regular fa-star';
        s.classList.toggle('active', sv <= val);
      });
    });

    // Mouse leave: restaura seleção
    picker.addEventListener('mouseleave', () => {
      stars.forEach(s => {
        const sv = +s.dataset.val;
        s.className = sv <= notaSelecionada ? 'fa-solid fa-star' : 'fa-regular fa-star';
        s.classList.toggle('active', sv <= notaSelecionada);
      });
    });

    // Click: fixa a nota
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

// ── Enviar avaliação ──────────────────────────────────
function enviarAvaliacao() {
  const nomeInput  = document.getElementById('nome-avaliador-input');
  const textoInput = document.getElementById('texto-avaliacao-input');
  const lista      = document.getElementById('lista-avaliacoes');

  if (!notaSelecionada) { alert('Selecione uma nota de 1 a 5 estrelas.'); return; }
  if (!nomeInput.value.trim()) { alert('Informe seu nome.'); nomeInput.focus(); return; }
  if (!textoInput.value.trim()) { alert('Escreva sua avaliação.'); textoInput.focus(); return; }

  const estrelas = '★'.repeat(notaSelecionada) + '☆'.repeat(5 - notaSelecionada);
  const inicial  = nomeInput.value.trim()[0].toUpperCase();
  const hoje     = new Date().toLocaleDateString('pt-BR');

  const card = document.createElement('div');
  card.className = 'cartao-avaliacao';
  card.style.animation = 'fadeIn 0.3s ease';
  card.innerHTML = `
    <div class="avaliacao-topo">
      <div class="avaliador-inicial">${inicial}</div>
      <div class="avaliador-info">
        <strong>${nomeInput.value.trim()}</strong>
        <span>${hoje}</span>
      </div>
      <div class="avaliacao-estrelas">${estrelas}</div>
    </div>
    <p>${textoInput.value.trim()}</p>
  `;

  // Insere no topo da lista
  lista.insertBefore(card, lista.firstChild);

  // Reseta formulário
  nomeInput.value   = '';
  textoInput.value  = '';
  notaSelecionada   = 0;
  document.querySelectorAll('#starPicker i').forEach(s => {
    s.className = 'fa-regular fa-star';
    s.classList.remove('active');
  });

  alert('✅ Avaliação enviada com sucesso!');
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