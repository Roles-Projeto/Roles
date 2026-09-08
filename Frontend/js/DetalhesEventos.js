const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = isLocal ? "http://localhost:3000" : window.location.origin; // ← ADICIONA
const API_URL = isLocal ? "http://localhost:3000/eventos" : "/eventos";
function atualizarBotaoDeCompra(precoNumerico, precoFormatado) {
    const botaoComprar = document.querySelector('.botao-comprar');
    const valorIngressoElement = document.querySelector('.card-garantia-ingresso .valor-ingresso');
    if (!botaoComprar || !valorIngressoElement) return;

    if (precoNumerico === 0) {
        botaoComprar.textContent = 'Confirmar Presença';
        botaoComprar.classList.add('botao-confirmar');
        botaoComprar.classList.remove('botao-comprar-padrao');
        valorIngressoElement.textContent = 'Grátis';
    } else {
        botaoComprar.textContent = 'Comprar Ingresso';
        botaoComprar.classList.remove('botao-confirmar');
        botaoComprar.classList.add('botao-comprar-padrao');
        valorIngressoElement.textContent = precoFormatado;
    }
}

function inicializarLogicaSelecao() {
    const botoesSelecionar = document.querySelectorAll('.botao-selecionar');
    const tipoIngressoResumo = document.querySelector('.ingresso-resumo');
    if (!botoesSelecionar.length || !tipoIngressoResumo) return;

    botoesSelecionar.forEach(botao => {
        botao.addEventListener('click', (event) => {
            botoesSelecionar.forEach(btn => {
                btn.classList.remove('selecionado');
                btn.textContent = 'Selecionar';
            });

            const botaoClicado = event.currentTarget;
            botaoClicado.classList.add('selecionado');
            botaoClicado.textContent = 'Selecionado';

            const opcaoPai = botaoClicado.closest('.opcao-ingresso');
            const nomeIngresso = opcaoPai.querySelector('.nome-ingresso').textContent;
            const precoTexto = opcaoPai.querySelector('.preco-ingresso').textContent;
            const precoNumerico = parseFloat(precoTexto.replace('R$', '').replace(',', '.').trim()) || 0;

            // Atualiza ingresso selecionado no estado global
            if (window._eventoAtual) {
                window._eventoAtual.ingressoNome = nomeIngresso;
                window._eventoAtual.ingressoPreco = precoNumerico;
                window._eventoAtual.tipo_ingresso_id = opcaoPai.dataset.id || window._eventoAtual.tipo_ingresso_id;
                localStorage.setItem('eventoSelecionado', JSON.stringify(window._eventoAtual));
            }

            tipoIngressoResumo.textContent = nomeIngresso;
            atualizarBotaoDeCompra(precoNumerico, precoTexto);
        });
    });
}

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

        document.querySelector('.data-hora-cabecalho').innerHTML =
            `${dataFormatada} <span class="separador-cabecalho">•</span> ${horaFormatada}`;

        const precoMinimo = evento.ingressos && evento.ingressos.length
            ? Math.min(...evento.ingressos.map(i => parseFloat(i.valor) || 0))
            : (parseFloat(evento.preco_minimo) || 0);

        document.querySelector('.valor-minimo').textContent =
            precoMinimo > 0 ? `R$ ${precoMinimo.toFixed(2).replace('.', ',')}` : 'Grátis';
        document.querySelector('.por-pessoas').textContent =
            precoMinimo > 0 ? '+ 10% taxa' : 'por pessoa';

        // Sobre o evento
        document.querySelector('.descricao-evento').textContent = evento.descricao || '';
        document.querySelector('.nome-local').textContent = evento.local_nome || '';
        document.querySelector('.endereco-local').textContent = evento.cidade || '';
        document.querySelector('.numero-confirmados').textContent = `${evento.confirmados || 0} pessoas`;

        // Resumo lateral
        document.querySelector('.data-resumo').textContent = dataFormatada;
        document.querySelector('.hora-resumo').textContent = horaFormatada;
        document.querySelector('.local-resumo').textContent = evento.local_nome || '';

        // Organizador
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

        // Ingressos
        const ingressosContainer = document.querySelector('.ingressos-disponiveis');
        const loadingIngressos = document.getElementById('loading-ingressos');
        if (loadingIngressos) loadingIngressos.remove();

        const ingressos = (evento.ingressos && evento.ingressos.length > 0)
            ? evento.ingressos
            : [{ titulo: 'Ingresso Geral', tipo: 'gratuito', valor: 0, quantidade_total: 100 }];

        ingressos.forEach((ingresso, index) => {
            const preco = parseFloat(ingresso.valor) || 0;
            const precoFormatado = preco > 0 ? `R$ ${preco.toFixed(2).replace('.', ',')}` : 'R$ 0,00';
            const total = ingresso.quantidade_total ?? 100;
            const isSelecionado = index === 0;

            const html = `
                <div class="opcao-ingresso" data-tipo="${ingresso.titulo}" data-id="${ingresso.id}">
                    <div class="detalhes-opcao">
                        <h4 class="nome-ingresso">${ingresso.titulo}</h4>
                        <p class="descricao-ingresso">${ingresso.tipo === 'gratuito' ? 'Entrada gratuita' : 'Ingresso pago'}</p>
                        <div class="status-vendas">
                            <span class="quantidade-restante">${total} disponíveis</span>
                            <div class="barra-progresso">
                                <div class="progresso" style="width: 100%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="acao-opcao">
                        <span class="preco-ingresso">${precoFormatado}</span>
                        <button class="botao-selecionar ${isSelecionado ? 'selecionado' : ''}" data-tipo="${ingresso.titulo}">
                            ${isSelecionado ? 'Selecionado' : 'Selecionar'}
                        </button>
                    </div>
                </div>`;

            if (ingressosContainer) ingressosContainer.insertAdjacentHTML('beforeend', html);

            if (isSelecionado) {
                document.querySelector('.ingresso-resumo').textContent = ingresso.titulo;
                atualizarBotaoDeCompra(preco, precoFormatado);
                window._eventoAtual = {
                    nome: evento.nome,
                    data: dataFormatada,
                    hora: horaFormatada,
                    local: evento.local_nome || '',
                    imagem: evento.imagem || '',
                    ingressoNome: ingresso.titulo,
                    ingressoPreco: preco,
                    evento_id: evento.id,       // ← ID do evento
                    tipo_ingresso_id: ingresso.id      // ← ID do tipo de ingresso
                };
                localStorage.setItem('eventoSelecionado', JSON.stringify(window._eventoAtual));
            }
        }); // ← fecha forEach

        inicializarLogicaSelecao();

    } catch (err) {
        console.error('Erro ao carregar evento:', err);
        document.querySelector('.titulo-evento').textContent = 'Erro ao carregar evento';
        document.querySelector('.descricao-evento').textContent = 'Não foi possível buscar os dados. Verifique o servidor.';
    }
}

