const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = isLocal ? "http://localhost:3000" : window.location.origin;
const API_URL = isLocal ? "http://localhost:3000/eventos" : "/eventos";

/* ═══════════════════════════════════════════
   CONFIGURAÇÃO
═══════════════════════════════════════════ */
const TAXA_SERVICO = 0.10;
const LIMITE_ESCASSEZ = 10;          // abaixo disso mostra "Restam apenas N"
const MIN_CONFIRMADOS_VISIVEL = 5;   // abaixo disso esconde "N pessoas confirmaram"
const MAX_POR_COMPRA = 10;
const QUANTIDADE_HABILITADA = true;
const MAX_VISIVEL_POR_SETOR = 2;     // ingressos mostrados por setor antes do "Ver mais"
const LIMITE_DESCRICAO_CURTA = 320;  // acima disso a descrição fica recolhida com "Ler mais"

/* ═══════════════════════════════════════════
   TEMPLATES DE MAPA
   Cada template define os setores disponíveis e o SVG a ser
   injetado dinamicamente, de acordo com o tipo_mapa/mapa_config
   que vem do evento (definidos na criação do evento).
═══════════════════════════════════════════ */
const TEMPLATES_MAPA = {
    arena: {
        setores: [
            { chave: 'arquibancada',     nome: 'Arquibancada',     dot: 'dot-arquibancada' },
            { chave: 'cadeira superior', nome: 'Cadeira Superior', dot: 'dot-cadeira-superior' },
            { chave: 'cadeira inferior', nome: 'Cadeira Inferior', dot: 'dot-cadeira-inferior' },
            { chave: 'pista',            nome: 'Pista',            dot: 'dot-pista' },
            { chave: 'vip',              nome: 'VIP',              dot: 'dot-vip' }
        ],
        svg: `<svg viewBox="0 0 560 360" id="svg-mapa-setores" role="img" aria-label="Mapa de setores do evento">
            <ellipse cx="225" cy="180" rx="195" ry="150" class="mapa-setor" data-setor="arquibancada" />
            <ellipse cx="225" cy="180" rx="155" ry="120" class="mapa-setor" data-setor="cadeira superior" />
            <ellipse cx="225" cy="180" rx="115" ry="88" class="mapa-setor" data-setor="cadeira inferior" />
            <ellipse cx="225" cy="180" rx="75" ry="57" class="mapa-setor" data-setor="pista" />

            <rect x="195" y="165" width="60" height="30" rx="6" class="mapa-palco" />
            <text x="225" y="184" text-anchor="middle" class="mapa-texto-palco">PALCO</text>

            <text x="225" y="222" text-anchor="middle" class="mapa-texto-setor mapa-texto-clara">PISTA</text>
            <text x="225" y="49" text-anchor="middle" class="mapa-texto-setor mapa-texto-escura">ARQUIBANCADA</text>

            <path d="M 330,100 L 395,60" class="mapa-linha-guia" />
            <text x="400" y="57" text-anchor="start" class="mapa-texto-setor mapa-texto-pequeno">CADEIRA</text>
            <text x="400" y="69" text-anchor="start" class="mapa-texto-setor mapa-texto-pequeno">SUPERIOR</text>

            <path d="M 145,258 L 85,295" class="mapa-linha-guia" />
            <text x="80" y="298" text-anchor="end" class="mapa-texto-setor mapa-texto-pequeno">CADEIRA</text>
            <text x="80" y="310" text-anchor="end" class="mapa-texto-setor mapa-texto-pequeno">INFERIOR</text>

            <rect x="450" y="140" width="90" height="90" rx="12" class="mapa-setor mapa-setor-vip" data-setor="vip" />
            <text x="495" y="180" class="mapa-texto-vip">SOUNDCHECK</text>
            <text x="495" y="198" class="mapa-texto-vip mapa-texto-vip-destaque">VIP</text>
        </svg>`
    },
    pista_camarote: {
        setores: [
            { chave: 'pista',    nome: 'Pista',    dot: 'dot-pista' },
            { chave: 'camarote', nome: 'Camarote', dot: 'dot-camarote' }
        ],
        svg: `<svg viewBox="0 0 560 360" id="svg-mapa-setores" role="img" aria-label="Mapa de setores do evento">
            <rect x="150" y="60" width="160" height="50" rx="8" class="mapa-palco" />
            <text x="230" y="90" text-anchor="middle" class="mapa-texto-palco">PALCO</text>

            <rect x="60" y="140" width="340" height="180" rx="16" class="mapa-setor" data-setor="pista" />
            <text x="230" y="240" text-anchor="middle" class="mapa-texto-setor mapa-texto-clara">PISTA</text>

            <rect x="420" y="140" width="110" height="180" rx="16" class="mapa-setor mapa-setor-vip" data-setor="camarote" />
            <text x="475" y="228" class="mapa-texto-vip mapa-texto-vip-destaque" text-anchor="middle" style="font-size:13px;">CAMAROTE</text>
        </svg>`
    },
    teatro: {
        setores: [
            { chave: 'plateia', nome: 'Plateia', dot: 'dot-plateia' },
            { chave: 'balcao',  nome: 'Balcão',  dot: 'dot-balcao' }
        ],
        svg: `<svg viewBox="0 0 560 360" id="svg-mapa-setores" role="img" aria-label="Mapa de setores do evento">
            <rect x="140" y="30" width="280" height="36" rx="6" class="mapa-palco" />
            <text x="280" y="53" text-anchor="middle" class="mapa-texto-palco">PALCO</text>

            <rect x="60" y="90" width="440" height="140" rx="14" class="mapa-setor" data-setor="plateia" />
            <text x="280" y="165" text-anchor="middle" class="mapa-texto-setor mapa-texto-clara">PLATEIA</text>

            <rect x="60" y="250" width="440" height="90" rx="14" class="mapa-setor" data-setor="balcao" />
            <text x="280" y="300" text-anchor="middle" class="mapa-texto-setor mapa-texto-escura">BALCÃO</text>
        </svg>`
    },
    simples: {
        setores: [
            { chave: 'geral', nome: 'Geral', dot: 'dot-geral' }
        ],
        svg: `<svg viewBox="0 0 560 360" id="svg-mapa-setores" role="img" aria-label="Mapa de setores do evento">
            <rect x="140" y="60" width="280" height="40" rx="6" class="mapa-palco" />
            <text x="280" y="85" text-anchor="middle" class="mapa-texto-palco">PALCO</text>

            <rect x="60" y="130" width="440" height="190" rx="16" class="mapa-setor" data-setor="geral" />
            <text x="280" y="230" text-anchor="middle" class="mapa-texto-setor mapa-texto-clara">GERAL</text>
        </svg>`
    }
};

// Setores conhecidos (mesma chave do data-setor do SVG do mapa).
// Antes era uma lista fixa com os 5 setores do arena — agora é dinâmica,
// trocada por renderizarMapaEvento() de acordo com o tipo_mapa/mapa_config
// que vier do evento carregado.
let SETORES = TEMPLATES_MAPA.arena.setores;

// Template de mapa do evento carregado ('arena', 'teatro', ... ou null quando não há mapa).
// Usado pelo modal de assentos para escolher o formato da grade.
let TEMPLATE_MAPA_ATUAL = null;

/* ═══════════════════════════════════════════
   STATUS DE VENDA DOS INGRESSOS
═══════════════════════════════════════════ */
const STATUS_VENDA = {
    disponivel: { texto: 'Selecionar', desabilitado: false },
    pausado:    { texto: 'Pausado',    desabilitado: true,  aviso: 'Vendas pausadas' },
    em_breve:   { texto: 'Em breve',   desabilitado: true,  aviso: 'Vendas em breve' },
    encerrado:  { texto: 'Encerrado',  desabilitado: true,  aviso: 'Vendas encerradas' },
    esgotado:   { texto: 'Esgotado',   desabilitado: true,  aviso: 'Ingressos esgotados' }
};

