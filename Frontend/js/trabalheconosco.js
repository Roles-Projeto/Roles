const API_URL = window.API_BASE
    || (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://projeto-integrador-roles.onrender.com"
    );


/* ==================================================
================ CONFIGURAÇÃO ========================
================================================== */

/*
 * Vagas de tecnologia, agrupadas por área.
 * O texto escolhido é enviado ao backend no campo "vaga".
 * Para abrir ou fechar uma vaga, basta editar esta lista.
 */
const VAGAS = [
    {
        grupo: "Desenvolvimento",
        itens: [
            "Desenvolvedor Frontend Júnior",
            "Desenvolvedor Frontend Pleno",
            "Desenvolvedor Frontend Sênior",
            "Desenvolvedor Backend Júnior",
            "Desenvolvedor Backend Pleno",
            "Desenvolvedor Backend Sênior",
            "Desenvolvedor Fullstack Júnior",
            "Desenvolvedor Fullstack Pleno",
            "Desenvolvedor Fullstack Sênior",
            "Desenvolvedor Mobile"
        ]
    },
    {
        grupo: "Qualidade",
        itens: [
            "Engenheiro de Qualidade de Software (QA)"
        ]
    },
    {
        grupo: "Dados e IA",
        itens: [
            "Cientista de Dados",
            "Engenheiro de Dados",
            "Engenheiro de IA",
            "Especialista em BI"
        ]
    },
    {
        grupo: "Infraestrutura e segurança",
        itens: [
            "Analista de Infraestrutura / DevOps",
            "Analista de Segurança da Informação"
        ]
    },
    {
        grupo: "Outras áreas de TI",
        itens: [
            "Analista de Sistemas",
            "Analista de Suporte",
            "Arquiteto de Software",
            "Outra vaga de TI (banco de talentos)"
        ]
    }
];

// Lista simples, usada para validar o valor vindo da URL
const TODAS_AS_VAGAS = VAGAS.flatMap(g => g.itens);

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXTENSOES_PERMITIDAS = ["pdf", "png", "jpg", "jpeg", "webp"];

const TIPOS_PERMITIDOS = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp"
];


/* ==================================================
================ ELEMENTOS ===========================
================================================== */

const form = document.getElementById("tc-form");
const inputNome = document.getElementById("tc-nome");
const inputWhatsapp = document.getElementById("tc-whatsapp");
const inputEmail = document.getElementById("tc-email");
const selectVaga = document.getElementById("tc-vaga");
const inputCidade = document.getElementById("tc-cidade");
const inputCurriculo = document.getElementById("tc-curriculo");
const inputHoneypot = document.getElementById("tc-website");

const btnSubmit = document.getElementById("tcSubmit");

const dropzone = document.getElementById("tcDropzone");
const arquivoNome = document.getElementById("tcArquivoNome");
const arquivoInfo = document.getElementById("tcArquivoInfo");
const arquivoRemover = document.getElementById("tcArquivoRemover");

const formContent = document.getElementById("tcFormContent");
const successBox = document.getElementById("tcSuccess");

const TEXTO_PADRAO_ARQUIVO = "Anexar currículo";
const INFO_PADRAO_ARQUIVO = "PDF ou imagem, até 5 MB";


/* ==================================================
================ NOTIFICAÇÕES ========================
================================================== */

let notificacaoTimeout = null;

function mostrarNotificacao(mensagem, tipo = "erro", persistente = false) {
    const el = document.getElementById("notificacaoTc");

    if (!el) return;

    const icones = {
        sucesso: "fa-circle-check",
        erro: "fa-circle-exclamation",
        aviso: "fa-triangle-exclamation"
    };

    if (notificacaoTimeout) {
        clearTimeout(notificacaoTimeout);
        notificacaoTimeout = null;
    }

    el.className = `notificacao ativa ${tipo}`;

    // textContent (e não innerHTML) para nunca interpretar texto vindo do servidor como HTML
    el.textContent = "";

    const icone = document.createElement("i");
    icone.className = `fa-solid ${icones[tipo] || icones.erro}`;

    const texto = document.createElement("span");
    texto.textContent = mensagem;

    el.appendChild(icone);
    el.appendChild(texto);

    if (!persistente) {
        notificacaoTimeout = setTimeout(() => {
            el.className = "notificacao";
            notificacaoTimeout = null;
        }, 6000);
    }
}


/* ==================================================
================ VAGAS ===============================
================================================== */

function carregarVagas() {
    VAGAS.forEach(({ grupo, itens }) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = grupo;

        itens.forEach(vaga => {
            const option = document.createElement("option");
            option.value = vaga;
            option.textContent = vaga;
            optgroup.appendChild(option);
        });

        selectVaga.appendChild(optgroup);
    });

    // Permite pré-selecionar pela URL: ?vaga=Nome da vaga
    const vagaUrl = new URLSearchParams(window.location.search).get("vaga");

    if (vagaUrl && TODAS_AS_VAGAS.includes(vagaUrl)) {
        selectVaga.value = vagaUrl;
    }
}


/* ==================================================
================ MÁSCARA DO WHATSAPP =================
================================================== */