function realizarAcaoComprar() {
    const ingressoSelecionado = document.querySelector('.opcao-ingresso .botao-selecionar.selecionado');
    if (!ingressoSelecionado) {
        alert('Por favor, selecione um ingresso antes de prosseguir.');
        return;
    }

    const opcaoPai = ingressoSelecionado.closest('.opcao-ingresso');
    const nomeIngresso = opcaoPai.querySelector('.nome-ingresso').textContent;
    const precoTexto = opcaoPai.querySelector('.preco-ingresso').textContent;
    const precoNumerico = parseFloat(precoTexto.replace('R$', '').replace(',', '.').trim()) || 0;

    const dadosParaCheckout = {
        ...(window._eventoAtual || {}),
        ingressoNome: nomeIngresso,
        ingressoPreco: precoNumerico,
        evento_id: window._eventoAtual?.evento_id,
        tipo_ingresso_id: opcaoPai?.dataset?.id || window._eventoAtual?.tipo_ingresso_id
    };

    localStorage.setItem('eventoSelecionado', JSON.stringify(dadosParaCheckout));

    const botaoComprar = document.querySelector('.botao-comprar');
    if (botaoComprar.classList.contains('botao-confirmar')) {
        window.location.href = '/frontend/detalheseventos/presencaconfirmada.html';
    } else {
        window.location.href = '/frontend/detalheseventos/finalizarcompra.html';
    }
}

function inicializarAcaoBotaoComprar() {
    const botaoComprar = document.querySelector('.botao-comprar');
    if (botaoComprar) {
        botaoComprar.addEventListener('click', realizarAcaoComprar);
    }
}
document.addEventListener('DOMContentLoaded', async function () {
    await carregarDetalhesEvento();
    inicializarAcaoBotaoComprar();

    // ── Avaliações ──
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('id');
    if (eventId) await carregarAvaliacoesEvento(eventId);
    setupStarSelectorEvento();

    const nomeLogado = localStorage.getItem('profileName');
    if (nomeLogado) {
        const inputNome = document.getElementById('review-name-evento');
        if (inputNome) { inputNome.value = nomeLogado; inputNome.readOnly = true; }
    }

    // ── Registra visita ──

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