function formatarMoeda(valor) {
    return 'R$ ' + Number(valor).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Versão curta: "R$ 340" ou "R$ 1.080"; só mostra centavos quando existirem
function formatarMoedaCompacta(valor) {
    const n = Number(valor) || 0;
    const inteiro = Number.isInteger(n);
    return 'R$ ' + n.toLocaleString('pt-BR', {
        minimumFractionDigits: inteiro ? 0 : 2,
        maximumFractionDigits: 2
    });
}

function getDisponiveis(ingresso) {
    const total = Number(ingresso.quantidade_total ?? 100);
    const disp = ingresso.disponivel != null ? Number(ingresso.disponivel) : total;
    return Math.max(0, disp);
}

function getStatusVendaIngresso(ingresso) {
    // Se o backend já calculou, usa o valor dele
    if (ingresso.status_venda && STATUS_VENDA[ingresso.status_venda]) {
        return ingresso.status_venda;
    }

    const agora = new Date();
    const inicio = ingresso.data_inicio_venda || ingresso.venda_abre_em;
    const fim = ingresso.data_fim_venda || ingresso.venda_encerra_em;

    if (ingresso.ativo === false || ingresso.ativo === 0) return 'pausado';
    if (inicio && agora < new Date(inicio)) return 'em_breve';
    if (fim && agora > new Date(fim)) return 'encerrado';
    if (getDisponiveis(ingresso) <= 0) return 'esgotado';
    return 'disponivel';
}

function formatarDataHoraVenda(valor) {
    const d = new Date(valor);
    if (isNaN(d)) return '';
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${data} às ${hora}`;
}

/* ═══════════════════════════════════════════
   AUXILIARES DE DATA, MAPA E AGENDA
═══════════════════════════════════════════ */
function textoDiasRestantes(dataIso) {
    const [ano, mes, dia] = dataIso.substring(0, 10).split('-').map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(ano, mes - 1, dia);
    const dias = Math.round((alvo - hoje) / 86400000);

    if (dias < 0) return 'evento encerrado';
    if (dias === 0) return 'é hoje';
    if (dias === 1) return 'é amanhã';
    return `faltam ${dias} dias`;
}

function montarLinkMapa(evento) {
    const endereco = [evento.local_nome, evento.rua, evento.cidade, evento.estado]
        .filter(Boolean)
        .join(', ');
    if (!endereco) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

function formatarDataAgenda(texto) {
    if (!texto) return '';
    return texto.substring(0, 10).replace(/-/g, '') + 'T' + texto.substring(11, 16).replace(':', '') + '00';
}

function montarLinkAgenda(evento) {
    const inicio = formatarDataAgenda(evento.data_inicio);
    if (!inicio) return '#';
    const fim = formatarDataAgenda(evento.data_fim) || inicio;
    const local = [evento.local_nome, evento.cidade].filter(Boolean).join(', ');

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: evento.nome || 'Evento',
        dates: `${inicio}/${fim}`,
        details: 'Ingressos pelo Rolês',
        location: local
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ═══════════════════════════════════════════
   CABEÇALHO: PREÇO OU SITUAÇÃO DAS VENDAS
═══════════════════════════════════════════ */
function textoSituacaoGeral(statuses) {
    if (statuses.includes('em_breve')) return 'Em breve';
    if (statuses.includes('pausado')) return 'Pausados';
    if (statuses.every(s => s === 'esgotado')) return 'Esgotados';
    return 'Encerrados';
}

function atualizarCabecalhoPreco(ingressos) {
    const label = document.querySelector('.label-preco');
    const valor = document.querySelector('.valor-minimo');
    const por = document.querySelector('.por-pessoas');
    if (!label || !valor || !por) return;

    const disponiveis = ingressos.filter(i => getStatusVendaIngresso(i) === 'disponivel');

    if (disponiveis.length) {
        const minimo = Math.min(...disponiveis.map(i => parseFloat(i.valor) || 0));
        label.textContent = 'A partir de';
        valor.textContent = minimo > 0 ? formatarMoeda(minimo) : 'Grátis';
        por.textContent = minimo > 0 ? '+ taxa de serviço de 10%' : 'por pessoa';
    } else {
        const statuses = ingressos.map(getStatusVendaIngresso);
        label.textContent = 'Ingressos';
        valor.textContent = textoSituacaoGeral(statuses);
        por.textContent = '';
    }
}

/* ═══════════════════════════════════════════
   ESTADO DA COMPRA E RESUMO DE VALORES
═══════════════════════════════════════════ */
function salvarEstadoCompra() {
    if (window._eventoAtual) {
        localStorage.setItem('eventoSelecionado', JSON.stringify(window._eventoAtual));
    }
}

function desabilitarBotaoCompra(texto) {
    document.querySelectorAll('.botao-comprar, .botao-comprar-topo').forEach(btn => {
        btn.textContent = texto;
        btn.disabled = true;
    });
}

function atualizarBotaoDeCompra(precoNumerico, numerado = false) {
    const botoes = document.querySelectorAll('.botao-comprar, .botao-comprar-topo');
    if (!botoes.length) return;

    botoes.forEach(botaoComprar => {
        // Reabilita o botão (pode ter sido desabilitado por um status)
        botaoComprar.disabled = false;

        if (numerado) {
            // Ingresso numerado: o botão leva à escolha do assento
            botaoComprar.textContent = 'Escolher assento';
            botaoComprar.classList.remove('botao-confirmar');
            botaoComprar.classList.add('botao-comprar-padrao');
        } else if (precoNumerico === 0) {
            botaoComprar.textContent = 'Confirmar Presença';
            botaoComprar.classList.add('botao-confirmar');
            botaoComprar.classList.remove('botao-comprar-padrao');
        } else {
            botaoComprar.textContent = 'Comprar Ingresso';
            botaoComprar.classList.remove('botao-confirmar');
            botaoComprar.classList.add('botao-comprar-padrao');
        }
    });

    const botaoMobile = document.querySelector('.barra-compra-botao');
    if (botaoMobile) botaoMobile.textContent = numerado ? 'Escolher assento' : 'Comprar ingresso';
}

function atualizarBarraMobile(texto) {
    const valorMobile = document.querySelector('.barra-compra-valor');
    if (valorMobile) valorMobile.textContent = texto;
}

function atualizarResumo() {
    const e = window._eventoAtual;
    const total = document.querySelector('.card-garantia-ingresso .valor-ingresso');
    const bloco = document.getElementById('resumo-valores');
    const seletor = document.getElementById('seletor-quantidade');
    const aviso = document.getElementById('aviso-quantidade');
    if (!e || !total) return;

    const preco = Number(e.ingressoPreco) || 0;
    const qtd = e.quantidade || 1;
    const numerado = e.tipo_selecao === 'numerado';

    // Sem ingresso selecionado, ou ingresso gratuito: sem detalhamento
    if (!e.ingressoNome || preco === 0) {
        total.textContent = e.ingressoNome ? 'Grátis' : formatarMoeda(0);
        if (bloco) bloco.style.display = 'none';
        if (seletor) seletor.style.display = 'none';
        if (aviso) aviso.textContent = '';
        atualizarBarraMobile(total.textContent);
        return;
    }

    const subtotal = preco * qtd;
    const taxa = Math.round(subtotal * TAXA_SERVICO * 100) / 100;

    const sufixoAssento = numerado && e.assento_rotulos?.length
        ? ` (${e.assento_rotulos.length > 1 ? 'assentos' : 'assento'} ${e.assento_rotulos.join(', ')})`
        : '';
    document.getElementById('resumo-linha-ingresso').textContent = `${qtd}x ${e.ingressoNome}${sufixoAssento}`;
    document.getElementById('resumo-subtotal').textContent = formatarMoeda(subtotal);
    document.getElementById('resumo-taxa').textContent = formatarMoeda(taxa);
    total.textContent = formatarMoeda(subtotal + taxa);
    atualizarBarraMobile(total.textContent);

    if (bloco) bloco.style.display = '';

    // Ingresso numerado é sempre 1 assento por compra: sem seletor de quantidade
    if (seletor) seletor.style.display = (QUANTIDADE_HABILITADA && !numerado) ? '' : 'none';
    if (numerado) {
        if (aviso) aviso.textContent = '';
    } else if (QUANTIDADE_HABILITADA) {
        const max = e.maxQuantidade || 1;
        document.getElementById('qtd-valor').textContent = qtd;
        document.getElementById('qtd-menos').disabled = qtd <= 1;
        document.getElementById('qtd-mais').disabled = qtd >= max;
        if (aviso) {
            aviso.textContent = qtd >= max
                ? 'Você atingiu o máximo disponível'
                : `Máximo de ${max} por compra`;
        }
    }
}

function alterarQuantidade(delta) {
    const e = window._eventoAtual;
    if (!e || !e.tipo_ingresso_id) return;
    const max = e.maxQuantidade || 1;
    const nova = Math.min(max, Math.max(1, (e.quantidade || 1) + delta));
    if (nova === e.quantidade) return;
    e.quantidade = nova;
    salvarEstadoCompra();
    atualizarResumo();
}

function inicializarControlesQuantidade() {
    const menos = document.getElementById('qtd-menos');
    const mais = document.getElementById('qtd-mais');
    if (menos) menos.addEventListener('click', () => alterarQuantidade(-1));
    if (mais) mais.addEventListener('click', () => alterarQuantidade(1));
}

// Aplica um ingresso como selecionado (usado na carga inicial e no clique)
function selecionarIngresso(opcao) {
    const e = window._eventoAtual;
    if (!opcao || !e) return;

    document.querySelector('.ingressos-disponiveis')?.classList.remove('destaque-erro');
    document.getElementById('aviso-selecao-ingresso')?.style.setProperty('display', 'none');

    const nome = opcao.dataset.nome || opcao.querySelector('.nome-ingresso').textContent;
    const preco = Number(opcao.dataset.preco) || 0;
    const disponiveis = Number(opcao.dataset.disponiveis) || 0;
    const id = opcao.dataset.id && opcao.dataset.id !== 'undefined' ? opcao.dataset.id : null;
    const setorChave = opcao.dataset.setorChave || '';
    const limiteCompra = Number(opcao.dataset.limiteCompra) || 0;
    const minCompra = Number(opcao.dataset.minCompra) || 1;
    // Pista é público em pé: nunca tem assento marcado
    const numerado = opcao.dataset.tipoSelecao === 'numerado' && setorChave !== 'pista';

    e.ingressoNome = nome;
    e.ingressoPreco = preco;
    e.tipo_ingresso_id = id;
    // Numerado: pode escolher vários assentos, até o limite por compra do ingresso
    e.maxQuantidade = numerado
        ? Math.max(1, Math.min(disponiveis, limiteCompra || MAX_POR_COMPRA))
        : Math.max(1, Math.min(disponiveis, MAX_POR_COMPRA));
    e.minQuantidade = numerado ? Math.min(minCompra, e.maxQuantidade) : 1;
    e.quantidade = 1;

    // Trocar de ingresso descarta o assento escolhido antes
    e.tipo_selecao = numerado ? 'numerado' : 'livre';
    e.setor_chave = setorChave;
    e.assento_ids = [];
    e.assento_rotulos = [];
    salvarEstadoCompra();

    const resumo = document.querySelector('.ingresso-resumo');
    if (resumo) resumo.textContent = nome;

    atualizarBotaoDeCompra(preco, numerado);
    atualizarResumo();
}

// Marca visualmente a linha escolhida (círculo de seleção) e aplica a seleção
function marcarIngressoSelecionado(linha) {
    document.querySelectorAll('.opcao-ingresso').forEach(l => {
        l.classList.remove('selecionado');
        l.setAttribute('aria-checked', 'false');
    });
    linha.classList.add('selecionado');
    linha.setAttribute('aria-checked', 'true');

    selecionarIngresso(linha);
}

function inicializarLogicaSelecao() {
    // Só as linhas disponíveis participam da seleção
    const linhas = document.querySelectorAll('.opcao-ingresso:not(.indisponivel)');
    if (!linhas.length) return;

    linhas.forEach(linha => {
        linha.addEventListener('click', () => {
            // Clicar de novo no que já está selecionado não zera a quantidade
            if (linha.classList.contains('selecionado')) return;
            marcarIngressoSelecionado(linha);
        });

        linha.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (!linha.classList.contains('selecionado')) marcarIngressoSelecionado(linha);
            }
        });
    });
}

/* ═══════════════════════════════════════════
   MAPA DE SETORES
═══════════════════════════════════════════ */
function normalizar(texto) {
    return (texto || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function encontrarIngressosPorSetor(ingressos, setor) {
    const porCampo = ingressos.filter(i => normalizar(i.setor_mapa) === setor);
    if (porCampo.length) return porCampo;
    return ingressos.filter(i => normalizar(i.titulo).includes(setor));
}

function identificarSetorClasse(titulo) {
    const t = normalizar(titulo);
    if (t.includes('arquibancada')) return 'dot-arquibancada';
    if (t.includes('cadeira superior')) return 'dot-cadeira-superior';
    if (t.includes('cadeira inferior')) return 'dot-cadeira-inferior';
    if (t.includes('pista')) return 'dot-pista';
    if (t.includes('vip')) return 'dot-vip';
    return '';
}

// Descobre a qual setor um ingresso pertence (mesma regra do mapa)
function chaveSetorIngresso(ingresso) {
    const campo = normalizar(ingresso.setor_mapa);
    const porCampo = SETORES.find(s => s.chave === campo);
    if (porCampo) return porCampo.chave;

    const titulo = normalizar(ingresso.titulo);
    const porTitulo = SETORES.find(s => titulo.includes(s.chave));
    return porTitulo ? porTitulo.chave : 'outros';
}

function destacarGrupoIngressos(ingressosDoSetor) {
    const linhas = ingressosDoSetor
        .map(i => document.querySelector(`.opcao-ingresso[data-tipo="${CSS.escape(i.titulo)}"]`))
        .filter(Boolean);
    if (!linhas.length) return;

    // Abre o grupo (accordion) e mostra os ingressos escondidos pelo "Ver mais"
    linhas.forEach(el => {
        const grupo = el.closest('.grupo-ingressos');
        if (grupo) grupo.classList.add('aberto', 'grupo-expandido');
        const cab = grupo?.querySelector('.grupo-ingressos-cabecalho');
        if (cab) cab.setAttribute('aria-expanded', 'true');
        grupo?.querySelector('.grupo-ver-mais')?.remove();
    });

    linhas.forEach(el => el.classList.add('opcao-destacada'));

    // Espera a animação do accordion antes de rolar
    setTimeout(() => {
        linhas[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 320);

    setTimeout(() => {
        linhas.forEach(el => el.classList.remove('opcao-destacada'));
    }, 2100);
}

function inicializarMapaSetores(ingressos) {
    const svg = document.getElementById('svg-mapa-setores');
    const zonas = document.querySelectorAll('.mapa-zona-imagem');

    // Mapa em imagem (PNG): zonas clicáveis
    if (!svg && zonas.length) {
                const acender = (chave, on) => {
            zonas.forEach(z => {
                if (z.dataset.setor !== chave || z.style.cursor === 'not-allowed') return;
                if (z.classList.contains('zona-selecionada')) return;
                z.style.background = on ? 'rgba(124,58,237,.25)' : '';
                z.style.borderColor = on ? '#7c3aed' : 'transparent';
            });
        };

        zonas.forEach(zona => {
            const chave = zona.dataset.setor;
            const encontrados = encontrarIngressosPorSetor(ingressos, chave);
            const algumDisponivel = encontrados.some(i => getStatusVendaIngresso(i) === 'disponivel');

            if (!algumDisponivel) {
                zona.style.cursor = 'not-allowed';
                zona.style.background = 'rgba(0,0,0,.35)';
                return;
            }

            zona.addEventListener('mouseenter', () => acender(chave, true));
            zona.addEventListener('mouseleave', () => acender(chave, false));

            zona.addEventListener('click', () => {
                destacarGrupoIngressos(encontrados);
                zonas.forEach(z => {
                    z.classList.remove('zona-selecionada');
                    if (z.style.cursor !== 'not-allowed') { z.style.background = ''; z.style.borderColor = 'transparent'; }
                });
                zonas.forEach(z => {
                    if (z.dataset.setor !== chave) return;
                    z.classList.add('zona-selecionada');
                    z.style.background = 'rgba(124,58,237,.35)';
                    z.style.borderColor = '#7c3aed';
                });
            });
        });
        return;
    }

    if (!svg) return;

    const setores = svg.querySelectorAll('.mapa-setor');
    let algumIndisponivel = false;

    setores.forEach(setorEl => {
        const chave = setorEl.dataset.setor;
        const encontrados = encontrarIngressosPorSetor(ingressos, chave);

        if (!encontrados.length) {
            setorEl.classList.add('mapa-setor-indisponivel');
            algumIndisponivel = true;
            return;
        }

        const algumDisponivel = encontrados.some(i => getStatusVendaIngresso(i) === 'disponivel');
        if (!algumDisponivel) {
            setorEl.classList.add('mapa-setor-indisponivel');
        }

        setorEl.addEventListener('click', () => {
            if (!algumDisponivel) return;

            destacarGrupoIngressos(encontrados);

            setores.forEach(s => s.classList.remove('mapa-setor-selecionado'));
            svg.querySelectorAll(`.mapa-setor[data-setor="${chave}"]`)
                .forEach(s => s.classList.add('mapa-setor-selecionado'));
        });
    });

    const legendaVazia = document.getElementById('mapa-legenda-vazia');
    if (legendaVazia) legendaVazia.style.display = algumIndisponivel ? 'block' : 'none';
}

/* ═══════════════════════════════════════════
   RENDERIZAÇÃO DO MAPA CONFORME O EVENTO
   Lê tipo_mapa/mapa_config vindos do backend e injeta o SVG
   do template correspondente, ou esconde a seção do mapa
   quando o evento não tiver mapa configurado.
═══════════════════════════════════════════ */
function renderizarMapaEvento(evento) {
    const secaoMapa = document.querySelector('.mapa-setores');
    const wrap = document.querySelector('.mapa-svg-wrap');
    const tipo = evento.tipo_mapa;

    // O banco pode devolver o mapa_config como texto JSON
    let config = evento.mapa_config;
    if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch { config = null; }
    }

    // Evento antigo (tipo_mapa nunca definido): mantém o mapa arena
    if (tipo == null) {
        TEMPLATE_MAPA_ATUAL = 'arena';
        SETORES = TEMPLATES_MAPA.arena.setores;
        if (wrap) wrap.innerHTML = TEMPLATES_MAPA.arena.svg;
        if (secaoMapa) secaoMapa.style.display = '';
        return;
    }

    // Mapa em imagem (PNG enviado pelo produtor)
    if (tipo === 'imagem' && config?.imagem_url && Array.isArray(config.setores) && config.setores.length) {
        const url = config.imagem_url.startsWith('http')
            ? config.imagem_url
            : `${API_BASE}${config.imagem_url}`;

        TEMPLATE_MAPA_ATUAL = null; // assentos usam a grade reta
        SETORES = config.setores.map(s => ({ chave: s.chave, nome: s.nome, dot: '' }));

                if (wrap) {
            wrap.innerHTML = '';
            const caixa = document.createElement('div');
            caixa.id = 'mapa-imagem-caixa';
            caixa.style.cssText = 'position:relative;width:100%;line-height:0;';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Mapa do local do evento';
            img.style.cssText = 'width:100%;height:auto;display:block;border-radius:12px;';
            caixa.appendChild(img);

                        config.setores.forEach(s => {
                // aceita o formato novo (areas) e o antigo (area)
                const lista = Array.isArray(s.areas) ? s.areas : (s.area ? [s.area] : []);
                lista.forEach(a => {
                    const zona = document.createElement('div');
                    zona.className = 'mapa-zona-imagem';
                    zona.dataset.setor = s.chave;
                    zona.title = s.nome;
                    zona.style.cssText = `position:absolute;left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%;` +
                        'cursor:pointer;box-sizing:border-box;border:2px solid transparent;border-radius:6px;transition:background .15s,border-color .15s;';
                    caixa.appendChild(zona);
                });
            });
            wrap.appendChild(caixa);
        }
        if (secaoMapa) secaoMapa.style.display = '';
        return;
    }

    // "nenhum" (ou imagem sem dados válidos): esconde a seção do mapa
    if (tipo !== 'ilustrativo') {
        if (secaoMapa) secaoMapa.style.display = 'none';
        TEMPLATE_MAPA_ATUAL = null;
        SETORES = [];
        return;
    }

    const chaveTemplate = config?.template;
    const template = TEMPLATES_MAPA[chaveTemplate] || TEMPLATES_MAPA.arena;

    TEMPLATE_MAPA_ATUAL = TEMPLATES_MAPA[chaveTemplate] ? chaveTemplate : 'arena';
    SETORES = template.setores;
    if (wrap) wrap.innerHTML = template.svg;
    if (secaoMapa) secaoMapa.style.display = '';
}

/* ═══════════════════════════════════════════
   LEGENDA DE PREÇOS POR SETOR
   Explica as cores do mapa com o preço mínimo de cada setor,
   e permite clicar para destacar os ingressos.
═══════════════════════════════════════════ */
function montarLegendaPrecos(ingressos) {
    const container = document.getElementById('mapa-legenda-precos');
    if (!container) return;

    container.innerHTML = '';

    SETORES.forEach(s => {
        const encontrados = encontrarIngressosPorSetor(ingressos, s.chave);
        if (!encontrados.length) return;

        const disponiveis = encontrados.filter(i => getStatusVendaIngresso(i) === 'disponivel');
        const base = disponiveis.length ? disponiveis : encontrados;
        const minimo = Math.min(...base.map(i => parseFloat(i.valor) || 0));
        const texto = disponiveis.length
            ? (minimo > 0 ? formatarMoedaCompacta(minimo) : 'Grátis')
            : 'Indisponível';

        const item = document.createElement('div');
        item.className = `item-legenda-preco${disponiveis.length ? '' : ' indisponivel'}`;
        item.innerHTML = `
            <span class="nome-setor-legenda"><span class="dot-setor ${s.dot}"></span>${s.nome}</span>
            <span class="preco-setor-legenda">${texto}</span>`;

        if (disponiveis.length) {
            item.addEventListener('click', () => destacarGrupoIngressos(encontrados));
        }

        container.appendChild(item);
    });

    const linhaVazia = document.getElementById('mapa-legenda-vazia');
    if (linhaVazia && linhaVazia.style.display !== 'none') {
        const semIngressos = SETORES.filter(s => !encontrarIngressosPorSetor(ingressos, s.chave).length);
        linhaVazia.textContent = semIngressos.length
            ? `${semIngressos.map(s => s.nome).join(', ')} ainda não ${semIngressos.length > 1 ? 'têm' : 'tem'} ingressos cadastrados neste evento.`
            : 'Alguns setores ainda não têm ingressos cadastrados neste evento.';
    }
}

/* ═══════════════════════════════════════════
   LISTA DE INGRESSOS AGRUPADA POR SETOR (ACCORDION)
   Cada ingresso é uma linha clicável com círculo de seleção.
═══════════════════════════════════════════ */
// "Cadeira Superior - Inteira" dentro do grupo "Cadeira Superior" vira só "Inteira" na tela.
// O nome completo continua em data-nome e é o que vai para o resumo e o checkout.
function nomeCurtoIngresso(titulo, chave) {
    const config = SETORES.find(s => s.chave === chave);
    const t = (titulo || '').trim();
    if (!config) return t;

    const nomeSetor = config.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('^' + nomeSetor + '\\s*[-\u2013\u2014:]\\s*', 'i');
    const curto = t.replace(regex, '').trim();

    if (!curto || curto === t) return t;
    return curto.charAt(0).toUpperCase() + curto.slice(1);
}

function escaparAtributo(valor) {
    return String(valor ?? '').replace(/"/g, '&quot;');
}

function montarHtmlIngresso(ingresso, index, indiceSelecionado, extra, chave) {
    const preco = parseFloat(ingresso.valor) || 0;
    const precoFormatado = preco > 0 ? formatarMoeda(preco) : 'R$ 0,00';
    const disponiveis = getDisponiveis(ingresso);
    const status = getStatusVendaIngresso(ingresso);
    const info = STATUS_VENDA[status];
    const isSelecionado = index === indiceSelecionado;
    const escassez = status === 'disponivel' && disponiveis <= LIMITE_ESCASSEZ;
    const indisponivel = info.desabilitado;
    const nomeCurto = nomeCurtoIngresso(ingresso.titulo, chave);
    const tipoSelecao = ingresso.tipo_selecao === 'numerado' ? 'numerado' : 'livre';
    // Limite de assentos por compra: o menor entre "máxima por compra" e "limite por CPF" (0 = sem limite)
    const limites = [ingresso.quantidade_max_por_compra, ingresso.limite_por_cpf].map(Number).filter(n => n > 0);
    const limiteCompra = limites.length ? Math.min(...limites) : 0;
    const minCompra = Number(ingresso.quantidade_min_por_compra) > 0 ? Number(ingresso.quantidade_min_por_compra) : 1;

    // Texto de quantidade / aviso de status
    let textoQuantidade = `${disponiveis} disponíveis`;
    if (escassez) {
        textoQuantidade = disponiveis === 1 ? 'Resta apenas 1' : `Restam apenas ${disponiveis}`;
    }
    if (status !== 'disponivel') {
        textoQuantidade = info.aviso;
        if (status === 'em_breve') {
            const abre = ingresso.data_inicio_venda || ingresso.venda_abre_em;
            if (abre) textoQuantidade = `Vendas abrem em ${formatarDataHoraVenda(abre)}`;
        }
    }

    let descricao = '';
    if (tipoSelecao === 'numerado') {
        const ateN = limiteCompra > 1 ? ` (até ${limiteCompra} por compra)` : '';
        descricao = `<p class="descricao-ingresso">Assento marcado: você escolhe o seu lugar${ateN}</p>`;
    } else if (ingresso.tipo === 'gratuito') {
        descricao = '<p class="descricao-ingresso">Entrada gratuita</p>';
    }

    const classes = [
        'opcao-ingresso',
        isSelecionado ? 'selecionado' : '',
        extra ? 'ingresso-extra' : '',
        indisponivel ? 'indisponivel' : ''
    ].filter(Boolean).join(' ');

    return `
        <div class="${classes}" role="radio" aria-checked="${isSelecionado}" aria-disabled="${indisponivel}" tabindex="${indisponivel ? -1 : 0}" data-idx="${index}" data-tipo="${escaparAtributo(ingresso.titulo)}" data-nome="${escaparAtributo(ingresso.titulo)}" data-id="${ingresso.id}" data-status="${status}" data-preco="${preco}" data-disponiveis="${disponiveis}" data-escassez="${escassez}" data-tipo-selecao="${tipoSelecao}" data-setor-chave="${chave}" data-limite-compra="${limiteCompra}" data-min-compra="${minCompra}">
            <span class="radio-ingresso" aria-hidden="true"></span>
            <div class="detalhes-opcao">
                <div class="linha-ingresso">
                    <span class="nome-ingresso">${nomeCurto}</span>
                    <span class="preco-ingresso">${precoFormatado}</span>
                </div>
                ${descricao}
                <span class="quantidade-restante">${textoQuantidade}</span>
            </div>
            <span class="etiqueta-selecionado">Selecionado</span>
        </div>`;
}

function montarHtmlGrupo(chave, itens, indiceSelecionado, abrirPadrao) {
    const config = SETORES.find(s => s.chave === chave);
    const nome = config ? config.nome : 'Ingressos';
    const dot = config ? config.dot : '';

    const disponiveis = itens.filter(({ ingresso }) => getStatusVendaIngresso(ingresso) === 'disponivel');
    const base = disponiveis.length ? disponiveis : itens;
    const minimo = Math.min(...base.map(({ ingresso }) => parseFloat(ingresso.valor) || 0));
    const textoPreco = disponiveis.length
        ? (minimo > 0 ? `a partir de ${formatarMoedaCompacta(minimo)}` : 'Grátis')
        : 'Indisponível';

    const temSelecionado = itens.some(({ index }) => index === indiceSelecionado);
    const aberto = temSelecionado || abrirPadrao;

    // Do terceiro ingresso em diante fica escondido (o selecionado nunca esconde)
    let qtdExtras = 0;
    const linhas = itens.map(({ ingresso, index }, posicao) => {
        const extra = posicao >= MAX_VISIVEL_POR_SETOR && index !== indiceSelecionado;
        if (extra) qtdExtras++;
        return montarHtmlIngresso(ingresso, index, indiceSelecionado, extra, chave);
    }).join('');

    const botaoVerMais = qtdExtras > 0
        ? `<button type="button" class="grupo-ver-mais">Ver mais ${qtdExtras} ${qtdExtras === 1 ? 'ingresso' : 'ingressos'}</button>`
        : '';

    return `
        <div class="grupo-ingressos${aberto ? ' aberto' : ''}${disponiveis.length ? '' : ' grupo-indisponivel'}" data-setor="${chave}">
            <button type="button" class="grupo-ingressos-cabecalho" aria-expanded="${aberto ? 'true' : 'false'}">
                <span class="grupo-ingressos-titulo"><span class="dot-setor ${dot}"></span>${nome}</span>
                <span class="grupo-ingressos-info">
                    <span class="grupo-ingressos-preco">${textoPreco}</span>
                    <i class="fa-solid fa-chevron-down grupo-ingressos-seta"></i>
                </span>
            </button>
            <div class="grupo-ingressos-corpo">
                ${linhas}
                ${botaoVerMais}
            </div>
        </div>`;
}

function inicializarAccordionIngressos() {
    document.querySelectorAll('.grupo-ingressos-cabecalho').forEach(cab => {
        cab.addEventListener('click', () => {
            const grupo = cab.closest('.grupo-ingressos');
            const aberto = grupo.classList.toggle('aberto');
            cab.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        });
    });

    document.querySelectorAll('.grupo-ver-mais').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.grupo-ingressos').classList.add('grupo-expandido');
            btn.remove();
        });
    });
}

/* ═══════════════════════════════════════════
   DESCRIÇÃO RECOLHIDA COM "LER MAIS"
═══════════════════════════════════════════ */
function configurarDescricaoExpansivel() {
    const desc = document.querySelector('.descricao-evento');
    if (!desc) return;

    document.querySelector('.descricao-ver-mais')?.remove();
    desc.classList.remove('descricao-recolhida', 'descricao-com-botao');

    if ((desc.textContent || '').length <= LIMITE_DESCRICAO_CURTA) return;

    desc.classList.add('descricao-recolhida', 'descricao-com-botao');

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'descricao-ver-mais';
    botao.textContent = 'Ler mais';
    botao.setAttribute('aria-expanded', 'false');
    botao.addEventListener('click', () => {
        const recolhida = desc.classList.toggle('descricao-recolhida');
        botao.textContent = recolhida ? 'Ler mais' : 'Mostrar menos';
        botao.setAttribute('aria-expanded', recolhida ? 'false' : 'true');
    });
    desc.insertAdjacentElement('afterend', botao);
}

/* ═══════════════════════════════════════════
   CARREGAMENTO DA PÁGINA
═══════════════════════════════════════════ */
async function carregarDetalhesEvento() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('id');

    if (!eventId) {
        document.querySelector('.titulo-evento').textContent = 'Evento não encontrado';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/${eventId}`);
        if (!res.ok) throw new Error('Evento não encontrado');
        const evento = await res.json();

        // Banner
        const bannerSection = document.querySelector('.banner-evento');
        if (bannerSection && evento.imagem) {
            const imgUrl = evento.imagem.startsWith("http")
                ? evento.imagem
                : `${API_BASE}${evento.imagem}`;
            bannerSection.style.backgroundImage =
                `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('${imgUrl}')`;
        }

        // Cabeçalho
        document.querySelector('.etiqueta-categoria').textContent = evento.assunto || 'Evento';
        document.querySelector('.titulo-evento').textContent = evento.nome;

        const dataFormatada = evento.data_inicio
            ? (() => {
                const [ano, mes, dia] = evento.data_inicio.substring(0, 10).split('-');
                const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
            })()
            : '-';
        const horaFormatada = evento.data_inicio
            ? evento.data_inicio.substring(11, 16)
            : '-';

        const diasRestantes = evento.data_inicio
            ? ` <span class="separador-cabecalho">•</span> ${textoDiasRestantes(evento.data_inicio)}`
            : '';

        document.querySelector('.data-hora-cabecalho').innerHTML =
            `${dataFormatada} <span class="separador-cabecalho">•</span> ${horaFormatada}${diasRestantes}`;

        // Sobre o evento
        const tituloSobre = document.querySelector('.sobre-evento .titulo-secao');
        if (tituloSobre) tituloSobre.textContent = evento.nome ? `Sobre o ${evento.nome}` : 'Sobre o Evento';
        document.querySelector('.descricao-evento').textContent = evento.descricao || '';
        configurarDescricaoExpansivel();
        document.querySelector('.nome-local').textContent = evento.local_nome || '';
        document.querySelector('.endereco-local').textContent = evento.cidade || '';

        // Local no card do mapa
        const mapaLocalNome = document.querySelector('.js-mapa-local-nome');
        if (mapaLocalNome) mapaLocalNome.textContent = evento.local_nome || '';
        const mapaLocalCidade = document.querySelector('.js-mapa-local-cidade');
        if (mapaLocalCidade) mapaLocalCidade.textContent = evento.cidade || '';

        // Confirmados: com poucos, esconde para não virar prova social negativa
        const confirmados = Number(evento.confirmados) || 0;
        document.querySelector('.numero-confirmados').textContent = `${confirmados} pessoas`;
        const blocoConfirmados = document.querySelector('.info-item.confirmados');
        if (blocoConfirmados) {
            blocoConfirmados.style.display = confirmados >= MIN_CONFIRMADOS_VISIVEL ? '' : 'none';
        }

        // Resumo lateral
        document.querySelector('.data-resumo').textContent = dataFormatada;
        document.querySelector('.hora-resumo').textContent = horaFormatada;
        document.querySelector('.local-resumo').textContent = evento.local_nome || '';

        // Como chegar e agenda
        const linkMapa = document.querySelector('.js-como-chegar');
        if (linkMapa) linkMapa.href = montarLinkMapa(evento);
        const linkAgenda = document.querySelector('.js-agenda');
        if (linkAgenda) linkAgenda.href = montarLinkAgenda(evento);

        // ── Organizador ──────────────────────────────────────────
        const nomeProdutora = document.getElementById('nome-produtora');
        const eventosOrganizados = document.getElementById('eventos-organizados');
        if (nomeProdutora) {
            nomeProdutora.innerHTML = evento.nome_produtor
                ? `${evento.nome_produtor} <span class="etiqueta-verificado">Verificado</span>`
                : 'Organizador não informado';
        }
        if (eventosOrganizados) {
            eventosOrganizados.textContent = '';
        }

        // Link dinâmico para o perfil do organizador
        const linkVerPerfil = document.querySelector('.js-link-ver-perfil');
        if (linkVerPerfil) {
            const organizadorId =
                evento.organizador_id ?? evento.produtor_id ?? evento.usuario_id ?? null;

            if (organizadorId) {
                linkVerPerfil.href = `/frontend/eventos/VerPerfil.html?id=${encodeURIComponent(organizadorId)}`;
            } else if (evento.nome_produtor) {
                linkVerPerfil.href = `/frontend/eventos/VerPerfil.html?nome=${encodeURIComponent(evento.nome_produtor)}`;
            }
        }

        // Estado global base (sempre existe, mesmo sem ingresso disponível)
        window._eventoAtual = {
            nome: evento.nome,
            data: dataFormatada,
            hora: horaFormatada,
            local: evento.local_nome || '',
            imagem: evento.imagem || '',
            ingressoNome: '',
            ingressoPreco: 0,
            evento_id: evento.id,
            tipo_ingresso_id: null,
            quantidade: 1,
            maxQuantidade: 1,
            tipo_selecao: 'livre',
            minQuantidade: 1,
            assento_ids: [],
            assento_rotulos: [],
            categoria: evento.categoria || null // ← usado pelo sistema de recomendação (recomendacaoService.js)
        };

        // Mapa do evento — escolhe o template certo (ou esconde) de acordo
        // com o tipo_mapa/mapa_config que veio do backend
        renderizarMapaEvento(evento);

        // Ingressos
        const ingressosContainer = document.querySelector('.ingressos-disponiveis');
        const loadingIngressos = document.getElementById('loading-ingressos');
        if (loadingIngressos) loadingIngressos.remove();

        const ingressos = (evento.ingressos && evento.ingressos.length > 0)
            ? evento.ingressos
            : [{ titulo: 'Ingresso Geral', tipo: 'gratuito', valor: 0, quantidade_total: 100 }];

        atualizarCabecalhoPreco(ingressos);

        // Seleciona por padrão o primeiro ingresso que estiver disponível
        const indiceSelecionado = ingressos.findIndex(i => getStatusVendaIngresso(i) === 'disponivel');

        // Agrupa os ingressos por setor, guardando o índice original de cada um
        const itensPorSetor = new Map();
        ingressos.forEach((ingresso, index) => {
            const chave = chaveSetorIngresso(ingresso);
            if (!itensPorSetor.has(chave)) itensPorSetor.set(chave, []);
            itensPorSetor.get(chave).push({ ingresso, index });
        });

        const ordemGrupos = [...SETORES.map(s => s.chave), 'outros'];
        let primeiroGrupo = true;

        ordemGrupos.forEach(chave => {
            const itens = itensPorSetor.get(chave);
            if (!itens || !itens.length) return;

            // Se nenhum ingresso está selecionado, abre só o primeiro grupo
            const abrirPadrao = primeiroGrupo && indiceSelecionado === -1;
            primeiroGrupo = false;

            if (ingressosContainer) {
                ingressosContainer.insertAdjacentHTML(
                    'beforeend',
                    montarHtmlGrupo(chave, itens, indiceSelecionado, abrirPadrao)
                );
            }
        });

        inicializarAccordionIngressos();

        // Chamada única, depois que todos os cards de ingresso já foram inseridos no DOM
        inicializarMapaSetores(ingressos);
        montarLegendaPrecos(ingressos);

        if (indiceSelecionado !== -1) {
            // Aplica o ingresso selecionado por padrão (busca pelo índice original,
            // porque a ordem no DOM agora segue os grupos)
            const alvo = document.querySelector(`.opcao-ingresso[data-idx="${indiceSelecionado}"]`);
            selecionarIngresso(alvo);
        } else {
            // Nenhum ingresso disponível: bloqueia o botão de compra com o status do primeiro
            const statusPrimeiro = getStatusVendaIngresso(ingressos[0]);
            document.querySelector('.ingresso-resumo').textContent = '-';
            desabilitarBotaoCompra(STATUS_VENDA[statusPrimeiro].texto);
            atualizarResumo();
        }

        inicializarLogicaSelecao();

    } catch (err) {
        console.error('Erro ao carregar evento:', err);
        document.querySelector('.titulo-evento').textContent = 'Erro ao carregar evento';
        document.querySelector('.descricao-evento').textContent = 'Não foi possível buscar os dados. Verifique o servidor.';
    }
}

