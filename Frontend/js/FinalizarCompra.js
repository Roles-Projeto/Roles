"use strict";

/* ==================================================
   CONFIGURAÇÃO
================================================== */
const BASE_URL = window.API_BASE_URL || window.API_BASE || "";




/* ==================================================
   ESTADO GLOBAL
================================================== */
let PRICE_PER_TICKET = 0.00;
const SERVICE_TAX_RATE = 0.10;
let MAX_AVAILABLE_TICKETS = 85;

let currentPaymentMethod = "cartao";
let pixTimerInterval = null;

let eventoAtual = null;
let tipoAtual = null;

/* ==================================================
   GET USER ID
================================================== */
function getUserId() {
    for (const key of ["userId", "id", "user_id", "usuarioId", "usuario_id"]) {
        const v = localStorage.getItem(key);
        if (v && v !== "undefined" && v !== "null") return v;
    }
    for (const key of ["user", "userData", "usuario", "loggedUser", "currentUser"]) {
        try {
            const obj = JSON.parse(localStorage.getItem(key) || "");
            const id = obj?.id || obj?.userId || obj?.user_id || obj?.usuarioId;
            if (id) return String(id);
        } catch (_) { }
    }
    return null;
}

/* ==================================================
   UTILITÁRIOS DE VALIDAÇÃO
================================================== */
const Validador = {
    nome: (val) => val.trim().split(" ").length >= 2 && val.trim().length > 4,
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    telefone: (val) => val.replace(/\D/g, "").length >= 10,
    cvv: (val) => /^[0-9]{3,4}$/.test(val),
    validade: (val) => {
        if (!/^\d{2}\/\d{2}$/.test(val)) return false;
        const [mes, ano] = val.split("/");
        if (mes < 1 || mes > 12) return false;
        const hoje = new Date();
        const anoAtual = parseInt(hoje.getFullYear().toString().slice(-2));
        const mesAtual = hoje.getMonth() + 1;
        return !(ano < anoAtual || (ano == anoAtual && mes < mesAtual));
    },
    cartao: (val) => {
        const num = val.replace(/\D/g, "");
        if (num.length < 13) return false;
        let soma = 0, inv = false;
        for (let i = num.length - 1; i >= 0; i--) {
            let d = +num[i];
            if (inv && (d *= 2) > 9) d -= 9;
            soma += d; inv = !inv;
        }
        return soma % 10 === 0;
    },
    cpf: (cpf) => {
        cpf = cpf.replace(/\D/g, "");
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        let soma = 0, resto;
        for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(cpf[9])) return false;
        soma = 0;
        for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        return resto === parseInt(cpf[10]);
    }
};

/* ==================================================
   FEEDBACK VISUAL
================================================== */
function setFieldStatus(inputId, isValid, feedbackId, msgErro) {
    const input = document.getElementById(inputId);
    const feedback = document.getElementById(feedbackId);
    if (!input) return false;

    input.classList.toggle("invalid", !isValid);
    input.classList.toggle("valid", isValid);

    if (feedback) {
        feedback.textContent = isValid ? "" : msgErro;
        feedback.className = isValid ? "field-feedback ok" : "field-feedback err";
    }
    return isValid;
}

function validarDadosPessoais() {
    return [
        setFieldStatus("nome", Validador.nome(document.getElementById("nome").value), "fb-nome", "Insira seu nome completo"),
        setFieldStatus("cpf", Validador.cpf(document.getElementById("cpf").value), "fb-cpf", "CPF inválido"),
        setFieldStatus("email", Validador.email(document.getElementById("email").value), "fb-email", "E-mail inválido"),
        setFieldStatus("telefone", Validador.telefone(document.getElementById("telefone").value), "fb-telefone", "Telefone inválido"),
    ].every(Boolean);
}

function validarDadosCartao() {
    return [
        setFieldStatus("numero-cartao", Validador.cartao(document.getElementById("numero-cartao").value), "fb-cartao", "Número inválido"),
        setFieldStatus("nome-cartao", Validador.nome(document.getElementById("nome-cartao").value), "fb-nome-cartao", "Insira o nome impresso"),
        setFieldStatus("validade", Validador.validade(document.getElementById("validade").value), "fb-validade", "Data inválida/expirada"),
        setFieldStatus("cvv", Validador.cvv(document.getElementById("cvv").value), "fb-cvv", "CVV inválido"),
    ].every(Boolean);
}

