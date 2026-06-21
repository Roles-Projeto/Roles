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
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('ROLES-PEDIDO-' + pedidoId)}`;
        }

        el('btn-ver-ingressos').href = '/frontend/perfil/perfil.html?section=ingressos';

        el('confirmacao-loading').style.display = 'none';
        const conteudo = el('conteudo-confirmacao');
        conteudo.style.display = 'block';
        requestAnimationFrame(() => conteudo.classList.add('is-visible'));

        inicializarClima(dados.local);
        configurarAcoes(pedidoId, pendente, dados);
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
    // CLIMA (wttr.in — sem chave de API)
    // ════════════════════════════════════════════════════════════════
    function inicializarClima(local) {
        const texto = el('clima-texto');
        const card = el('clima-card');
        if (!texto || !card) return;

        if (!local) {
            card.style.display = 'none';
            return;
        }

        const urlPrevisao = `https://www.google.com/search?q=${encodeURIComponent('previsão do tempo ' + local)}`;

        fetch(`https://wttr.in/${encodeURIComponent(local)}?format=3`)
            .then(r => r.text())
            .then(txt => {
                const limpo = txt.trim();
                const pareceHtml = !limpo || limpo.startsWith('<') || limpo.length > 200;
                texto.textContent = pareceHtml ? 'Toque para ver a previsão do tempo.' : limpo;
            })
            .catch(() => { texto.textContent = 'Toque para ver a previsão do tempo.'; });

        card.addEventListener('click', () => window.open(urlPrevisao, '_blank'));
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

    const resumo = [['Valor pago', fmtBRL(dados.totalPago)], ['Forma de pagamento', pagamento], ['Status', 'Confirmado']];
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