function injetarEstiloAviso() {
    if (document.getElementById('rolesAvisoStyle')) return;
    const s = document.createElement('style');
    s.id = 'rolesAvisoStyle';
    s.textContent = `
        @keyframes rolesAvisoIn  { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rolesAvisoOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
        .roles-aviso {
            position: fixed; top: 24px; right: 24px; z-index: 99999;
            width: 380px; max-width: calc(100vw - 32px);
            background: #1C1834; color: #F1EDFA;
            padding: 16px 18px; border-radius: 12px;
            border: 1px solid #322850;
            box-shadow: 0 10px 28px rgba(0, 0, 0, .45);
            font-family: 'Inter', sans-serif;
            display: flex; align-items: flex-start; gap: 12px;
            animation: rolesAvisoIn .25s ease;
        }
        .roles-aviso-icone {
            width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 800; color: #160f28;
        }
        .roles-aviso-corpo { flex: 1; min-width: 0; }
        .roles-aviso-titulo { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
        .roles-aviso-texto { font-size: 13px; font-weight: 500; line-height: 1.5; color: #D6CFEA; }
        .roles-aviso-fechar {
            background: none; border: none; color: #9689B8; cursor: pointer;
            font-size: 18px; line-height: 1; padding: 0; flex-shrink: 0;
        }
        .roles-aviso-fechar:hover { color: #F1EDFA; }
        @media (max-width: 480px) { .roles-aviso { top: 16px; right: 16px; left: 16px; width: auto; } }
    `;
    document.head.appendChild(s);
}

