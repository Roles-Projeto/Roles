"use strict";

/* ==================================================
   CONFIGURAÇÃO
================================================== */
// Se o config.js não definir a URL da API, usa o backend local (porta 3000)
// quando a página roda no Live Server (127.0.0.1:5502). Sem isso, as chamadas
// iam para o próprio Live Server e davam erro (404/405).
const _hostLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = window.API_BASE_URL || window.API_BASE || (_hostLocal ? "http://localhost:3000" : "");

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

// Quantas compras PAGAS o usuário já fez (null = desconhecido: sem benefício)
let COMPRAS_PAGAS = null;

// Resposta do backend: o usuário ainda tem direito ao benefício de boas-vindas?
// Quem decide é o servidor (olha pedidos pagos, CPF e benefícios já usados).
// Começa false: sem resposta do servidor, a tela não mostra desconto.
let BENEFICIO_DISPONIVEL = false;

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
   AUTENTICAÇÃO E ASSENTOS (ingresso numerado)
================================================== */
// Cabeçalhos com o token de login. O backend usa o token para saber quem está
// comprando (e para conferir que os assentos foram reservados por essa pessoa).
function headersAutenticados() {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

// Devolve o evento salvo pela tela de detalhes quando ele tem assentos marcados;
// senão null. Ingresso numerado: a quantidade é o número de assentos escolhidos.
function assentosDoEstado() {
    try {
        const ev = JSON.parse(localStorage.getItem("eventoSelecionado") || "{}");
        if (ev.tipo_selecao === "numerado" && Array.isArray(ev.assento_ids) && ev.assento_ids.length) return ev;
    } catch (_) { }
    return null;
}

// Monta a lista de itens da compra, com os assentos quando o ingresso é numerado
function montarItens(tipoIngressoId, quantidade) {
    const item = { tipo_ingresso_id: tipoIngressoId, quantidade };
    const marcado = assentosDoEstado();
    if (marcado && String(marcado.tipo_ingresso_id) === String(tipoIngressoId)) {
        item.assento_ids = marcado.assento_ids;
    }
    return [item];
}

// Token vencido: avisa e manda para o login
function tratarSessaoExpirada() {
    showToast("Sua sessão expirou. Entre novamente para concluir a compra.", "warn");
    setTimeout(() => { window.location.href = "/frontend/login/login.html"; }, 1800);
}

/* ==================================================
   BENEFÍCIO DE BOAS-VINDAS (só na 1ª compra)
   A regra fica em /frontend/js/beneficios.js. Aqui só mostramos o valor;
   quem vale de verdade é o cálculo do backend.
   A tela só mostra o desconto quando o backend diz que o benefício está
   disponível (beneficioDisponivel) E o usuário não tem nenhuma compra paga.
================================================== */
async function carregarStatusBeneficio() {
    // Sempre começa sem benefício: só liga se o backend confirmar agora
    BENEFICIO_DISPONIVEL = false;
    COMPRAS_PAGAS = null;

    if (!localStorage.getItem("token")) {
        console.warn("[beneficio] sem token no localStorage: desconto desativado");
        return;
    }
    try {
        const res = await fetch(`${BASE_URL}/beneficios/status`, {
            headers: headersAutenticados(),
            cache: "no-store", // nunca reaproveitar uma resposta antiga
        });
        if (!res.ok) {
            console.warn(`[beneficio] GET ${BASE_URL}/beneficios/status respondeu ${res.status}: desconto desativado`);
            return;
        }
        const dados = await res.json();
        const n = Number(dados.comprasPagas);
        COMPRAS_PAGAS = Number.isFinite(n) ? n : null;
        BENEFICIO_DISPONIVEL = dados.beneficioDisponivel === true;
        console.log("[beneficio]", { comprasPagas: COMPRAS_PAGAS, disponivel: BENEFICIO_DISPONIVEL });
    } catch (err) {
        console.warn("[beneficio] erro ao consultar /beneficios/status:", err.message);
    }
}

function calcularPedidoAtual(quantidade) {
    const nome = tipoAtual?.nome || document.getElementById("ticket-type")?.textContent || "";
    return window.Beneficios.calcularPedido({
        precoUnitario: PRICE_PER_TICKET,
        quantidade,
        comprasPagas: COMPRAS_PAGAS ?? 0,
        elegivel: BENEFICIO_DISPONIVEL && COMPRAS_PAGAS === 0 && !/meia/i.test(nome),
    });
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

/* ==================================================
   TOAST DE FEEDBACK (substitui os alert() nativos)
================================================== */
function _injectToastStyleCompra() {
    if (document.getElementById('compraToastStyle')) return;
    const s = document.createElement('style');
    s.id = 'compraToastStyle';
    s.textContent = `
        @keyframes compraToastIn  { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:translateY(0)} }
        @keyframes compraToastOut { from{opacity:1; transform:translateY(0)} to{opacity:0; transform:translateY(14px)} }
        .compra-toast {
            position:fixed; bottom:28px; right:28px; z-index:99999;
            max-width:380px; background:#1C1834; color:#F1EDFA;
            padding:16px 18px; border-radius:12px;
            font-family:'Inter', sans-serif; font-size:13.5px; font-weight:500; line-height:1.5;
            display:flex; align-items:flex-start; gap:12px;
            border:1px solid #322850;
            box-shadow:0 10px 28px rgba(0,0,0,.45);
            animation: compraToastIn .25s ease;
        }
        .compra-toast-icon {
            width:26px; height:26px; border-radius:50%; flex-shrink:0;
            display:flex; align-items:center; justify-content:center;
            font-size:13px; font-weight:800; color:#160f28;
        }
        .compra-toast-text { flex:1; }
        .compra-toast-close {
            background:none; border:none; color:#9689B8; cursor:pointer;
            font-size:16px; line-height:1; padding:0; flex-shrink:0; margin-left:auto;
        }
        .compra-toast-close:hover { color:#F1EDFA; }
        @media (max-width:480px) {
            .compra-toast { left:16px; right:16px; bottom:16px; max-width:none; }
        }
    `;
    document.head.appendChild(s);
}

function showToast(mensagem, tipo = "info") {
    _injectToastStyleCompra();
    document.querySelectorAll(".compra-toast").forEach(t => t.remove());

    const cores   = { success: "#35D399", error: "#FF5C7A", warn: "#FFB627", info: "#6AA9FF" };
    const icones  = { success: "✓",       error: "✕",       warn: "!",       info: "i" };

    const toast = document.createElement("div");
    toast.className = "compra-toast";

    const bolinha = document.createElement("span");
    bolinha.className = "compra-toast-icon";
    bolinha.style.background = cores[tipo] || cores.info;
    bolinha.textContent = icones[tipo] || icones.info;

    const texto = document.createElement("span");
    texto.className = "compra-toast-text";
    texto.textContent = mensagem;

    const fechar = document.createElement("button");
    fechar.className = "compra-toast-close";
    fechar.innerHTML = "&times;";
    fechar.onclick = () => toast.remove();

    toast.appendChild(bolinha);
    toast.appendChild(texto);
    toast.appendChild(fechar);
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "compraToastOut .25s ease forwards";
        setTimeout(() => toast.remove(), 260);
    }, 5000);
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

    // "input" pega quem digita; "change" pega o preenchimento automático do navegador
    ["nome", "cpf"].forEach(id => {
        const campo = document.getElementById(id);
        if (!campo) return;
        campo.addEventListener("input", sincronizarResumoPagador);
        campo.addEventListener("change", sincronizarResumoPagador);
    });
}