function configurarValidacaoRealTime() {
    const campos = [
        { id: "nome", validador: Validador.nome, fb: "fb-nome", err: "Insira seu nome completo" },
        { id: "cpf", validador: Validador.cpf, fb: "fb-cpf", err: "CPF inválido" },
        { id: "email", validador: Validador.email, fb: "fb-email", err: "E-mail inválido" },
        { id: "telefone", validador: Validador.telefone, fb: "fb-telefone", err: "Telefone inválido" },
        { id: "numero-cartao", validador: Validador.cartao, fb: "fb-cartao", err: "Número inválido" },
        { id: "nome-cartao", validador: Validador.nome, fb: "fb-nome-cartao", err: "Insira o nome impresso" },
        { id: "validade", validador: Validador.validade, fb: "fb-validade", err: "Data inválida" },
        { id: "cvv", validador: Validador.cvv, fb: "fb-cvv", err: "CVV inválido" },
    ];

    campos.forEach(({ id, validador, fb, err }) => {
        const campo = document.getElementById(id);
        if (campo) campo.addEventListener("blur", () => setFieldStatus(id, validador(campo.value), fb, err));
    });

    ["nome", "cpf"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", sincronizarResumoPagador);
    });
}

function sincronizarResumoPagador() {
    const nome = document.getElementById("nome").value || "—";
    const cpf = document.getElementById("cpf").value || "—";
    ["pix", "boleto"].forEach(m => {
        document.getElementById(`${m}-nome-display`).textContent = nome;
        document.getElementById(`${m}-cpf-display`).textContent = cpf;
    });
}

/* ==================================================
   BUSCA DE CEP
================================================== */
async function buscarCEP(cepInput) {
    const cep = cepInput.value.replace(/\D/g, "");
    const spinner = document.getElementById("spinner-cep");
    const box = document.getElementById("endereco-box");

    if (cep.length !== 8) {
        setFieldStatus("cep-boleto", false, "fb-cep", "CEP incompleto");
        box.style.display = "none";
        return false;
    }

    spinner.style.display = "block";
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) throw new Error("CEP não encontrado");

        document.getElementById("endereco-logradouro").textContent = data.logradouro || "—";
        document.getElementById("endereco-bairro").textContent = data.bairro || "—";
        document.getElementById("endereco-cidade").textContent = data.localidade || "—";
        document.getElementById("endereco-uf").textContent = data.uf || "—";

        box.style.display = "block";
        setFieldStatus("cep-boleto", true, "fb-cep", "");
        return true;
    } catch {
        box.style.display = "none";
        setFieldStatus("cep-boleto", false, "fb-cep", "CEP inválido ou não encontrado");
        return false;
    } finally {
        spinner.style.display = "none";
    }
}

/* ==================================================
   MÁSCARAS
================================================== */
function aplicarMascaras() {
    const masks = {
        cpf: (v) => v.replace(/\D/g, "").slice(0, 11)
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4"),
        telefone: (v) => v.replace(/\D/g, "").slice(0, 11)
            .replace(/(\d{2})(\d)/, "($1) $2")
            .replace(/(\d{4,5})(\d{4})$/, "$1-$2"),
        cartao: (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=\d)/g, "$1 "),
        validade: (v) => v.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2"),
        cep: (v) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"),
        cvv: (v) => v.replace(/\D/g, "").slice(0, 4),
    };

    const addMask = (id, maskFn, callback) => {
        const campo = document.getElementById(id);
        if (campo) campo.addEventListener("input", function () {
            this.value = maskFn(this.value);
            if (callback) callback(this);
        });
    };

    addMask("cpf", masks.cpf);
    addMask("telefone", masks.telefone);
    addMask("validade", masks.validade);
    addMask("cvv", masks.cvv);

    addMask("numero-cartao", masks.cartao, (campo) => {
        const icon = document.getElementById("card-brand-icon");
        const num = campo.value.replace(/\D/g, "");
        icon.className = "input-icon fab";
        if (num.startsWith("4")) { icon.classList.add("fa-cc-visa"); icon.style.color = "#1a1f71"; }
        else if (/^5[1-5]/.test(num)) { icon.classList.add("fa-cc-mastercard"); icon.style.color = "#eb001b"; }
        else if (/^3[47]/.test(num)) { icon.classList.add("fa-cc-amex"); icon.style.color = "#007bc1"; }
        else if (/^6(?:011|5)/.test(num)) { icon.classList.add("fa-cc-discover"); icon.style.color = "#f76f20"; }
        else { icon.className = "input-icon fas fa-credit-card"; icon.style.color = ""; }
    });

    addMask("cep-boleto", masks.cep, (campo) => {
        if (campo.value.replace(/\D/g, "").length === 8) buscarCEP(campo);
        else document.getElementById("endereco-box").style.display = "none";
    });
}