function mostrarAviso(mensagem, tipo = 'info', titulo = '') {
    injetarEstiloAviso();
    document.querySelectorAll('.roles-aviso').forEach(a => a.remove());

    const cores  = { success: '#35D399', error: '#FF5C7A', warn: '#FFB627', info: '#6AA9FF' };
    const icones = { success: '✓', error: '✕', warn: '!', info: 'i' };

    const aviso = document.createElement('div');
    aviso.className = 'roles-aviso';
    aviso.setAttribute('role', 'alert');

    const icone = document.createElement('span');
    icone.className = 'roles-aviso-icone';
    icone.style.background = cores[tipo] || cores.info;
    icone.textContent = icones[tipo] || icones.info;

    const corpo = document.createElement('div');
    corpo.className = 'roles-aviso-corpo';
    if (titulo) {
        const t = document.createElement('div');
        t.className = 'roles-aviso-titulo';
        t.textContent = titulo;
        corpo.appendChild(t);
    }
    const texto = document.createElement('div');
    texto.className = 'roles-aviso-texto';
    texto.textContent = mensagem;
    corpo.appendChild(texto);

    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'roles-aviso-fechar';
    fechar.setAttribute('aria-label', 'Fechar aviso');
    fechar.innerHTML = '&times;';
    fechar.addEventListener('click', () => aviso.remove());

    aviso.append(icone, corpo, fechar);
    document.body.appendChild(aviso);

    setTimeout(() => {
        aviso.style.animation = 'rolesAvisoOut .25s ease forwards';
        setTimeout(() => aviso.remove(), 260);
    }, 6000);
}