function formatarWhatsapp(valor) {
    const d = valor.replace(/\D/g, "").slice(0, 11);

    if (!d) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;

    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

inputWhatsapp.addEventListener("input", () => {
    inputWhatsapp.value = formatarWhatsapp(inputWhatsapp.value);
    inputWhatsapp.classList.remove("invalido");
});


/* ==================================================
================ CURRÍCULO ===========================
================================================== */

function formatarTamanho(bytes) {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function limparArquivo() {
    inputCurriculo.value = "";

    arquivoNome.textContent = TEXTO_PADRAO_ARQUIVO;
    arquivoInfo.textContent = INFO_PADRAO_ARQUIVO;

    arquivoRemover.hidden = true;

    dropzone.classList.remove("com-arquivo");
}

function validarArquivo(file) {
    const extensao = (file.name.split(".").pop() || "").toLowerCase();

    if (
        !EXTENSOES_PERMITIDAS.includes(extensao) ||
        (file.type && !TIPOS_PERMITIDOS.includes(file.type))
    ) {
        return "Formato inválido. Envie um PDF ou uma imagem (PNG, JPG ou WEBP).";
    }

    if (file.size > TAMANHO_MAX_BYTES) {
        return `O arquivo tem ${formatarTamanho(file.size)}. O limite é 5 MB.`;
    }

    return null;
}

function aplicarArquivo(file) {
    const erro = validarArquivo(file);

    if (erro) {
        limparArquivo();
        mostrarNotificacao(erro, "aviso");
        return;
    }

    arquivoNome.textContent = file.name;
    arquivoInfo.textContent = formatarTamanho(file.size);

    arquivoRemover.hidden = false;

    dropzone.classList.add("com-arquivo");
}

inputCurriculo.addEventListener("change", () => {
    const file = inputCurriculo.files[0];

    if (!file) {
        limparArquivo();
        return;
    }

    aplicarArquivo(file);
});

arquivoRemover.addEventListener("click", (e) => {
    // O botão fica dentro do <label>: evita abrir o seletor de arquivos
    e.preventDefault();
    e.stopPropagation();

    limparArquivo();
});

// Arrastar e soltar
["dragenter", "dragover"].forEach(evento => {
    dropzone.addEventListener(evento, (e) => {
        e.preventDefault();
        dropzone.classList.add("arrastando");
    });
});

["dragleave", "drop"].forEach(evento => {
    dropzone.addEventListener(evento, (e) => {
        e.preventDefault();
        dropzone.classList.remove("arrastando");
    });
});

dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files[0];

    if (!file) return;

    const erro = validarArquivo(file);

    if (erro) {
        limparArquivo();
        mostrarNotificacao(erro, "aviso");
        return;
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    inputCurriculo.files = dt.files;

    aplicarArquivo(file);
});


/* ==================================================
================ VALIDAÇÃO ===========================
================================================== */

function marcarInvalido(campo) {
    campo.classList.add("invalido");
    campo.focus();
}

[inputNome, inputEmail, selectVaga].forEach(campo => {
    campo.addEventListener("input", () => campo.classList.remove("invalido"));
    campo.addEventListener("change", () => campo.classList.remove("invalido"));
});

function validarFormulario() {
    const nome = inputNome.value.trim();
    const whatsappDigitos = inputWhatsapp.value.replace(/\D/g, "");
    const email = inputEmail.value.trim();
    const vaga = selectVaga.value;

    if (nome.length < 3) {
        marcarInvalido(inputNome);
        return "Informe seu nome completo.";
    }

    if (whatsappDigitos.length < 10 || whatsappDigitos.length > 11) {
        marcarInvalido(inputWhatsapp);
        return "Informe um WhatsApp válido, com DDD.";
    }

    if (!vaga) {
        marcarInvalido(selectVaga);
        return "Escolha a vaga de interesse.";
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        marcarInvalido(inputEmail);
        return "O e-mail informado não é válido.";
    }

    const file = inputCurriculo.files[0];

    if (file) {
        const erroArquivo = validarArquivo(file);

        if (erroArquivo) {
            return erroArquivo;
        }
    }

    return null;
}


/* ==================================================
================ ENVIO ===============================
================================================== */

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot preenchido = robô: finge sucesso e não envia nada
    if (inputHoneypot.value) {
        mostrarSucesso();
        return;
    }

    const erro = validarFormulario();

    if (erro) {
        mostrarNotificacao(erro, "aviso");
        return;
    }

    const dados = new FormData();

    dados.append("nome", inputNome.value.trim());
    dados.append("whatsapp", inputWhatsapp.value.replace(/\D/g, ""));
    dados.append("vaga", selectVaga.value);

    const email = inputEmail.value.trim();
    const cidade = inputCidade.value.trim();

    if (email) dados.append("email", email);
    if (cidade) dados.append("cidade_estado", cidade);

    if (inputCurriculo.files[0]) {
        dados.append("curriculo", inputCurriculo.files[0]);
    }

    btnSubmit.disabled = true;

    const textoOriginal = btnSubmit.querySelector("span").textContent;

    btnSubmit.querySelector("span").textContent = "Enviando...";

    try {

        // Sem header Content-Type: o navegador define o boundary do multipart
        const response = await fetch(`${API_URL}/candidaturas`, {
            method: "POST",
            body: dados
        });

        let data = {};

        try {
            data = await response.json();
        } catch (_) {
            // resposta sem JSON
        }

        if (response.ok) {
            mostrarSucesso();
            return;
        }

        if (response.status === 429) {
            mostrarNotificacao(
                data.erro || "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
                "erro"
            );
            return;
        }

        mostrarNotificacao(
            data.erro || "Não foi possível enviar sua candidatura.",
            "erro"
        );

    } catch (err) {

        console.error("❌ Candidatura:", err);

        mostrarNotificacao("Não foi possível conectar ao servidor.", "erro");

    } finally {

        btnSubmit.disabled = false;
        btnSubmit.querySelector("span").textContent = textoOriginal;
    }
});

function mostrarSucesso() {
    formContent.hidden = true;
    successBox.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}


/* ==================================================
================ INICIAR =============================
================================================== */

carregarVagas();