/* ==================================================
   TROCA DE MÉTODO DE PAGAMENTO
================================================== */
function switchPaymentMethod(method) {
    document.querySelectorAll(".payment-card").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".payment-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("payment-" + method).classList.add("active");
    document.querySelector(`[data-method="${method}"]`).classList.add("active");
    currentPaymentMethod = method;

    if (method !== "pix" && pixTimerInterval) {
        clearInterval(pixTimerInterval);
        pixTimerInterval = null;
    }
}

/* ==================================================
   FLUXOS DE PAGAMENTO
================================================== */
function handleCartaoSubmit() {
    const pessoaisOk = validarDadosPessoais();
    const cartaoOk = validarDadosCartao();
    if (!pessoaisOk || !cartaoOk) {
        const firstError = document.querySelector(".input-wrapper input.invalid");
        if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    finalizarCompra("credito");
}

function gerarPix() {
    if (!validarDadosPessoais()) {
        document.getElementById("pix-dados-incompletos").style.display = "flex";
        return;
    }
    document.getElementById("pix-dados-incompletos").style.display = "none";
    document.getElementById("pix-step-1").style.display = "none";
    document.getElementById("pix-step-2").style.display = "block";

    const totalText = document.getElementById("total").textContent;
    const btnPixPay = document.getElementById("btn-pix-pay");
    btnPixPay.innerHTML = `<i class="fas fa-check-circle" style="margin-right:8px;"></i>Já paguei ${totalText}`;
    btnPixPay.onclick = (e) => { e.preventDefault(); finalizarCompra("pix"); };

    iniciarTimerPix(30 * 60);
}

async function gerarBoleto() {
    if (!validarDadosPessoais()) {
        document.getElementById("boleto-dados-incompletos").style.display = "flex";
        return;
    }

    const cepInput = document.getElementById("cep-boleto");
    if (cepInput.value.replace(/\D/g, "").length !== 8 || cepInput.classList.contains("invalid")) {
        setFieldStatus("cep-boleto", false, "fb-cep", "Verifique o CEP antes de emitir");
        return;
    }

    document.getElementById("boleto-dados-incompletos").style.display = "none";

    const venc = new Date(); venc.setDate(venc.getDate() + 3);
    document.getElementById("boleto-valor").textContent = formatBRL(calcularTotal());
    document.getElementById("boleto-vencimento").textContent = venc.toLocaleDateString("pt-BR");
    document.getElementById("boleto-numero").textContent = Math.floor(Math.random() * 9e9 + 1e9).toString();

    document.getElementById("boleto-step-1").style.display = "none";
    document.getElementById("boleto-step-2").style.display = "block";

    await finalizarCompra("boleto");
}

function downloadBoleto() {
    alert("Download do PDF do boleto seria gerado pelo backend.");
}

function iniciarTimerPix(segundos) {
    if (pixTimerInterval) clearInterval(pixTimerInterval);
    const countdownEl = document.getElementById("pix-countdown");

    pixTimerInterval = setInterval(() => {
        if (segundos <= 0) {
            clearInterval(pixTimerInterval);
            if (countdownEl) countdownEl.textContent = "Expirado";
            const btn = document.getElementById("btn-pix-pay");
            if (btn) btn.disabled = true;
            return;
        }
        segundos--;
        const m = String(Math.floor(segundos / 60)).padStart(2, "0");
        const s = String(segundos % 60).padStart(2, "0");
        if (countdownEl) countdownEl.textContent = `${m}:${s}`;
    }, 1000);
}

function copiarCodigo(inputId, feedbackId) {
    const code = document.getElementById(inputId).value;
    navigator.clipboard.writeText(code).then(() => {
        const fb = document.getElementById(feedbackId);
        fb.textContent = "✓ Copiado com sucesso!";
        setTimeout(() => (fb.textContent = ""), 3000);
    });
}

/* ==================================================
   CÁLCULOS
================================================== */
function formatBRL(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function calcularTotal() {
    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;
    return quantidade * PRICE_PER_TICKET * (1 + SERVICE_TAX_RATE);
}

function updatePrice(quantity) {
    const subtotal = quantity * PRICE_PER_TICKET;
    const taxa = subtotal * SERVICE_TAX_RATE;
    const total = subtotal + taxa;

    document.getElementById("quantidade").value = quantity;
    document.getElementById("subtotal").textContent = formatBRL(subtotal);
    document.getElementById("taxa").textContent = formatBRL(taxa);
    document.getElementById("total").textContent = formatBRL(total);
    document.getElementById("ticket-price-display").textContent = formatBRL(PRICE_PER_TICKET);
    document.getElementById("subtotal-label").textContent = `Subtotal (${quantity}x)`;

    const btnPagar = document.getElementById("btn-pagar-cartao");
    if (btnPagar) btnPagar.textContent = `Pagar ${formatBRL(total)}`;
}

function changeQuantity(change) {
    const input = document.getElementById("quantidade");
    const newValue = parseInt(input.value) + change;
    if (newValue >= 1 && newValue <= MAX_AVAILABLE_TICKETS) updatePrice(newValue);
}

/* ==================================================
   CARREGA DADOS DO EVENTO
================================================== */
async function loadEventData() {
    const params = new URLSearchParams(window.location.search);
    const evento_id = params.get("evento_id");
    const tipo_ingresso_id = params.get("tipo_ingresso_id");

    if (evento_id && tipo_ingresso_id) {
        try {
            const res = await fetch(`${BASE_URL}/eventos/${evento_id}`);
            if (!res.ok) throw new Error("Evento não encontrado");
            const evento = await res.json();

            const tipo = evento.tipos_ingresso?.find(t => String(t.id) === String(tipo_ingresso_id));
            if (!tipo) throw new Error("Tipo de ingresso não encontrado");

            eventoAtual = evento;
            tipoAtual = tipo;

            const disponivel = tipo.disponivel ?? (tipo.quantidade_total - tipo.quantidade_vendida);
            MAX_AVAILABLE_TICKETS = disponivel;

            const img = document.getElementById("event-image");
            const imgFile = evento.imagem || evento.img_capa;
            
            if (img && imgFile) {
                const finalSrc = imgFile.startsWith("/uploads/") || imgFile.startsWith("http")
                    ? `${BASE_URL}${imgFile.startsWith("/") ? imgFile : "/" + imgFile}`
                    : `${BASE_URL}/uploads/${imgFile}`;
                
                img.src = finalSrc;
            }
            document.getElementById("event-name").textContent = evento.titulo || evento.nome || "—";
            document.getElementById("event-location").textContent = evento.local_nome || "—";
            document.getElementById("ticket-type").textContent = tipo.nome || "—";

            const disponEl = document.querySelector(".quantity-control span");
            if (disponEl) disponEl.textContent = `${disponivel} ingressos disponíveis`;

            const dataEvento = evento.data_inicio || evento.data_evento;
            if (dataEvento) {
                const d = new Date(dataEvento);
                document.getElementById("event-date").textContent = d.toLocaleDateString("pt-BR");
                document.getElementById("event-time").textContent = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            }

            PRICE_PER_TICKET = parseFloat(tipo.preco) || 0;
            updatePrice(1);
            return;
        } catch (err) {
            console.warn("API falhou ao carregar evento:", err.message);
        }
    }

    // ── Fallback: localStorage ─────────────────────────
    const stored = localStorage.getItem("eventoSelecionado");
    if (stored) {
        const ev = JSON.parse(stored);
        const imgFileFallback = ev.imagem;
        if (imgFileFallback) {
            document.getElementById("event-image").src = imgFileFallback.startsWith("/uploads/") || imgFileFallback.startsWith("http")
                ? `${BASE_URL}${imgFileFallback.startsWith("/") ? imgFileFallback : "/" + imgFileFallback}`
                : `${BASE_URL}/uploads/${imgFileFallback}`;
        } else {
            document.getElementById("event-image").src = "/frontend/imagens/placeholder.jpg";
        }
        document.getElementById("event-name").textContent = ev.nome || "Evento Desconhecido";
        document.getElementById("event-date").textContent = ev.data || "--/--/----";
        document.getElementById("event-time").textContent = ev.hora || "--:--";
        document.getElementById("event-location").textContent = ev.local || "Local Desconhecido";
        document.getElementById("ticket-type").textContent = ev.ingressoNome || "Ingresso Padrão";
        PRICE_PER_TICKET = parseFloat(ev.ingressoPreco) || 30.00;

        // ← Salva evento_id e tipo no estado global para o finalizarCompra usar
        eventoAtual = { id: ev.evento_id, titulo: ev.nome };
        tipoAtual = { id: ev.tipo_ingresso_id, nome: ev.ingressoNome };
    } else {
        PRICE_PER_TICKET = 30.00;
    }
    updatePrice(1);
}

/* ==================================================
   FINALIZAR COMPRA
================================================== */
async function finalizarCompra(forma_pagamento) {

    const usuarioId = getUserId();
    if (!usuarioId) {
        alert("Você precisa estar logado para comprar ingressos.");
        window.location.href = "/frontend/login/login.html";
        return;
    }

    const btnCartao = document.getElementById("btn-pagar-cartao");
    const btnPix = document.getElementById("btn-pix-pay");
    const btnAtivo = forma_pagamento === "credito" ? btnCartao : btnPix;
    if (btnAtivo) { btnAtivo.disabled = true; btnAtivo.textContent = "Processando..."; }

    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;

    // Pega IDs — prioridade: estado global → URL params → localStorage
    const params = new URLSearchParams(window.location.search);
    const storedEvento = JSON.parse(localStorage.getItem("eventoSelecionado") || "{}");
    const eventoId = eventoAtual?.id || params.get("evento_id") || storedEvento?.evento_id;
    const tipoIngressoId = tipoAtual?.id || params.get("tipo_ingresso_id") || storedEvento?.tipo_ingresso_id;

    console.log("🛒 finalizarCompra →", { usuarioId, eventoId, tipoIngressoId, forma_pagamento, quantidade });

    if (!eventoId || !tipoIngressoId) {
        alert("Erro: dados do evento não encontrados. Volte e selecione o ingresso novamente.");
        if (btnAtivo) { btnAtivo.disabled = false; btnAtivo.textContent = "Tentar novamente"; }
        return;
    }

    const body = {
        usuario_id: usuarioId,
        evento_id: eventoId,
        forma_pagamento,
        itens: [{ tipo_ingresso_id: tipoIngressoId, quantidade }],
    };

    try {
        const res = await fetch(`${BASE_URL}/ingressos/comprar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
            console.error("❌ Erro da API:", data);
            alert("Erro ao processar compra: " + (data.erro || "Tente novamente."));
            if (btnAtivo) { btnAtivo.disabled = false; btnAtivo.textContent = "Tentar novamente"; }
            return;
        }

        if (pixTimerInterval) clearInterval(pixTimerInterval);

        const subtotal = quantidade * PRICE_PER_TICKET;
        const taxa = subtotal * SERVICE_TAX_RATE;

        sessionStorage.setItem("compraConfirmada", JSON.stringify({
            pedido_id: data.pedido_id,
            status: data.status,
            mensagem: data.mensagem,
            ingressos: data.ingressos,
            nome: eventoAtual?.titulo || eventoAtual?.nome || document.getElementById("event-name").textContent,
            data: document.getElementById("event-date").textContent,
            hora: document.getElementById("event-time").textContent,
            local: document.getElementById("event-location").textContent,
            ingressoNome: tipoAtual?.nome || document.getElementById("ticket-type").textContent,
            ingressoPreco: PRICE_PER_TICKET,
            quantidade,
            subtotal,
            taxaServico: taxa,
            totalPago: subtotal + taxa,
            forma_pagamento,
        }));

        window.location.href = "../ResumoDaCompra/CompraConfirmada.html";

    } catch (err) {
        console.error("❌ Erro na requisição:", err);
        alert("Erro de conexão com o servidor. Verifique se o backend está rodando.");
        if (btnAtivo) { btnAtivo.disabled = false; btnAtivo.textContent = "Tentar novamente"; }
    }
}

/* ==================================================
   INICIALIZAÇÃO
================================================== */
/* ==================================================
   INICIALIZAÇÃO
================================================== */
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof estaLogado === "function" ? !estaLogado() : !getUserId()) {
        alert("Você precisa estar logado ou criar uma conta para comprar ingressos.");
        window.location.href = "/frontend/login/login.html";
        return;
    }

    await loadEventData();
    aplicarMascaras();
    configurarValidacaoRealTime();
});