function obterUsuarioId() {
    for (const chave of ['userId', 'id', 'user_id', 'usuarioId', 'usuario_id']) {
        const v = localStorage.getItem(chave);
        if (v && v !== 'undefined' && v !== 'null') return v;
    }
    return null;
}

/* ═══════════════════════════════════════════
   SELEÇÃO DE ASSENTO (INGRESSO NUMERADO)
   Fluxo: botão "Escolher assento" -> modal com a grade
   (GET /assentos/:ingressoId) -> clique no assento -> "Confirmar assento"
   (POST /assentos/:id/reservar) -> segue para o checkout com os assento_ids.
═══════════════════════════════════════════ */
let _assentosEscolhidos = [];        // [{ id, rotulo }] na ordem em que foram marcados
let _assentosReservados = new Set(); // ids já reservados nesta abertura do modal

function assentoEstaEscolhido(id) {
    return _assentosEscolhidos.some(s => String(s.id) === String(id));
}

// Marca ou desmarca um assento, respeitando o máximo por compra.
// Com máximo 1, clicar em outro assento troca o escolhido.
// Retorna true se a seleção mudou.
function alternarAssento(assento, rotulo) {
    const max = window._eventoAtual?.maxQuantidade || 1;
    const idx = _assentosEscolhidos.findIndex(s => String(s.id) === String(assento.id));

    if (idx >= 0) {
        _assentosEscolhidos.splice(idx, 1);
    } else if (max === 1) {
        _assentosEscolhidos = [{ id: assento.id, rotulo }];
    } else if (_assentosEscolhidos.length >= max) {
        mostrarAviso(`Você pode escolher no máximo ${max} assentos nesta compra. Desmarque um para trocar.`, 'warn', 'Limite de assentos');
        return false;
    } else {
        _assentosEscolhidos.push({ id: assento.id, rotulo });
    }

    atualizarRodapeAssentos();
    return true;
}

// Reflete a seleção atual nos botões que já estão na tela
function sincronizarAssentosNaTela() {
    document.querySelectorAll('#modal-assentos-grade .assento[data-id]').forEach(el => {
        const marcado = assentoEstaEscolhido(el.dataset.id);
        el.classList.toggle('assento-selecionado', marcado);
        el.setAttribute('aria-pressed', marcado ? 'true' : 'false');
    });
}
let _modalAssentosTecla = null;

// Fileira pode vir como número (1, 2, 3) ou letra (A, B, C); número vira letra
function rotuloFileira(fileira) {
    const n = Number(fileira);
    if (Number.isInteger(n) && n >= 1 && n <= 26 && String(fileira).trim() === String(n)) {
        return String.fromCharCode(64 + n);
    }
    return String(fileira ?? '');
}

