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

// Setores conhecidos (mesma chave do data-setor do SVG do mapa)
const SETORES = [
    { chave: 'arquibancada',     nome: 'Arquibancada',     dot: 'dot-arquibancada' },
    { chave: 'cadeira superior', nome: 'Cadeira Superior', dot: 'dot-cadeira-superior' },
    { chave: 'cadeira inferior', nome: 'Cadeira Inferior', dot: 'dot-cadeira-inferior' },
    { chave: 'pista',            nome: 'Pista',            dot: 'dot-pista' },
    { chave: 'vip',              nome: 'VIP',              dot: 'dot-vip' }
];

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

function atualizarBotaoDeCompra(precoNumerico) {
    const botoes = document.querySelectorAll('.botao-comprar, .botao-comprar-topo');
    if (!botoes.length) return;

    botoes.forEach(botaoComprar => {
        // Reabilita o botão (pode ter sido desabilitado por um status)
        botaoComprar.disabled = false;

        if (precoNumerico === 0) {
            botaoComprar.textContent = 'Confirmar Presença';
            botaoComprar.classList.add('botao-confirmar');
            botaoComprar.classList.remove('botao-comprar-padrao');
        } else {
            botaoComprar.textContent = 'Comprar Ingresso';
            botaoComprar.classList.remove('botao-confirmar');
            botaoComprar.classList.add('botao-comprar-padrao');
        }
    });
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

    document.getElementById('resumo-linha-ingresso').textContent = `${qtd}x ${e.ingressoNome}`;
    document.getElementById('resumo-subtotal').textContent = formatarMoeda(subtotal);
    document.getElementById('resumo-taxa').textContent = formatarMoeda(taxa);
    total.textContent = formatarMoeda(subtotal + taxa);
    atualizarBarraMobile(total.textContent);

    if (bloco) bloco.style.display = '';

    if (seletor) seletor.style.display = QUANTIDADE_HABILITADA ? '' : 'none';
    if (QUANTIDADE_HABILITADA) {
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

    e.ingressoNome = nome;
    e.ingressoPreco = preco;
    e.tipo_ingresso_id = id;
    e.maxQuantidade = Math.max(1, Math.min(disponiveis, MAX_POR_COMPRA));
    e.quantidade = 1;
    salvarEstadoCompra();

    const resumo = document.querySelector('.ingresso-resumo');
    if (resumo) resumo.textContent = nome;

    atualizarBotaoDeCompra(preco);
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

    const descricao = ingresso.tipo === 'gratuito'
        ? '<p class="descricao-ingresso">Entrada gratuita</p>'
        : '';

    const classes = [
        'opcao-ingresso',
        isSelecionado ? 'selecionado' : '',
        extra ? 'ingresso-extra' : '',
        indisponivel ? 'indisponivel' : ''
    ].filter(Boolean).join(' ');

    return `
        <div class="${classes}" role="radio" aria-checked="${isSelecionado}" aria-disabled="${indisponivel}" tabindex="${indisponivel ? -1 : 0}" data-idx="${index}" data-tipo="${escaparAtributo(ingresso.titulo)}" data-nome="${escaparAtributo(ingresso.titulo)}" data-id="${ingresso.id}" data-status="${status}" data-preco="${preco}" data-disponiveis="${disponiveis}" data-escassez="${escassez}">
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
            categoria: evento.categoria || null // ← usado pelo sistema de recomendação (recomendacaoService.js)
        };

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

function realizarAcaoComprar() {
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

    if (botaoComprar.classList.contains('botao-confirmar')) {
        window.location.href = '/frontend/detalheseventos/presencaconfirmada.html';
    } else {
        window.location.href = '/frontend/detalheseventos/finalizarcompra.html';
    }
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