function sincronizarResumoPagador() {
    const nome = document.getElementById("nome")?.value || "—";
    const cpf = document.getElementById("cpf")?.value || "—";
    ["pix", "boleto"].forEach(m => {
        const n = document.getElementById(`${m}-nome-display`);
        const c = document.getElementById(`${m}-cpf-display`);
        if (n) n.textContent = nome;
        if (c) c.textContent = cpf;
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

    sincronizarResumoPagador();

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
    sincronizarResumoPagador();
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
    sincronizarResumoPagador();

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
    return calcularPedidoAtual(quantidade).total;
}

function updatePrice(quantity) {
    const r = calcularPedidoAtual(quantity);

    document.getElementById("quantidade").value = quantity;
    document.getElementById("subtotal").textContent = formatBRL(r.subtotal);
    document.getElementById("total").textContent = formatBRL(r.total);
    document.getElementById("ticket-price-display").textContent = formatBRL(PRICE_PER_TICKET);
    document.getElementById("subtotal-label").textContent =
        `Subtotal (${quantity}x ${formatBRL(PRICE_PER_TICKET)})`;

    // Linha do desconto de boas-vindas
    const rowDesconto = document.getElementById("row-desconto");
    if (rowDesconto) {
        rowDesconto.style.display = r.beneficio ? "" : "none";
        if (r.beneficio) {
            const qb = Math.min(quantity, r.beneficio.ingressos);
            document.getElementById("desconto-label").textContent =
                `Desconto de boas-vindas (${Math.round(r.beneficio.percentual * 100)}% sobre ${qb} ingresso de ${formatBRL(PRICE_PER_TICKET)})`;
            document.getElementById("desconto-valor").textContent = "- " + formatBRL(r.desconto);
        }
    }

    // Taxa de serviço: o valor final e, logo abaixo, o detalhe de como foi calculada
    const taxaLabel = document.getElementById("taxa-label");
    if (taxaLabel) taxaLabel.textContent = "Taxa de serviço (10%)";
    document.getElementById("taxa").textContent =
        (r.taxaDispensada > 0 && r.taxa === 0) ? "Grátis" : formatBRL(r.taxa);

    atualizarDetalheResumo(r, quantity);

    const btnPagar = document.getElementById("btn-pagar-cartao");
    aplicarModoGratuito();
    if (btnPagar) btnPagar.textContent = `Pagar ${formatBRL(r.total)}`;
}

/* ==================================================
   DETALHAMENTO DO RESUMO (mostra ao cliente como cada valor foi calculado)
================================================== */
function injetarEstiloResumo() {
    if (document.getElementById("resumoDetalheStyle")) return;
    const st = document.createElement("style");
    st.id = "resumoDetalheStyle";
    st.textContent = `
        .price-row .price { white-space: nowrap; }
        .price-row > span:first-child { min-width: 0; }
        .resumo-detalhe { margin: -2px 0 10px; padding-left: 10px; border-left: 2px solid #e4dcf7; font-size: 12px; line-height: 1.5; color: #6b6585; }
        .resumo-detalhe div + div { margin-top: 2px; }
        .resumo-economia { display: flex; justify-content: space-between; gap: 12px; margin: 10px 0; padding: 9px 12px; border-radius: 8px; background: #e8f8ee; color: #176b3a; font-size: 13px; font-weight: 600; }
    `;
    document.head.appendChild(st);
}

function atualizarDetalheResumo(r, quantity) {
    injetarEstiloResumo();

    const taxaRow = document.getElementById("taxa")?.closest(".price-row");
    const totalRow = document.querySelector(".price-breakdown .total-row");
    if (!taxaRow || !totalRow) return;

    let detalhe = document.getElementById("taxa-detalhe");
    if (!detalhe) {
        detalhe = document.createElement("div");
        detalhe.id = "taxa-detalhe";
        detalhe.className = "resumo-detalhe";
        taxaRow.insertAdjacentElement("afterend", detalhe);
    }

    let economia = document.getElementById("resumo-economia");
    if (!economia) {
        economia = document.createElement("div");
        economia.id = "resumo-economia";
        economia.className = "resumo-economia";
        totalRow.insertAdjacentElement("beforebegin", economia);
    }

    // Sem benefício: nada a detalhar além da taxa de 10%
    if (!r.beneficio) {
        detalhe.style.display = "none";
        economia.style.display = "none";
        return;
    }

    const qb = Math.min(quantity, r.beneficio.ingressos);
    const resto = quantity - qb;
    const taxaPorIngresso = PRICE_PER_TICKET * SERVICE_TAX_RATE;

    const linhas = [
        `Taxa grátis em ${qb} ingresso (você economiza ${formatBRL(r.taxaDispensada)})`,
    ];
    if (resto > 0) {
        linhas.push(
            `Taxa de 10% em ${resto} ingresso${resto > 1 ? "s" : ""}: ` +
            `${resto} x ${formatBRL(taxaPorIngresso)} = ${formatBRL(r.taxa)}`
        );
    }
    detalhe.innerHTML = linhas.map(t => `<div>${t}</div>`).join("");
    detalhe.style.display = "";

    const economizado = r.desconto + r.taxaDispensada;
    economia.innerHTML =
        `<span>Você está economizando nesta compra</span><span>${formatBRL(economizado)}</span>`;
    economia.style.display = "";
}

function changeQuantity(change) {
    // Ingresso numerado: a quantidade segue os assentos escolhidos na tela do evento
    if (assentosDoEstado()) {
        showToast("A quantidade segue os assentos escolhidos. Para mudar, volte e escolha de novo.", "info");
        return;
    }

    const input = document.getElementById("quantidade");
    const newValue = parseInt(input.value) + change;
    if (newValue >= 1 && newValue <= MAX_AVAILABLE_TICKETS) updatePrice(newValue);
}


/* ==================================================
   MODO GRATUITO
================================================== */
function aplicarModoGratuito() {
    const gratuito = PRICE_PER_TICKET === 0;
    const blocoPagamento = document.getElementById("bloco-pagamento");
    const blocoGratuito = document.getElementById("bloco-gratuito");
    if (blocoPagamento) blocoPagamento.style.display = gratuito ? "none" : "";
    if (blocoGratuito) blocoGratuito.style.display = gratuito ? "" : "none";
}

async function handleGratuitoSubmit() {
    if (!validarDadosPessoais()) {
        const firstError = document.querySelector(".input-wrapper input.invalid");
        if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }

    const usuarioId = getUserId();
    if (!usuarioId) {
        showToast("Você precisa estar logado para confirmar presença.", "warn");
        setTimeout(() => { window.location.href = "/frontend/login/login.html"; }, 1800);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const storedEvento = JSON.parse(localStorage.getItem("eventoSelecionado") || "{}");
    const eventoId = eventoAtual?.id || params.get("evento_id") || storedEvento?.evento_id;
    const tipoIngressoId = tipoAtual?.id || params.get("tipo_ingresso_id") || storedEvento?.tipo_ingresso_id;
    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;

    if (!eventoId || !tipoIngressoId) {
        showToast("Dados do evento não encontrados. Volte e selecione o ingresso novamente.", "error");
        return;
    }

    const btn = document.getElementById("btn-confirmar-presenca");
    if (btn) { btn.disabled = true; btn.textContent = "Confirmando..."; }

    try {
        const res = await fetch(`${BASE_URL}/ingressos/comprar`, {
            method: "POST",
            headers: headersAutenticados(),
            body: JSON.stringify({
                usuario_id: usuarioId,
                evento_id: eventoId,
                itens: montarItens(tipoIngressoId, quantidade),
            }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            if (btn) { btn.disabled = false; btn.textContent = "Confirmar Presença"; }
            tratarSessaoExpirada();
            return;
        }

        if (!res.ok) {
            showToast(data.erro || "Não foi possível confirmar a presença.", res.status >= 500 ? "error" : "warn");
            if (btn) { btn.disabled = false; btn.textContent = "Confirmar Presença"; }
            return;
        }

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
            ingressoPreco: 0,
            quantidade,
            subtotal: 0,
            taxaServico: 0,
            totalPago: 0,
            forma_pagamento: "gratuito",
        }));

        window.location.href = "/frontend/detalheseventos/confirmacao.html";
    } catch (err) {
        console.error("Erro ao confirmar presença:", err);
        showToast("Erro de conexão com o servidor. Tente novamente em instantes.", "error");
        if (btn) { btn.disabled = false; btn.textContent = "Confirmar Presença"; }
    }
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
    let quantidadeInicial = 1;
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

        // Ingresso numerado: mostra os assentos escolhidos junto do nome do ingresso
        const rotulosAssentos = ev.tipo_selecao === "numerado" && Array.isArray(ev.assento_rotulos) && ev.assento_rotulos.length
            ? ` - ${ev.assento_rotulos.length > 1 ? "Assentos" : "Assento"} ${ev.assento_rotulos.join(", ")}`
            : "";
        const nomeExibicao = (ev.ingressoNome || "Ingresso Padrão") + rotulosAssentos;
        document.getElementById("ticket-type").textContent = nomeExibicao;

        const precoStored = parseFloat(ev.ingressoPreco);
        PRICE_PER_TICKET = Number.isNaN(precoStored) ? 30.00 : precoStored;

        // Limite de quantidade vindo da tela de detalhes (em vez do "85" fixo)
        const maxStored = Number(ev.maxQuantidade);
        if (Number.isFinite(maxStored) && maxStored >= 1) {
            MAX_AVAILABLE_TICKETS = maxStored;
            const disponEl = document.querySelector(".quantity-control span");
            if (disponEl) disponEl.textContent = `Máximo de ${maxStored} por compra`;
        }

        // Mantém a quantidade que o usuário escolheu na tela do evento
        const qtdStored = Number(ev.quantidade);
        if (Number.isFinite(qtdStored) && qtdStored >= 1) {
            quantidadeInicial = Math.min(qtdStored, MAX_AVAILABLE_TICKETS);
        }

        // ← Salva evento_id e tipo no estado global para o finalizarCompra usar
        eventoAtual = { id: ev.evento_id, titulo: ev.nome };
        tipoAtual = { id: ev.tipo_ingresso_id, nome: nomeExibicao };
    } else {
        PRICE_PER_TICKET = 30.00;
    }

    // Ingresso numerado: a quantidade é o número de assentos escolhidos
    const marcado = assentosDoEstado();
    if (marcado) {
        quantidadeInicial = marcado.assento_ids.length;
        MAX_AVAILABLE_TICKETS = quantidadeInicial;
    }
    updatePrice(quantidadeInicial);
}

/* ==================================================
   FINALIZAR COMPRA
================================================== */
function restaurarBotaoPagamento(forma_pagamento) {
    if (forma_pagamento === "credito") {
        const btn = document.getElementById("btn-pagar-cartao");
        if (btn) { btn.disabled = false; btn.textContent = `Pagar ${document.getElementById("total").textContent}`; }
    } else if (forma_pagamento === "pix") {
        const btn = document.getElementById("btn-pix-pay");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-check-circle" style="margin-right:8px;"></i>Tentar novamente`;
        }
    }
}