function assentoDisponivel(assento) {
    // Assento que EU acabei de reservar continua selecionável (o servidor já o marca como reservado)
    if (_assentosReservados.has(String(assento.id))) return true;
    const s = normalizar(assento.status);
    return s === 'disponivel' || s === 'livre';
}

function garantirModalAssentos() {
    let overlay = document.getElementById('modal-assentos');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'modal-assentos';
    overlay.className = 'modal-assentos';
    overlay.innerHTML = `
        <div class="modal-assentos-caixa" role="dialog" aria-modal="true" aria-labelledby="modal-assentos-titulo">
            <div class="modal-assentos-topo">
                <div>
                    <span class="rotulo-secao">Assentos</span>
                    <h3 class="modal-assentos-titulo" id="modal-assentos-titulo">Escolha seu assento</h3>
                </div>
                <button type="button" class="modal-assentos-fechar" aria-label="Fechar">&times;</button>
            </div>

            <div class="modal-assentos-contexto" id="modal-assentos-contexto"></div>
            <div class="modal-assentos-palco">PALCO</div>
            <div class="modal-assentos-grade" id="modal-assentos-grade"></div>

            <div class="modal-assentos-legenda">
                <span class="legenda-assento"><span class="amostra-assento"></span>Disponível</span>
                <span class="legenda-assento"><span class="amostra-assento amostra-selecionado"></span>Selecionado</span>
                <span class="legenda-assento"><span class="amostra-assento amostra-ocupado"></span>Indisponível</span>
            </div>

            <div class="modal-assentos-rodape">
                <span class="modal-assentos-escolhido" id="modal-assentos-escolhido">Nenhum assento selecionado</span>
                <button type="button" class="modal-assentos-confirmar" id="modal-assentos-confirmar" disabled>Confirmar assento</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) fecharModalAssentos();
    });
    overlay.querySelector('.modal-assentos-fechar').addEventListener('click', fecharModalAssentos);
    overlay.querySelector('#modal-assentos-confirmar').addEventListener('click', confirmarAssento);

    return overlay;
}

function atualizarRodapeAssentos() {
    const texto = document.getElementById('modal-assentos-escolhido');
    const btn = document.getElementById('modal-assentos-confirmar');
    if (!texto || !btn) return;

    const e = window._eventoAtual;
    const max = e?.maxQuantidade || 1;
    const min = Math.min(e?.minQuantidade || 1, max);
    const n = _assentosEscolhidos.length;
    const rotulos = _assentosEscolhidos.map(a => a.rotulo).join(', ');

    if (n === 0) {
        texto.textContent = max > 1 ? `Escolha até ${max} assentos` : 'Nenhum assento selecionado';
    } else if (max === 1) {
        texto.textContent = `Assento ${rotulos}`;
    } else if (n < min) {
        texto.textContent = `${n} de ${max} (mínimo ${min}): ${rotulos}`;
    } else {
        texto.textContent = `${n} de ${max}: ${rotulos}`;
    }

    btn.disabled = n === 0 || n < min;
    btn.textContent = n > 1 ? 'Confirmar assentos' : 'Confirmar assento';
}

/* ───────────────────────────────────────────
   ESTÁDIO POR BLOCOS (estilo Ticketmaster)
   1) mapa do estádio com o setor do ingresso dividido em blocos
   2) clicar num bloco abre as fileiras e os assentos dele
   A pista nunca tem assento marcado.
─────────────────────────────────────────── */
const SETORES_COM_ASSENTO_ESTADIO = ['arquibancada', 'cadeira superior', 'cadeira inferior', 'vip'];

// Limites de cada setor no mapa (de dentro para fora): rx/ry interno e externo
const FAIXAS_ESTADIO = {
    'pista':            { rxi: 0,   ryi: 0,   rxo: 135, ryo: 103 },
    'cadeira inferior': { rxi: 139, ryi: 107, rxo: 207, ryo: 158 },
    'cadeira superior': { rxi: 211, ryi: 162, rxo: 279, ryo: 216 },
    'arquibancada':     { rxi: 283, ryi: 220, rxo: 351, ryo: 270 }
};
const NOME_FAIXA_ESTADIO = {
    'pista': 'PISTA',
    'cadeira inferior': 'CADEIRA INFERIOR',
    'cadeira superior': 'CADEIRA SUPERIOR',
    'arquibancada': 'ARQUIBANCADA',
    'vip': 'VIP'
};
const PREFIXO_BLOCO = { 'arquibancada': 'ARQ', 'cadeira superior': 'CS', 'cadeira inferior': 'CI', 'vip': 'VIP' };
const VIP_RETANGULO = { x: 640, y: 495, w: 100, h: 60 };

let _assentosEstadio = [];

function svgEl(nome, attrs = {}, texto) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', nome);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (texto != null) n.textContent = texto;
    return n;
}

// Cabeçalho do modal no modo estádio: setor do ingresso e instrução
function montarContextoEstadio() {
    const contexto = document.getElementById('modal-assentos-contexto');
    if (!contexto) return;
    contexto.innerHTML = '';

    const chave = window._eventoAtual?.setor_chave || '';
    const config = SETORES.find(s => s.chave === chave);
    if (!config) return;

    const texto = document.createElement('div');
    texto.className = 'assentos-contexto-texto';
    texto.innerHTML = `
        <span class="assentos-contexto-setor"><span class="dot-setor ${config.dot}"></span>${config.nome}</span>
        <span class="assentos-contexto-dica">Escolha um bloco no mapa e depois o seu lugar. A pista não tem assento marcado.</span>`;
    contexto.appendChild(texto);
}

// Divide os assentos do ingresso em blocos: cada fileira é repartida entre os blocos,
// então todo bloco tem as mesmas fileiras (A, B, C...) com um pedaço de cada.
function dividirEmBlocos(assentos) {
    const chaveSetor = window._eventoAtual?.setor_chave || '';

    const porFileira = new Map();
    assentos.forEach(a => {
        const chave = String(a.fileira);
        if (!porFileira.has(chave)) porFileira.set(chave, []);
        porFileira.get(chave).push(a);
    });

    const chaves = [...porFileira.keys()].sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b, 'pt-BR');
    });

    const maxPorFileira = Math.max(...chaves.map(c => porFileira.get(c).length));
    let K = maxPorFileira < 8 ? 1 : Math.min(12, Math.max(2, 2 * Math.round(maxPorFileira / 12)));
    if (chaveSetor === 'vip') K = 1; // VIP é um bloco só

    const prefixo = PREFIXO_BLOCO[chaveSetor] || 'B';
    const blocos = Array.from({ length: K }, (_, j) => ({
        indice: j, nome: `${prefixo}${j + 1}`, linhas: [], total: 0, disponiveis: 0
    }));

    chaves.forEach(chave => {
        const lugares = porFileira.get(chave).sort((a, b) => Number(a.numero) - Number(b.numero));
        const n = lugares.length;
        let k = 0;
        blocos.forEach((b, j) => {
            const qtd = Math.floor(n / K) + (j < n % K ? 1 : 0);
            const parte = lugares.slice(k, k + qtd);
            k += qtd;
            if (!parte.length) return;
            b.linhas.push({ letra: rotuloFileira(chave), lugares: parte });
            b.total += parte.length;
            b.disponiveis += parte.filter(assentoDisponivel).length;
        });
    });

    return blocos;
}

// Fatia de anel elíptico entre os ângulos a0 e a1 (sentido horário)
function caminhoBlocoElipse(cx, cy, f, a0, a1) {
    const p = (rx, ry, a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    const n = (v) => v.toFixed(1);
    const [xo0, yo0] = p(f.rxo, f.ryo, a0);
    const [xo1, yo1] = p(f.rxo, f.ryo, a1);
    const [xi1, yi1] = p(f.rxi, f.ryi, a1);
    const [xi0, yi0] = p(f.rxi, f.ryi, a0);
    const grande = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${n(xo0)} ${n(yo0)} A ${f.rxo} ${f.ryo} 0 ${grande} 1 ${n(xo1)} ${n(yo1)} ` +
           `L ${n(xi1)} ${n(yi1)} A ${f.rxi} ${f.ryi} 0 ${grande} 0 ${n(xi0)} ${n(yi0)} Z`;
}

