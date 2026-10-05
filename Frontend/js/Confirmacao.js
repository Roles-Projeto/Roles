"use strict";

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════
    // CONFIG — mesmo padrão de BASE_URL usado no resto do projeto
    // ════════════════════════════════════════════════════════════════
    const BASE_URL = window.API_BASE_URL || window.API_BASE || "";

    const LOGO_PATH = '/frontend/imagens/logo-roles.png';

    // ════════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════════
    function el(id) { return document.getElementById(id); }

    function fmtBRL(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
    }

    function mostrarToast(msg) {
        const toast = el('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function resolveImagem(caminho) {
        if (!caminho) return null;
        if (caminho.startsWith('http')) return caminho;
        if (caminho.startsWith('/uploads/')) return `${BASE_URL}${caminho}`;
        return `${BASE_URL}/uploads/${caminho}`;
    }

    // Evita injetar HTML cru vindo da API (ex: nomes de benefícios)
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ════════════════════════════════════════════════════════════════
    // FONTE DOS DADOS
    // ════════════════════════════════════════════════════════════════
    function lerCompraDaSessao() {
        try {
            const raw = sessionStorage.getItem('compraConfirmada');
            if (!raw) return null;
            const dados = JSON.parse(raw);
            return dados.pedido_id ? dados : null;
        } catch (e) {
            console.warn('[Confirmacao] sessionStorage inválido:', e);
            return null;
        }
    }

    async function buscarCompraDaApi(pedidoId) {
        const resp = await fetch(`${BASE_URL}/pedidos/${pedidoId}`, { credentials: 'include' });
        if (!resp.ok) throw new Error(`status ${resp.status}`);
        const data = await resp.json();

        const evento = data.evento || data;
        const dataInicio = evento.data_inicio || evento.data_evento;
        const dt = dataInicio ? new Date(dataInicio) : null;

        return {
            pedido_id: pedidoId,
            status: data.status,
            nome: evento.titulo || evento.nome || data.nome,
            data: dt ? dt.toLocaleDateString('pt-BR') : (data.data || '—'),
            hora: dt ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : (data.hora || '—'),
            local: evento.local_nome || data.local,
            imagem: evento.imagem || evento.img_capa,
            ingressoNome: (data.ingresso || {}).nome || data.ingressoNome,
            ingressoPreco: (data.ingresso || {}).preco ?? data.ingressoPreco,
            quantidade: data.quantidade,
            subtotal: data.subtotal,
            taxaServico: data.taxaServico ?? data.taxa_servico,
            totalPago: data.totalPago ?? data.total_pago,
            forma_pagamento: data.forma_pagamento,
            beneficios: data.beneficios || (data.ingresso || {}).beneficios || [],
            pix_copia_cola: data.pix_copia_cola,
            boleto_url: data.boleto_url,
            pagamento_expira_em: data.pagamento_expira_em,
        };
    }

    async function carregarCompra() {
        let dados = lerCompraDaSessao();

        if (!dados) {
            const params = new URLSearchParams(location.search);
            const pedidoId = params.get('pedido') || params.get('pedido_id');
            if (pedidoId) {
                try {
                    dados = await buscarCompraDaApi(pedidoId);
                } catch (err) {
                    console.error('[Confirmacao] erro ao buscar pedido na API:', err);
                }
            }
        }

        if (!dados) {
            mostrarErro('Não encontramos sua compra. Volte e tente novamente.');
            return;
        }

        preencherTela(dados);
    }

    function mostrarErro(msg) {
        el('confirmacao-loading').style.display = 'none';
        const erro = el('confirmacao-erro');
        erro.style.display = 'flex';
        erro.querySelector('p').textContent = msg;
    }

    // ════════════════════════════════════════════════════════════════
    // PREENCHE A TELA
    // ════════════════════════════════════════════════════════════════
    function preencherTela(dados) {
        const pedidoId = dados.pedido_id;
        const pendente = String(dados.status || '').toLowerCase() === 'pendente';
        const gratuito = String(dados.forma_pagamento || '').toLowerCase() === 'gratuito';

        document.title = `Compra Confirmada — ${dados.nome || 'Rolês'}`;

        if (pendente) {
            el('checkmark-box').classList.add('is-pendente');
            el('hero-checkmark-icon').className = 'fas fa-clock';
            el('hero-titulo').textContent = 'Pedido recebido!';
            el('hero-subtitulo').textContent = 'Assim que o pagamento for confirmado, seu ingresso é liberado.';
            mostrarPagamentoPendente(dados);
        }

        el('pedido-id').textContent = `Pedido #${pedidoId}`;
        el('pedido-id-qr').textContent = `#${pedidoId}`;

        const img = el('event-image');
        const srcImagem = resolveImagem(dados.imagem);
        if (srcImagem) {
            img.src = srcImagem;
            img.onerror = () => { img.style.display = 'none'; };
        } else {
            img.style.display = 'none';
        }

        el('nome-evento').textContent = dados.nome || 'Evento';
        el('data-evento').textContent = dados.data || '—';
        el('hora-evento').textContent = dados.hora || '—';
        el('local-evento').textContent = dados.local || '—';

        el('tipo-ingresso').textContent = dados.ingressoNome || '—';
        el('preco-unitario').textContent = `${fmtBRL(dados.ingressoPreco)} cada`;
        el('qtd').textContent = dados.quantidade || 1;

        el('subtotal').textContent = fmtBRL(dados.subtotal);
        el('taxa').textContent = fmtBRL(dados.taxaServico);
        el('total-pago').textContent = fmtBRL(dados.totalPago);

        const formas = { credito: 'Cartão de Crédito', cartao: 'Cartão de Crédito', pix: 'PIX', boleto: 'Boleto Bancário' };
        el('forma-pagamento').textContent = formas[String(dados.forma_pagamento).toLowerCase()] || dados.forma_pagamento || '—';

        // Lista de benefícios do ingresso (camarote, open bar, brinde etc.)
        const beneficios = Array.isArray(dados.beneficios) ? dados.beneficios.filter(Boolean) : [];
        const benefitsList = el('benefits-list');
        if (beneficios.length > 0 && benefitsList) {
            benefitsList.innerHTML = beneficios
                .map(b => `<li><i class="fas fa-check-circle"></i>${escapeHtml(b)}</li>`)
                .join('');
            benefitsList.style.display = '';
        }

        // QR code do ingresso — fica bloqueado enquanto o pagamento está pendente
        const qrImg = el('qr-code-img');
        const qrFallback = el('qr-fallback-icon');
        const qrLockedLabel = el('qr-locked-label');

        if (pendente) {
            qrImg.style.display = 'none';
            qrFallback.innerHTML = '<i class="fas fa-lock"></i>';
            qrFallback.classList.add('is-locked');
            qrFallback.style.display = 'flex';
            if (qrLockedLabel) qrLockedLabel.style.display = 'block';
        } else {
            qrImg.onerror = () => { qrImg.style.display = 'none'; qrFallback.style.display = 'flex'; };
            qrImg.onload = () => { qrFallback.style.display = 'none'; };
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('ROLES-PEDIDO-' + pedidoId)}`;
        }

        // Ingresso gratuito: sem preço, taxa nem forma de pagamento
        if (gratuito) {
            document.title = `Presença confirmada — ${dados.nome || 'Rolês'}`;
            el('hero-titulo').textContent = 'Você está confirmado!';
            el('hero-subtitulo').textContent = 'Sua presença está garantida. Bom rolê!';

            const cardPagamento = document.querySelector('.pagamento-card .price-summary');
            if (cardPagamento) cardPagamento.style.display = 'none';
            const labelPagamento = document.querySelector('.pagamento-card .pagamento-label');
            if (labelPagamento) labelPagamento.style.display = 'none';
            const tituloPagamento = document.querySelector('.pagamento-card .section-title');
            if (tituloPagamento) tituloPagamento.textContent = 'Seu ingresso';

        }

        // Novo layout vale para todos: o clima vira etiqueta no ingresso e os lembretes viram ações rápidas
        const infoCard = document.querySelector('.info-card');
        if (infoCard) infoCard.style.display = 'none';
        const climaCard = el('clima-card');
        if (climaCard) climaCard.style.display = 'none';
        montarExperienciaGratuita(dados, pendente);

        el('btn-ver-ingressos').href = '/frontend/perfil/perfil.html?section=ingressos';

        el('confirmacao-loading').style.display = 'none';
        const conteudo = el('conteudo-confirmacao');
        conteudo.style.display = 'block';
        requestAnimationFrame(() => conteudo.classList.add('is-visible'));

        inicializarClima(dados.local, true);
        configurarAcoes(pedidoId, pendente, dados);
    }

    // ════════════════════════════════════════════════════════════════
    // EXPERIÊNCIA DO INGRESSO GRATUITO
    // ════════════════════════════════════════════════════════════════
    function lerDataEvento(texto) {
        const s = String(texto || '');

        let m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
        if (m) return { d: Number(m[1]), mo: Number(m[2]), y: Number(m[3]) };

        // Formato "qua., 28 de out." (sem ano): usa a proxima ocorrencia da data
        const meses = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        m = /(\d{1,2})\s+de\s+([a-zç]{3})/i.exec(s);
        if (!m) return null;
        const mo = meses[m[2].toLowerCase()];
        if (!mo) return null;

        const hoje = new Date();
        const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        let y = hoje.getFullYear();
        if (new Date(y, mo - 1, Number(m[1])) < inicioHoje) y += 1;
        return { d: Number(m[1]), mo, y };
    }

    function montarLinkCalendario(dados) {
        const data = lerDataEvento(dados.data);
        const h = /(\d{1,2}):(\d{2})/.exec(String(dados.hora || ''));
        if (!data || !h) return null;

        const p = n => String(n).padStart(2, '0');
        const ini = `${data.y}${p(data.mo)}${p(data.d)}T${p(h[1])}${h[2]}00`;
        const fimDate = new Date(data.y, data.mo - 1, data.d, Number(h[1]) + 3, Number(h[2]));
        const fim = `${fimDate.getFullYear()}${p(fimDate.getMonth() + 1)}${p(fimDate.getDate())}T${p(fimDate.getHours())}${p(fimDate.getMinutes())}00`;

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: dados.nome || 'Evento',
            dates: `${ini}/${fim}`,
            details: 'Ingresso pelo Roles',
            location: dados.local || ''
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    function textoContagem(dados) {
        const data = lerDataEvento(dados.data);
        if (!data) return null;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const alvo = new Date(data.y, data.mo - 1, data.d);
        const dias = Math.round((alvo - hoje) / 86400000);

        if (dias < 0) return null;
        if (dias === 0) return 'É hoje';
        if (dias === 1) return 'É amanhã';
        return `Faltam ${dias} dias`;
    }

    function lerIdEvento() {
        try {
            const salvo = JSON.parse(localStorage.getItem('eventoSelecionado') || '{}');
            return salvo.evento_id || null;
        } catch (_) {
            return null;
        }
    }

    function montarLinkWhatsapp(dados) {
        const partes = [`Vou no ${dados.nome || 'evento'}`];
        if (dados.data && dados.data !== '—') partes.push(`dia ${dados.data}`);
        if (dados.hora && dados.hora !== '—') partes.push(`às ${dados.hora}`);
        if (dados.local && dados.local !== '—') partes.push(`em ${dados.local}`);

        let texto = partes.join(', ') + '. Bora?';
        const idEvento = lerIdEvento();
        if (idEvento) {
            texto += ` ${location.origin}/frontend/detalheseventos/detalheevento.html?id=${idEvento}`;
        }
        return `https://wa.me/?text=${encodeURIComponent(texto)}`;
    }

    function configurarModalQr(dados) {
        const btn = el('btn-mostrar-qr');
        const modal = el('gx-modal-qr');
        const img = el('gx-qr-grande');
        const fechar = el('gx-qr-fechar');
        if (!btn || !modal || !img || !fechar) return;

        const conteudoQr = 'ROLES-PEDIDO-' + dados.pedido_id;
        let qrPronto = false;

        el('gx-qr-evento').textContent = dados.nome || 'Evento';
        el('gx-qr-info').textContent = `${dados.ingressoNome || 'Ingresso'} · Pedido #${dados.pedido_id}`;
        btn.style.display = '';

        function abrir() {
            if (!qrPronto) {
                qrPronto = true;
                gerarQrCodeDataUrl(conteudoQr, 360)
                    .then(url => { img.src = url; })
                    .catch(() => {
                        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(conteudoQr)}`;
                    });
            }
            modal.classList.add('aberto');
            document.body.style.overflow = 'hidden';
            fechar.focus();
        }

        function fecharModal() {
            modal.classList.remove('aberto');
            document.body.style.overflow = '';
            btn.focus();
        }

        btn.addEventListener('click', abrir);
        fechar.addEventListener('click', fecharModal);
        modal.addEventListener('click', e => { if (e.target === modal) fecharModal(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('aberto')) fecharModal();
        });
    }

    // Só mexe no texto quando ele vem TODO em maiúsculas (ex.: "BTS WORLD TOUR ARIRANG")
    function formatarTitulo(txt) {
        const s = String(txt || '').trim();
        if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
        const pequenas = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'no', 'na', 'com', 'para', 'the', 'of', 'and'];
        return s.toLowerCase().split(/\s+/).map((p, i) => {
            if (i > 0 && pequenas.includes(p)) return p;
            // siglas sem vogal (como BTS, DJ, MC) continuam em maiúsculas
            if (p.length <= 4 && !/[aeiouáéíóúâêôãõà]/i.test(p)) return p.toUpperCase();
            return p.charAt(0).toUpperCase() + p.slice(1);
        }).join(' ');
    }

    function primeiraMaiuscula(txt) {
        const s = String(txt || '').trim();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    // Preenche o ingresso roxo (só ingresso gratuito)
    function preencherIngressoGratuito(dados, pendente) {
        const bloco = el('gx-gratuito');
        if (!bloco) return;
        bloco.style.display = 'block';
        const gratuito = String(dados.forma_pagamento || '').toLowerCase() === 'gratuito';
        const conteudoPagina = el('conteudo-confirmacao');
        if (conteudoPagina) conteudoPagina.classList.add('gx-modo-gratuito');

        // Ingresso, ações e lembrete sobem para a largura toda; os cards descem lado a lado
        const gradeLayout = document.querySelector('.layout-grid');
        if (gradeLayout && gradeLayout.parentNode) {
            gradeLayout.parentNode.insertBefore(bloco, gradeLayout);
            gradeLayout.classList.add('gx-grid-baixo');
            if (!gratuito) gradeLayout.classList.add('gx-pago');
        }

        // O ingresso padrão (pagos/pendentes) fica escondido no gratuito
        const ticketPadrao = document.querySelector('.ticket');
        if (ticketPadrao) ticketPadrao.style.display = 'none';

        const data = lerDataEvento(dados.data);
        if (data) {
            const d = new Date(data.y, data.mo - 1, data.d);
            el('gx-dia').textContent = data.d;
            el('gx-mes').textContent = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            el('gx-semana').textContent = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        } else {
            el('gx-dia').textContent = '—';
            el('gx-mes').textContent = '';
            el('gx-semana').textContent = '';
        }

        const tipoTag = gratuito ? 'Ingresso gratuito' : primeiraMaiuscula(dados.ingressoNome || 'Ingresso');
        el('gx-t-tag').textContent = `${tipoTag} · Qtd ${dados.quantidade || 1}`;
        const campoNome = el('gx-t-nome');
        campoNome.textContent = formatarTitulo(dados.nome) || 'Evento';
        campoNome.style.setProperty('text-transform', 'none', 'important');
        el('gx-t-hora').textContent = dados.hora || '—';
        el('gx-t-local').textContent = dados.local || '—';
        el('gx-t-pedido').textContent = `Pedido #${dados.pedido_id}`;

        const qr = el('gx-t-qr');
        if (pendente) {
            qr.style.display = 'none';
            const trava = el('gx-t-lock');
            if (trava) trava.style.display = 'flex';
            const lembrete = el('gx-lembrete-texto');
            if (lembrete) lembrete.textContent = 'Assim que o pagamento for confirmado, seu ingresso é liberado aqui e por e-mail.';
            return;
        }
        const conteudoQr = 'ROLES-PEDIDO-' + dados.pedido_id;
        gerarQrCodeDataUrl(conteudoQr, 264)
            .then(url => { qr.src = url; })
            .catch(() => {
                qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=264x264&data=${encodeURIComponent(conteudoQr)}`;
            });
    }

    function montarExperienciaGratuita(dados, pendente) {
        preencherIngressoGratuito(dados, pendente);

        // Etiqueta de contagem regressiva (a de clima aparece quando a previsão chega)
        const chips = el('gx-chips');
        const contagem = textoContagem(dados);
        if (chips) {
            chips.style.display = 'flex';
            if (contagem) {
                el('gx-chip-contagem-texto').textContent = contagem;
            } else {
                el('gx-chip-contagem').style.display = 'none';
            }
        }

        const bloco = el('lembretes-gratuito');
        if (bloco) bloco.style.display = 'block';

        const cal = el('lembrete-calendario');
        if (cal) {
            const url = montarLinkCalendario(dados);
            if (url) cal.href = url; else cal.style.display = 'none';
        }

        const zap = el('lembrete-whatsapp');
        if (zap) zap.href = montarLinkWhatsapp(dados);

        const maps = el('lembrete-maps');
        if (maps) {
            if (dados.local) {
                maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dados.local)}`;
            } else {
                maps.style.display = 'none';
            }
        }

        const dress = el('lembrete-dress');
        if (dress) {
            const termo = dados.nome ? `look para ${dados.nome}` : 'look casual chique evento';
            dress.href = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(termo)}`;
        }

        // QR só abre em tela cheia quando o ingresso já está liberado
        if (!pendente) configurarModalQr(dados);
    }

    // ════════════════════════════════════════════════════════════════
    // PAGAMENTO PENDENTE
    // ════════════════════════════════════════════════════════════════
    function mostrarPagamentoPendente(dados) {
        const card = el('pendente-card');
        if (!card) return;
        card.style.display = 'block';

        const forma = String(dados.forma_pagamento || '').toLowerCase();

        if (forma === 'pix' && dados.pix_copia_cola) {
            const pixBox = el('pendente-pix');
            const pixCodigo = el('pix-codigo');
            pixCodigo.textContent = dados.pix_copia_cola;
            pixBox.style.display = 'block';

            el('btn-copiar-pix')?.addEventListener('click', () => {
                navigator.clipboard.writeText(dados.pix_copia_cola)
                    .then(() => mostrarToast('Código Pix copiado!'))
                    .catch(() => mostrarToast('Não foi possível copiar o código.'));
            });
        }

        if (forma === 'boleto' && dados.boleto_url) {
            const boletoBox = el('pendente-boleto');
            const linkBoleto = el('btn-ver-boleto');
            linkBoleto.href = dados.boleto_url;
            boletoBox.style.display = 'block';
        }

        if (dados.pagamento_expira_em) {
            const dt = new Date(dados.pagamento_expira_em);
            if (!isNaN(dt.getTime())) {
                el('pendente-expira').textContent =
                    `Expira em ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                el('pendente-expira').style.display = 'block';
            }
        }
    }

    // ════════════════════════════════════════════════════════════════
    // CLIMA (Open-Meteo, sem chave de API)
    // ════════════════════════════════════════════════════════════════
    function interpretarClima(codigo) {
        if (codigo === 0) return 'céu limpo';
        if (codigo <= 2) return 'parcialmente nublado';
        if (codigo === 3) return 'nublado';
        if (codigo <= 49) return 'névoa';
        if (codigo <= 59) return 'garoa';
        if (codigo <= 69) return 'chuva';
        if (codigo <= 79) return 'neve';
        if (codigo <= 84) return 'pancadas de chuva';
        if (codigo <= 94) return 'tempestade';
        return 'condição severa';
    }

    function inicializarClima(local, gratuito) {
        const texto = el('clima-texto');
        const card = el('clima-card');
        const chip = el('gx-chip-clima');
        const chipTexto = el('gx-chip-clima-texto');

        if (!local) {
            if (card) card.style.display = 'none';
            return;
        }

        const urlPrevisao = `https://www.google.com/search?q=${encodeURIComponent('previsão do tempo ' + local)}`;
        if (card) card.addEventListener('click', () => window.open(urlPrevisao, '_blank'));

        const aviso = 'Toque para ver a previsão do tempo.';
        const cidade = String(local).split(',').pop().trim() || String(local).trim();

        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`)
            .then(r => r.json())
            .then(geo => {
                if (!geo.results || !geo.results.length) throw new Error('cidade nao encontrada');
                const { latitude, longitude, name } = geo.results[0];
                return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`)
                    .then(r => r.json())
                    .then(clima => ({ clima, name }));
            })
            .then(({ clima, name }) => {
                if (!clima.current_weather) throw new Error('sem clima');
                const temp = Math.round(clima.current_weather.temperature);
                const descricao = interpretarClima(clima.current_weather.weathercode);

                if (texto) texto.textContent = `${temp}°C, ${descricao} em ${name}`;
                if (gratuito && chip && chipTexto) {
                    // É o tempo de agora (não a previsão do dia do evento)
                    chipTexto.textContent = `Agora: ${temp}°C`;
                    chip.title = descricao;
                    chip.style.display = 'inline-flex';
                }
            })
            .catch(() => { if (texto) texto.textContent = aviso; });
    }

    // ════════════════════════════════════════════════════════════════
    // AÇÕES: baixar PDF / reenviar email
    // ════════════════════════════════════════════════════════════════
    function configurarAcoes(pedidoId, pendente, dados) {
        const btnPdf = el('btn-baixar-pdf');
        const btnEmail = el('btn-reenviar-email');

        if (pendente && btnPdf) {
            btnPdf.classList.add('is-disabled');
            btnPdf.setAttribute('aria-disabled', 'true');
        }

        btnPdf?.addEventListener('click', async () => {
            if (pendente) {
                mostrarToast('O PDF fica disponível assim que o pagamento for confirmado.');
                return;
            }
            const textoOriginal = btnPdf.innerHTML;
            btnPdf.classList.add('is-disabled');
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
            try {
                await gerarPdfIngresso(pedidoId, dados);
            } catch (err) {
                console.error('[Confirmacao] erro ao gerar PDF:', err);
                mostrarToast('Não foi possível gerar o PDF agora.');
            } finally {
                btnPdf.classList.remove('is-disabled');
                btnPdf.innerHTML = textoOriginal;
            }
        });

        btnEmail?.addEventListener('click', async () => {
            if (btnEmail.classList.contains('is-disabled')) return;
            btnEmail.classList.add('is-disabled');
            try {
                const resp = await fetch(`${BASE_URL}/pedidos/${pedidoId}/reenviar-email`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!resp.ok) throw new Error('falha ao reenviar email');
                mostrarToast('Email reenviado com sucesso!');
                iniciarCooldownEmail(btnEmail);
            } catch (err) {
                console.error('[Confirmacao] erro ao reenviar email:', err);
                mostrarToast('Não foi possível reenviar o email agora.');
                btnEmail.classList.remove('is-disabled');
            }
        });
    }

    // ── Carrega uma imagem do próprio projeto e devolve como dataURL (pra addImage do jsPDF) ──
    function carregarImagemComoDataUrl(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                try { resolve(canvas.toDataURL('image/png')); }
                catch (e) { reject(e); }
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    // ── Gera um QR Code real (lib qrcode.js) e devolve como dataURL ──
    function gerarQrCodeDataUrl(texto, tamanho = 300) {
        return new Promise((resolve, reject) => {
            if (typeof QRCode === 'undefined') { reject(new Error('lib QRCode não carregada')); return; }
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(container);
            try {
                new QRCode(container, {
                    text: texto,
                    width: tamanho,
                    height: tamanho,
                    correctLevel: QRCode.CorrectLevel.M
                });
                setTimeout(() => {
                    const canvas = container.querySelector('canvas');
                    const img = container.querySelector('img');
                    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
                    document.body.removeChild(container);
                    dataUrl ? resolve(dataUrl) : reject(new Error('QR não gerado'));
                }, 60);
            } catch (err) {
                document.body.removeChild(container);
                reject(err);
            }
        });
    }

    // ── Gera o PDF: cabeçalho com logo + cartão estilo cartão de embarque + QR real ──
    async function gerarPdfIngresso(pedidoId, dados) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        const ROXO = [108, 29, 206];
        const ROXO_CLARO = [244, 241, 252];
        const TEXTO = [40, 40, 40];
        const CINZA = [140, 140, 140];
        const BORDA = [225, 225, 230];

        const nomeEvento = dados.nome || 'Evento';
        const dataStr = dados.data || '—';
        const horaStr = dados.hora || '—';
        const local = dados.local || '—';
        const tipo = dados.ingressoNome || 'Ingresso';
        const qtd = dados.quantidade || 1;
        const formas = { credito: 'Cartão de Crédito', cartao: 'Cartão de Crédito', pix: 'PIX', boleto: 'Boleto Bancário' };
        const pagamento = formas[String(dados.forma_pagamento).toLowerCase()] || dados.forma_pagamento || '—';
        const pedido = `#${pedidoId}`;
        const beneficios = Array.isArray(dados.beneficios) ? dados.beneficios.filter(Boolean) : [];

        let logoDataUrl = null;
        try { logoDataUrl = await carregarImagemComoDataUrl(LOGO_PATH); } catch (_) {}

        let qrDataUrl = null;
        try { qrDataUrl = await gerarQrCodeDataUrl('ROLES-PEDIDO-' + pedidoId); } catch (_) {}

        const cardX = 15, cardW = 180, raio = 4;
        const stubW = 58;
        const mainW = cardW - stubW;
        const seamX = cardX + mainW;

        // ── MEDE O CONTEÚDO PRIMEIRO, PRA DEFINIR A ALTURA DO CARTÃO SEM SOBRA ──
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
        const nomeLinhas = doc.splitTextToSize(nomeEvento, mainW - 20);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        const dataLinhas  = doc.splitTextToSize(dataStr, mainW - 20);
        const horaLinhas  = doc.splitTextToSize(horaStr, mainW - 20);
        const localLinhas = doc.splitTextToSize(local, mainW - 20);

        let alturaMain = 16 + (nomeLinhas.length * 6 + 6);
        [dataLinhas, horaLinhas, localLinhas].forEach(linhas => {
            alturaMain += 5 + linhas.length * 5 + 4;
        });
        if (beneficios.length > 0) {
            alturaMain += 2 + 5 + beneficios.slice(0, 4).length * 5;
        }
        alturaMain += 14; // respiro inferior

        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        const tipoLinhas = doc.splitTextToSize(tipo, stubW - 12);
        const alturaStub = 14 + 6 + (tipoLinhas.length * 5 + 4) + 42 + 5 + 14;

        const cardY = 42;
        const cardH = Math.max(alturaMain, alturaStub, 70);

        // ── CARTÃO (TICKET) ──
        doc.setFillColor(232, 230, 238);
        doc.roundedRect(cardX + 1.2, cardY + 1.5, cardW, cardH, raio, raio, 'F');

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...BORDA);
        doc.setLineWidth(0.3);
        doc.roundedRect(cardX, cardY, cardW, cardH, raio, raio, 'FD');

        doc.setFillColor(...ROXO_CLARO);
        doc.rect(seamX, cardY, stubW, cardH, 'F');

        // furinhos do canhoto
        doc.setFillColor(255, 255, 255);
        doc.circle(seamX, cardY, 3.2, 'F');
        doc.circle(seamX, cardY + cardH, 3.2, 'F');

        // linha pontilhada
        doc.setDrawColor(200, 195, 215);
        doc.setLineWidth(0.4);
        if (doc.setLineDashPattern) doc.setLineDashPattern([1.4, 1.4], 0);
        doc.line(seamX, cardY + 5, seamX, cardY + cardH - 5);
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);

        // ── CABEÇALHO ──
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', 15, 14, 14, 14);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...TEXTO);
            doc.text('Rolês', 33, 21);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
            doc.text('Comprovante de ingresso', 33, 26);
        } else {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...ROXO);
            doc.text('Rolês', 15, 21);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
            doc.text('Comprovante de ingresso', 15, 26);
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
        doc.text(`Pedido ${pedido}`, 195, 18, { align: 'right' });
        doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 195, 23, { align: 'right' });

        doc.setDrawColor(...BORDA);
        doc.line(15, 33, 195, 33);

        // ── PAINEL PRINCIPAL (esquerda) ──
        const px = cardX + 10;
        let py = cardY + 16;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...TEXTO);
        doc.text(nomeLinhas, px, py);
        py += nomeLinhas.length * 6 + 6;

        doc.setDrawColor(...BORDA);
        doc.line(px, py - 3, cardX + mainW - 10, py - 3);

        [['Data', dataLinhas], ['Horário', horaLinhas], ['Local', localLinhas]].forEach(([label, valorLinhas]) => {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...ROXO);
            doc.text(label.toUpperCase(), px, py);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...TEXTO);
            doc.text(valorLinhas, px, py + 5);
            py += 5 + valorLinhas.length * 5 + 4;
        });

        if (beneficios.length > 0) {
            py += 2;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...ROXO);
            doc.text('BENEFÍCIOS', px, py);
            py += 5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
            beneficios.slice(0, 4).forEach(b => { doc.text(`✓ ${b}`, px, py); py += 5; });
        }

        // ── CANHOTO (direita) ──
        const stubCenterX = seamX + stubW / 2;
        let sy = cardY + 14;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...ROXO);
        doc.text('INGRESSO', stubCenterX, sy, { align: 'center' });
        sy += 6;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
        doc.text(tipoLinhas, stubCenterX, sy, { align: 'center' });
        sy += tipoLinhas.length * 5 + 4;

        if (qrDataUrl) {
            const qrSize = 36;
            doc.addImage(qrDataUrl, 'PNG', stubCenterX - qrSize / 2, sy, qrSize, qrSize);
            sy += qrSize + 6;
        } else {
            doc.setDrawColor(...BORDA);
            doc.rect(stubCenterX - 18, sy, 36, 36);
            doc.setFontSize(8); doc.setTextColor(...CINZA);
            doc.text('QR indisponível', stubCenterX, sy + 20, { align: 'center' });
            sy += 42;
        }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
        doc.text(pedido, stubCenterX, sy, { align: 'center' });
        sy += 5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...CINZA);
        doc.text(`Qtd: ${qtd}`, stubCenterX, sy, { align: 'center' });

        // ── RESUMO DO PAGAMENTO ──
        const ry = cardY + cardH + 14;
        doc.setDrawColor(...BORDA);
        doc.line(15, ry - 6, 195, ry - 6);

        const ehGratuito = String(dados.forma_pagamento).toLowerCase() === 'gratuito';
        const resumo = ehGratuito
            ? [['Valor', 'Gratuito'], ['Tipo', 'Presença confirmada'], ['Status', 'Confirmado']]
            : [['Valor pago', fmtBRL(dados.totalPago)], ['Forma de pagamento', pagamento], ['Status', 'Confirmado']];
        const colW = 180 / resumo.length;
        resumo.forEach(([label, valor], i) => {
            const x = 15 + i * colW;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
            doc.text(label, x, ry);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXTO);
            doc.text(String(valor), x, ry + 6);
        });

        // ── RODAPÉ ──
        doc.setDrawColor(...BORDA);
        doc.line(15, 270, 195, 270);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
        doc.text('Este ingresso é pessoal e intransferível. Apresente um documento com foto na entrada do evento.', 105, 277, { align: 'center' });
        doc.text(`Rolês © ${new Date().getFullYear()} — Gerado em ${new Date().toLocaleString('pt-BR')}`, 105, 283, { align: 'center' });

        doc.save(`ingresso-${pedidoId}.pdf`);
    }

    // Trava o botão de reenviar e-mail por 30s pra evitar clique repetido / spam.
    function iniciarCooldownEmail(btn) {
        const textoOriginal = btn.innerHTML;
        let segundos = 30;
        btn.innerHTML = `<i class="fas fa-clock"></i> Aguarde ${segundos}s`;

        const intervalo = setInterval(() => {
            segundos -= 1;
            if (segundos <= 0) {
                clearInterval(intervalo);
                btn.classList.remove('is-disabled');
                btn.innerHTML = textoOriginal;
            } else {
                btn.innerHTML = `<i class="fas fa-clock"></i> Aguarde ${segundos}s`;
            }
        }, 1000);
    }

    document.addEventListener('DOMContentLoaded', carregarCompra);
})();