async function finalizarCompra(forma_pagamento) {

    const usuarioId = getUserId();
    if (!usuarioId) {
        showToast("Você precisa estar logado para comprar ingressos.", "warn");
        setTimeout(() => { window.location.href = "/frontend/login/login.html"; }, 1800);
        return;
    }
    const btnCartao = document.getElementById("btn-pagar-cartao");
    const btnPix = document.getElementById("btn-pix-pay");
    const btnAtivo = forma_pagamento === "credito" ? btnCartao : (forma_pagamento === "pix" ? btnPix : null);
    if (btnAtivo) { btnAtivo.disabled = true; btnAtivo.textContent = "Processando..."; }

    const quantidade = parseInt(document.getElementById("quantidade").value) || 1;

    // Pega IDs — prioridade: estado global → URL params → localStorage
    const params = new URLSearchParams(window.location.search);
    const storedEvento = JSON.parse(localStorage.getItem("eventoSelecionado") || "{}");
    const eventoId = eventoAtual?.id || params.get("evento_id") || storedEvento?.evento_id;
    const tipoIngressoId = tipoAtual?.id || params.get("tipo_ingresso_id") || storedEvento?.tipo_ingresso_id;

    console.log("finalizarCompra", { usuarioId, eventoId, tipoIngressoId, forma_pagamento, quantidade });

    if (!eventoId || !tipoIngressoId) {
        showToast("Dados do evento não encontrados. Volte e selecione o ingresso novamente.", "error");
        restaurarBotaoPagamento(forma_pagamento);
        return;
    }

    const body = {
        usuario_id: usuarioId,
        evento_id: eventoId,
        forma_pagamento,
        itens: montarItens(tipoIngressoId, quantidade),
    };

    try {
        const res = await fetch(`${BASE_URL}/ingressos/comprar`, {
            method: "POST",
            headers: headersAutenticados(),
            body: JSON.stringify(body),
        });
        // Se o servidor devolver HTML (ex.: erro 404/500 da página), não quebra aqui
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            restaurarBotaoPagamento(forma_pagamento);
            tratarSessaoExpirada();
            return;
        }

        if (!res.ok) {
            console.error(`Erro da API (${res.status}) em ${BASE_URL}/ingressos/comprar:`, data);
            showToast(data.erro || `Não foi possível processar sua compra (erro ${res.status}). Tente novamente.`, "error");
            restaurarBotaoPagamento(forma_pagamento);
            return;
        }

        if (pixTimerInterval) clearInterval(pixTimerInterval);

        // Valores oficiais vêm da resposta do servidor. O cálculo da tela
        // (calcularPedidoAtual) só entra como reserva se algum campo faltar.
        const calculo = calcularPedidoAtual(quantidade);

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
            subtotal: data.subtotal ?? calculo.subtotal,
            taxaServico: data.taxa_servico ?? calculo.taxa,
            totalPago: data.total_pago ?? calculo.total,
            desconto: data.desconto ?? calculo.desconto,
            beneficio: data.beneficio ?? null,
            forma_pagamento,
        }));

        window.location.href = "confirmacao.html";

    } catch (err) {
        console.error("Erro na requisição:", err);
        showToast("Erro de conexão com o servidor. Tente novamente em instantes.", "error");
        restaurarBotaoPagamento(forma_pagamento);
    }
}

/* ==================================================
   INICIALIZAÇÃO
================================================== */
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof estaLogado === "function" ? !estaLogado() : !getUserId()) {
        showToast("Você precisa estar logado ou criar uma conta para comprar ingressos.", "warn");
        setTimeout(() => { window.location.href = "/frontend/login/login.html"; }, 1800);
        return;
    }

    await carregarStatusBeneficio();
    await loadEventData();
    aplicarMascaras();
    configurarValidacaoRealTime();
    sincronizarResumoPagador();
});