// Anel completo (usado nos setores que não são do ingresso, só como contexto)
function caminhoAnelElipse(cx, cy, f) {
    const el = (rx, ry) => `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
    return el(f.rxo, f.ryo) + ' ' + el(f.rxi, f.ryi);
}

function blocoTemAssentoEscolhido(bloco) {
    return bloco.linhas.some(l => l.lugares.some(a => assentoEstaEscolhido(a.id)));
}

// Tela 1: mapa do estádio com os blocos do setor
function renderizarMapaEstadio(grade, assentos) {
    _assentosEstadio = assentos;
    grade.innerHTML = '';

    const CX = 380, CY = 290;
    const chaveSetor = window._eventoAtual?.setor_chave || '';
    const blocos = dividirEmBlocos(assentos);

    const svg = svgEl('svg', {
        viewBox: '0 0 760 580',
        class: 'estadio-svg',
        role: 'group',
        'aria-label': 'Mapa do estádio por blocos'
    });

    // Setores que não são deste ingresso: só contexto, sem clique
    Object.entries(FAIXAS_ESTADIO).forEach(([chave, f]) => {
        if (chave === chaveSetor) return;
        if (chave === 'pista') {
            svg.appendChild(svgEl('ellipse', { cx: CX, cy: CY, rx: f.rxo, ry: f.ryo, class: 'estadio-faixa' }));
            svg.appendChild(svgEl('text', { x: CX, y: CY + 62, class: 'estadio-faixa-texto' }, NOME_FAIXA_ESTADIO[chave]));
        } else {
            svg.appendChild(svgEl('path', { d: caminhoAnelElipse(CX, CY, f), 'fill-rule': 'evenodd', class: 'estadio-faixa' }));
            svg.appendChild(svgEl('text', {
                x: CX, y: CY - (f.ryi + f.ryo) / 2 + 3, class: 'estadio-faixa-texto'
            }, NOME_FAIXA_ESTADIO[chave]));
        }
    });

    // Palco no centro
    svg.appendChild(svgEl('rect', { x: CX - 60, y: CY - 22, width: 120, height: 44, rx: 6, class: 'estadio-palco' }));
    svg.appendChild(svgEl('text', { x: CX, y: CY + 4, class: 'estadio-palco-texto' }, 'PALCO'));

    const v = VIP_RETANGULO;
    if (chaveSetor !== 'vip') {
        svg.appendChild(svgEl('rect', { x: v.x, y: v.y, width: v.w, height: v.h, rx: 10, class: 'estadio-faixa' }));
        svg.appendChild(svgEl('text', { x: v.x + v.w / 2, y: v.y + v.h / 2 + 3, class: 'estadio-faixa-texto' }, 'VIP'));
    }

    const adicionarBloco = (bloco, d, tx, ty) => {
        const esgotado = bloco.disponiveis === 0;
        const g = svgEl('g', {
            class: 'estadio-bloco' + (esgotado ? ' bloco-esgotado' : '') + (blocoTemAssentoEscolhido(bloco) ? ' bloco-com-selecao' : ''),
            role: 'button',
            tabindex: esgotado ? '-1' : '0',
            'aria-disabled': esgotado ? 'true' : 'false',
            'aria-label': `Bloco ${bloco.nome}, ${bloco.disponiveis} lugares disponíveis`
        });
        g.appendChild(svgEl('title', {}, `Bloco ${bloco.nome}: ${bloco.disponiveis} de ${bloco.total} lugares disponíveis`));
        g.appendChild(svgEl('path', { d }));
        g.appendChild(svgEl('text', { x: tx.toFixed(1), y: ty.toFixed(1) }, bloco.nome));

        if (!esgotado) {
            const abrir = () => renderizarBlocoEstadio(grade, bloco);
            g.addEventListener('click', abrir);
            g.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    abrir();
                }
            });
        }
        svg.appendChild(g);
    };

    if (chaveSetor === 'vip') {
        adicionarBloco(blocos[0], `M ${v.x} ${v.y} h ${v.w} v ${v.h} h ${-v.w} Z`, v.x + v.w / 2, v.y + v.h / 2);
    } else {
        const f = FAIXAS_ESTADIO[chaveSetor];
        const K = blocos.length;
        const passo = 2 * Math.PI / K;
        const folga = K > 1 ? 0.05 : 0.12; // corredor entre blocos
        const rxm = (f.rxi + f.rxo) / 2, rym = (f.ryi + f.ryo) / 2;

        blocos.forEach((bloco, j) => {
            const centro = -Math.PI / 2 + j * passo; // bloco 1 centrado no topo
            const d = caminhoBlocoElipse(CX, CY, f, centro - passo / 2 + folga / 2, centro + passo / 2 - folga / 2);
            adicionarBloco(bloco, d, CX + rxm * Math.cos(centro), CY + rym * Math.sin(centro));
        });
    }

    grade.appendChild(svg);
}

// Tela 2: fileiras e assentos do bloco escolhido
function renderizarBlocoEstadio(grade, bloco) {
    grade.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'bloco-detalhe';

    const topo = document.createElement('div');
    topo.className = 'bloco-detalhe-topo';

    const voltar = document.createElement('button');
    voltar.type = 'button';
    voltar.className = 'bloco-voltar';
    voltar.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar ao mapa';
    voltar.addEventListener('click', () => renderizarMapaEstadio(grade, _assentosEstadio));

    const titulo = document.createElement('div');
    titulo.className = 'bloco-detalhe-textos';
    titulo.innerHTML = `
        <div class="bloco-detalhe-titulo">Bloco ${bloco.nome}</div>
        <div class="bloco-detalhe-info">${bloco.disponiveis} lugares disponíveis. A fileira A é a mais próxima do palco.</div>`;

    topo.append(voltar, titulo);

    const gradeBloco = document.createElement('div');
    gradeBloco.className = 'bloco-grade';

    bloco.linhas.forEach(linha => {
        const row = document.createElement('div');
        row.className = 'assentos-fileira';

        const nome = document.createElement('span');
        nome.className = 'assentos-fileira-nome';
        nome.textContent = linha.letra;
        row.appendChild(nome);

        linha.lugares.forEach(a => {
            const rotulo = `${linha.letra}${a.numero}`;
            const livre = assentoDisponivel(a);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'assento' + (livre ? '' : ' assento-ocupado');
            btn.textContent = a.numero;
            btn.disabled = !livre;
            btn.dataset.id = a.id;
            btn.setAttribute('aria-label', `Assento ${rotulo}${livre ? '' : ', indisponível'}`);
            btn.setAttribute('aria-pressed', 'false');

            if (assentoEstaEscolhido(a.id)) {
                btn.classList.add('assento-selecionado');
                btn.setAttribute('aria-pressed', 'true');
            }

            if (livre) {
                btn.addEventListener('click', () => {
                    if (alternarAssento(a, rotulo)) sincronizarAssentosNaTela();
                });
            }

            row.appendChild(btn);
        });

        gradeBloco.appendChild(row);
    });

    wrap.append(topo, gradeBloco);
    grade.appendChild(wrap);
}

function renderizarGradeAssentos(assentos) {
    const grade = document.getElementById('modal-assentos-grade');
    if (!grade) return;
    grade.innerHTML = '';

    if (!assentos.length) {
        grade.innerHTML = '<p class="modal-assentos-msg">Nenhum assento cadastrado para este ingresso.</p>';
        return;
    }

    // Template arena (estádio): assentos em anéis em volta do palco.
    // Demais templates (teatro, casa de show, simples): grade reta por fileira.
    const modoEstadio = TEMPLATE_MAPA_ATUAL === 'arena' &&
        SETORES_COM_ASSENTO_ESTADIO.includes(window._eventoAtual?.setor_chave);
    const caixa = grade.closest('.modal-assentos-caixa');
    if (caixa) caixa.classList.toggle('modo-estadio', modoEstadio);
    if (modoEstadio) {
        montarContextoEstadio();
        renderizarMapaEstadio(grade, assentos);
        return;
    }
    document.getElementById('modal-assentos-contexto')?.replaceChildren();

    // Agrupa por fileira
    const porFileira = new Map();
    assentos.forEach(a => {
        const chave = String(a.fileira);
        if (!porFileira.has(chave)) porFileira.set(chave, []);
        porFileira.get(chave).push(a);
    });

    const fileiras = [...porFileira.keys()].sort((a, b) => {
        const na = Number(a), nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b, 'pt-BR');
    });

    fileiras.forEach(chaveFileira => {
        const linha = document.createElement('div');
        linha.className = 'assentos-fileira';

        const nomeFileira = document.createElement('span');
        nomeFileira.className = 'assentos-fileira-nome';
        nomeFileira.textContent = rotuloFileira(chaveFileira);
        linha.appendChild(nomeFileira);

        const lugares = porFileira.get(chaveFileira)
            .sort((a, b) => Number(a.numero) - Number(b.numero));

        lugares.forEach(a => {
            const rotulo = `${rotuloFileira(a.fileira)}${a.numero}`;
            const livre = assentoDisponivel(a);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'assento' + (livre ? '' : ' assento-ocupado');
            btn.textContent = a.numero;
            btn.disabled = !livre;
            btn.dataset.id = a.id;
            btn.setAttribute('aria-label', `Assento ${rotulo}${livre ? '' : ', indisponível'}`);
            btn.setAttribute('aria-pressed', 'false');

            if (assentoEstaEscolhido(a.id)) {
                btn.classList.add('assento-selecionado');
                btn.setAttribute('aria-pressed', 'true');
            }

            if (livre) {
                btn.addEventListener('click', () => {
                    if (alternarAssento(a, rotulo)) sincronizarAssentosNaTela();
                });
            }

            linha.appendChild(btn);
        });

        grade.appendChild(linha);
    });
}

async function carregarAssentos(ingressoId) {
    const grade = document.getElementById('modal-assentos-grade');
    if (!grade) return;
    grade.innerHTML = '<p class="modal-assentos-msg">Carregando assentos...</p>';

    try {
        const res = await fetch(`${API_BASE}/assentos/${encodeURIComponent(ingressoId)}`);
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const dados = await res.json();
        const lista = Array.isArray(dados) ? dados : (dados.assentos || []);
        renderizarGradeAssentos(lista);
    } catch (err) {
        console.error('Erro ao carregar assentos:', err);
        grade.innerHTML = '<p class="modal-assentos-msg modal-assentos-erro">Não foi possível carregar os assentos. Tente novamente.</p>';
    }
}

function abrirModalAssentos() {
    const e = window._eventoAtual;
    if (!e || !e.tipo_ingresso_id) return;

    const overlay = garantirModalAssentos();
    _assentosEscolhidos = [];
    _assentosReservados = new Set();
    atualizarRodapeAssentos();

    overlay.classList.add('aberto');
    document.body.style.overflow = 'hidden';

    _modalAssentosTecla = (ev) => { if (ev.key === 'Escape') fecharModalAssentos(); };
    document.addEventListener('keydown', _modalAssentosTecla);

    carregarAssentos(e.tipo_ingresso_id);
}

function fecharModalAssentos() {
    const overlay = document.getElementById('modal-assentos');
    if (overlay) overlay.classList.remove('aberto');
    document.body.style.overflow = '';
    if (_modalAssentosTecla) {
        document.removeEventListener('keydown', _modalAssentosTecla);
        _modalAssentosTecla = null;
    }
}

async function confirmarAssento() {
    const e = window._eventoAtual;
    if (!_assentosEscolhidos.length || !e) return;

    const min = Math.min(e.minQuantidade || 1, e.maxQuantidade || 1);
    if (_assentosEscolhidos.length < min) {
        mostrarAviso(`Escolha pelo menos ${min} assentos para este ingresso.`, 'warn', 'Quantidade mínima');
        return;
    }

    const usuarioId = obterUsuarioId();
    if (!usuarioId) {
        mostrarAviso('Entre na sua conta para reservar os assentos.', 'warn', 'Login necessário');
        setTimeout(() => { window.location.href = '/frontend/login/login.html'; }, 1800);
        return;
    }

    const btn = document.getElementById('modal-assentos-confirmar');
    btn.disabled = true;
    btn.textContent = 'Reservando...';

    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Reserva um por um; os que já foram reservados antes de uma falha não são reservados de novo
        for (const assento of [..._assentosEscolhidos]) {
            if (_assentosReservados.has(String(assento.id))) continue;

            const res = await fetch(`${API_BASE}/assentos/${encodeURIComponent(assento.id)}/reservar`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ usuario_id: usuarioId })
            });
            const data = await res.json().catch(() => ({}));

            if (res.status === 401) {
                mostrarAviso('Sua sessão expirou. Entre novamente para reservar os assentos.', 'warn', 'Sessão expirada');
                atualizarRodapeAssentos();
                setTimeout(() => { window.location.href = '/frontend/login/login.html'; }, 1800);
                return;
            }

            if (!res.ok) {
                const titulo = res.status === 409 ? `Assento ${assento.rotulo} indisponível` : 'Não foi possível reservar';
                mostrarAviso(data.erro || 'Escolha outro assento e tente novamente.', res.status >= 500 ? 'error' : 'warn', titulo);
                // Tira só o que falhou; os já reservados continuam marcados
                _assentosEscolhidos = _assentosEscolhidos.filter(s => String(s.id) !== String(assento.id));
                atualizarRodapeAssentos();
                carregarAssentos(e.tipo_ingresso_id);
                return;
            }

            _assentosReservados.add(String(assento.id));
        }

        e.assento_ids = _assentosEscolhidos.map(s => s.id);
        e.assento_rotulos = _assentosEscolhidos.map(s => s.rotulo);
        e.quantidade = e.assento_ids.length;
        salvarEstadoCompra();

        const resumo = document.querySelector('.ingresso-resumo');
        if (resumo) resumo.textContent = `${e.ingressoNome} - ${e.assento_rotulos.join(', ')}`;
        atualizarResumo();

        fecharModalAssentos();
        realizarAcaoComprar(); // agora com assento_ids, segue para o checkout
    } catch (err) {
        console.error('Erro ao reservar assentos:', err);
        mostrarAviso('Não conseguimos falar com o servidor. Tente novamente em instantes.', 'error', 'Erro de conexão');
        atualizarRodapeAssentos();
    }
}

// Confirmar presença = compra de ingresso gratuito: registra a venda no
// backend (onde valem as travas de CPF e de quantidade) antes de redirecionar.
async function confirmarPresencaGratuita(dados) {
    const usuarioId = obterUsuarioId();
    if (!usuarioId) {
        mostrarAviso('Entre na sua conta para confirmar presença neste evento.', 'warn', 'Login necessário');
        setTimeout(() => { window.location.href = '/frontend/login/login.html'; }, 1800);
        return;
    }
    if (!dados.evento_id || !dados.tipo_ingresso_id) {
        mostrarAviso('Selecione o ingresso novamente e tente de novo.', 'warn', 'Ingresso não identificado');
        return;
    }

    const botoes = document.querySelectorAll('.botao-comprar, .botao-comprar-topo');
    const restaurar = () => botoes.forEach(b => {
        b.disabled = false;
        b.textContent = 'Confirmar Presença';
    });
    botoes.forEach(b => { b.disabled = true; b.textContent = 'Confirmando...'; });

    try {
        const res = await fetch(`${API_BASE}/ingressos/comprar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuarioId,
                evento_id: dados.evento_id,
                itens: [{ tipo_ingresso_id: dados.tipo_ingresso_id, quantidade: dados.quantidade || 1 }]
            })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const titulo = res.status === 409 ? 'Limite por CPF atingido' : 'Não foi possível confirmar';
            const tipo = res.status >= 500 ? 'error' : 'warn';
            mostrarAviso(data.erro || 'Tente novamente em instantes.', tipo, titulo);
            restaurar();
            return;
        }

        window.location.href = '/frontend/detalheseventos/presencaconfirmada.html';
    } catch (err) {
        console.error('Erro ao confirmar presença:', err);
        mostrarAviso('Não conseguimos falar com o servidor. Tente novamente em instantes.', 'error', 'Erro de conexão');
        restaurar();
    }
}
async function realizarAcaoComprar() {
    const botaoComprar = document.querySelector('.botao-comprar');
    if (botaoComprar && botaoComprar.disabled) return;

    const opcaoPai = document.querySelector('.opcao-ingresso.selecionado');
    if (!opcaoPai) {
        const container = document.querySelector('.ingressos-disponiveis');
        const aviso = document.getElementById('aviso-selecao-ingresso');
        if (container) container.classList.add('destaque-erro');
        if (aviso) aviso.style.display = 'block';
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Proteção extra: não deixa avançar com ingresso indisponível
    if (opcaoPai.dataset.status && opcaoPai.dataset.status !== 'disponivel') {
        alert('Este ingresso não está disponível para compra.');
        return;
    }

    // Ingresso numerado: sem assento reservado, abre a escolha de assento primeiro
    if (window._eventoAtual?.tipo_selecao === 'numerado' && !(window._eventoAtual?.assento_ids?.length)) {
        abrirModalAssentos();
        return;
    }

    const nomeIngresso = opcaoPai.dataset.nome || opcaoPai.querySelector('.nome-ingresso').textContent;
    const precoNumerico = Number(opcaoPai.dataset.preco) || 0;

    const dadosParaCheckout = {
        ...(window._eventoAtual || {}),
        ingressoNome: nomeIngresso,
        ingressoPreco: precoNumerico,
        evento_id: window._eventoAtual?.evento_id,
        tipo_ingresso_id: opcaoPai?.dataset?.id || window._eventoAtual?.tipo_ingresso_id,
        quantidade: QUANTIDADE_HABILITADA ? (window._eventoAtual?.quantidade || 1) : 1
    };

    localStorage.setItem('eventoSelecionado', JSON.stringify(dadosParaCheckout));
       window.location.href = '/frontend/detalheseventos/finalizarcompra.html';
}

function inicializarAcaoBotaoComprar() {
    document.querySelectorAll('.botao-comprar, .botao-comprar-topo').forEach(botao => {
        botao.addEventListener('click', realizarAcaoComprar);
    });
}
document.addEventListener('DOMContentLoaded', async function () {
    await carregarDetalhesEvento();
    inicializarAcaoBotaoComprar();
    inicializarControlesQuantidade();

    const botaoMobile = document.querySelector('.barra-compra-botao');
    if (botaoMobile) botaoMobile.addEventListener('click', realizarAcaoComprar);

    // ── Registra visita ──
    const userId = localStorage.getItem('userId');
    if (userId && window._eventoAtual) {
        const e = window._eventoAtual;
        fetch(`${API_BASE}/visitas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: userId,
                nome: e.nome || 'Evento',
                nome_local: e.local || '',
                data_visita: new Date().toISOString().split('T')[0],
                tipo: 'evento',
                item_id: e.evento_id || 0,
                imagem: e.imagem || '',
                url: window.location.href
            })
        }).catch(() => { });

        // ── ADICIONADO: registra clique para o sistema de recomendação ──
        // Toda vez que o usuário abre a página de detalhes de um evento,
        // isso conta como um "clique" naquela categoria — é o dado que
        // alimenta o recomendacaoService.js.
        fetch(`${API_BASE}/recomendacoes/interacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: userId,
                eventoId: e.evento_id || null,
                tipo: 'clique',
                categoria: e.categoria || null
            })
        }).catch(() => { });
    }
});

/* ═══════════════════════════════════════════
   AVALIAÇÕES DO EVENTO
═══════════════════════════════════════════ */
let _notaEvento = 0;

function setupStarSelectorEvento() {
    const stars = document.querySelectorAll('.star-evt');
    if (!stars.length) return;

    function pintar(ate) {
        stars.forEach((s, i) => {
            s.textContent = i < ate ? '★' : '☆';
            s.style.color = i < ate ? '#f59e0b' : '#d1d5db';
        });
    }

    stars.forEach(s => {
        s.addEventListener('mouseenter', () => pintar(+s.dataset.val));
        s.addEventListener('mouseleave', () => pintar(_notaEvento));
        s.addEventListener('click', () => { _notaEvento = +s.dataset.val; pintar(_notaEvento); });
    });
}

function estrelasHTMLEvento(nota) {
    return Array.from({ length: 5 }, (_, i) =>
        `<span style="color:${i < nota ? '#f59e0b' : '#e5e7eb'};font-size:14px;">★</span>`
    ).join('');
}

async function carregarAvaliacoesEvento(eventoId) {
    const container = document.getElementById('review-list-evento');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;font-size:13px;">Carregando avaliações...</p>';

    try {
        const res = await fetch(`${API_BASE}/avaliacoes?evento_id=${eventoId}`);
        const lista = await res.json();

        container.innerHTML = '';

        if (!Array.isArray(lista) || !lista.length) {
            container.innerHTML = '<p class="sem-avaliacoes">Nenhuma avaliação para este evento. Seja o primeiro!</p>';
            return;
        }

        const total = lista.length;
        const media = (lista.reduce((acc, r) => acc + Number(r.nota), 0) / total).toFixed(1);
        const avgEl = document.getElementById('avg-display-evento');
        if (avgEl) avgEl.textContent = `${media} (${total} avaliação${total !== 1 ? 'ões' : ''})`;

        lista.forEach(r => {
            const nome = r.nome_autor || 'Anônimo';
            const data = r.created_at
                ? new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '';
            const cores = ['#6c63ff', '#e63946', '#2a9d8f', '#e9c46a', '#f4a261', '#264653'];
            const cor = cores[(nome.charCodeAt(0) || 0) % cores.length];
            const inicial = nome[0].toUpperCase();

            const div = document.createElement('div');
            div.style.cssText = 'display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #f0f0f5;';
            div.innerHTML = `
                <div style="width:38px;height:38px;border-radius:50%;background:${cor};color:#fff;
                            display:flex;align-items:center;justify-content:center;
                            font-weight:700;font-size:15px;flex-shrink:0;">${inicial}</div>
                <div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                        <span style="font-weight:600;font-size:14px;color:#1a1a2e;">${nome}</span>
                        <span>${estrelasHTMLEvento(r.nota)}</span>
                        <span style="font-size:12px;color:#999;">${data}</span>
                    </div>
                    ${r.comentario ? `<p style="margin:0;font-size:13px;color:#555;line-height:1.5;">${r.comentario}</p>` : ''}
                </div>`;
            container.appendChild(div);
        });

    } catch (err) {
        console.error('Erro ao carregar avaliações do evento:', err);
        container.innerHTML = '<p style="color:#dc2626;font-size:13px;">Erro ao carregar avaliações.</p>';
    }
}

async function enviarAvaliacaoEvento() {
    if (_notaEvento === 0) { alert('Selecione pelo menos 1 estrela.'); return; }

    const params = new URLSearchParams(window.location.search);
    const eventoId = params.get('id');
    const nome = document.getElementById('review-name-evento')?.value.trim()
        || localStorage.getItem('profileName')
        || 'Anônimo';
    const texto = document.getElementById('review-text-evento')?.value.trim() || '';

    try {
        const res = await fetch(`${API_BASE}/avaliacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evento_id: eventoId, nota: _notaEvento, comentario: texto, nome_autor: nome })
        });
        if (!res.ok) throw new Error('Erro ao enviar');

        _notaEvento = 0;
        document.querySelectorAll('.star-evt').forEach(s => { s.textContent = '☆'; s.style.color = '#d1d5db'; });
        document.getElementById('review-text-evento').value = '';
        await carregarAvaliacoesEvento(eventoId);
    } catch (err) {
        alert('Não foi possível enviar a avaliação.');
    }
}