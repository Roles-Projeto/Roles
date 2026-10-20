// ========================
// CONFIG API
// ========================
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? "http://localhost:3000" : window.location.origin;

// ========================
// DEBUG INICIAL
// ========================
console.log("🚨 JS CADASTRO CARREGADO 🚨");

// ========================
// FORM
// ========================
const form = document.getElementById("cadastroForm");

// ========================
// CAMPOS DE ERRO
// ========================
const erroNome = document.getElementById("erroNome");
const erroEmail = document.getElementById("erroEmail");
const erroSenha = document.getElementById("erroSenha");
const erroConfirmar = document.getElementById("erroConfirmar");
const erroCpf = document.getElementById("erroCpf"); 
// ========================
// ELEMENTOS MODAL
// ========================
const modal = document.getElementById("modalCodigo");
const escolhaMetodo = document.getElementById("escolhaMetodo");
const areaCodigo = document.getElementById("areaCodigo");
const mensagemEnvio = document.getElementById("mensagemEnvio");

const btnVerificar = document.getElementById("btnVerificar");
const btnVerificarTexto = document.getElementById("btnVerificarTexto");
const btnVerificarSpinner = document.getElementById("btnVerificarSpinner");

const inputCodigo = document.getElementById("codigo");

const reenviarCodigo = document.getElementById("reenviarCodigo");
const outraForma = document.getElementById("outraForma");

const areaTelefone = document.getElementById("areaTelefone");
const telefoneAlternativo = document.getElementById("telefoneAlternativo");
const btnEnviarTelefone = document.getElementById("btnEnviarTelefone");

// ========================
// BOTÃO CRIAR
// ========================
const btnCriar = document.getElementById("btnCriar");
const btnCriarTexto = document.getElementById("btnCriarTexto");
const btnCriarSpinner = document.getElementById("btnCriarSpinner");

// ========================
// VARIÁVEIS
// ========================
let metodoSelecionado = null;
let dadosTemporarios = null;
let tempoRestante = 60;
let intervaloTimer = null;
let bloqueioVerificar = false;

// ========================
// TOGGLE SENHA
// ========================
function configurarToggleSenha(btnId, inputId, iconeId) {

    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const icone = document.getElementById(iconeId);

    if (!btn || !input || !icone) return;

    btn.addEventListener("click", () => {

        const visivel = input.type === "text";

        input.type = visivel ? "password" : "text";

        icone.className = visivel
            ? "fa-regular fa-eye"
            : "fa-regular fa-eye-slash";
    });
}

configurarToggleSenha(
    "toggleSenha",
    "senha",
    "iconeSenha"
);

configurarToggleSenha(
    "toggleConfirmar",
    "confirmarSenha",
    "iconeConfirmar"
);

// ========================
// FORÇA SENHA
// ========================
const inputSenha = document.getElementById("senha");

const forcaSenhaWrapper =
    document.getElementById("forcaSenhaWrapper");

const forcaLabel =
    document.getElementById("forcaLabel");

const segmentos = [
    document.getElementById("seg1"),
    document.getElementById("seg2"),
    document.getElementById("seg3"),
    document.getElementById("seg4"),
];

const niveis = [
    { label: "", cor: "" },
    { label: "Fraca", cor: "#e63946" },
    { label: "Média", cor: "#f4a261" },
    { label: "Boa", cor: "#2a9d8f" },
    { label: "Forte", cor: "#5b0ea6" },
];

function calcularForca(senha) {

    let pontos = 0;

    if (senha.length >= 8) pontos++;

    if (/[A-Za-z]/.test(senha)) pontos++;

    if (/\d/.test(senha)) pontos++;

    if (/[@$!%*#?&]/.test(senha)) pontos++;

    return pontos;
}

function atualizarForca(senha) {

    if (!senha) {

        forcaSenhaWrapper.style.opacity = "0";

        segmentos.forEach(seg => {
            seg.style.background = "";
        });

        forcaLabel.textContent = "";

        return;
    }

    forcaSenhaWrapper.style.opacity = "1";

    const nivel = calcularForca(senha);

    const { label, cor } =
        niveis[nivel] || niveis[0];

    segmentos.forEach((seg, i) => {

        seg.style.background =
            i < nivel ? cor : "#e8e0f0";

        seg.style.transition =
            "background 0.3s ease";
    });

    forcaLabel.textContent = label;
    forcaLabel.style.color = cor;
}

inputSenha.addEventListener("input", () => {
    atualizarForca(inputSenha.value);
});

// ========================
// MÁSCARA TELEFONE
// ========================
function mascaraTelefone(input) {

    if (!input) return;

    input.addEventListener("input", () => {

        let valor =
            input.value
                .replace(/\D/g, "")
                .slice(0, 11);

        if (valor.length > 10) {

            valor = valor.replace(
                /^(\d{2})(\d{1})(\d{4})(\d{0,4}).*/,
                "($1) $2 $3-$4"
            );

        } else if (valor.length > 6) {

            valor = valor.replace(
                /^(\d{2})(\d{4})(\d{0,4}).*/,
                "($1) $2-$3"
            );

        } else if (valor.length > 2) {

            valor = valor.replace(
                /^(\d{2})(\d*)/,
                "($1) $2"
            );

        } else if (valor.length > 0) {

            valor = valor.replace(
                /^(\d*)/,
                "($1"
            );
        }

        input.value = valor;
    });
}

mascaraTelefone(
    document.getElementById("telefone")
);

mascaraTelefone(
    document.getElementById("telefoneAlternativo")
);

// ========================
// MÁSCARA CPF
// ========================
function mascaraCPF(input) {

    if (!input) return;

    input.addEventListener("input", () => {

        let valor =
            input.value
                .replace(/\D/g, "")
                .slice(0, 11);

        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

        input.value = valor;
    });
}

mascaraCPF(
    document.getElementById("cpf")
);

// ========================
// VALIDAR CPF
// ========================
function validarCPF(cpf) {

    cpf = cpf.replace(/\D/g, "");

    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[10])) return false;

    return true;
}

// ========================
// BOTÃO LOADING
// ========================
function setBtnCriarLoading(loading) {

    btnCriar.disabled = loading;

    if (loading) {

        btnCriarTexto.style.display = "none";

        btnCriarSpinner.classList.remove("hidden");

    } else {

        btnCriarTexto.style.display = "";

        btnCriarSpinner.classList.add("hidden");
    }
}

// ========================
// LIMPAR ERROS
// ========================
function limparErros() {

    erroNome.textContent = "";
    erroEmail.textContent = "";
    erroSenha.textContent = "";
    erroConfirmar.textContent = "";
    erroCpf.textContent = ""; 

    document.querySelectorAll("input")
        .forEach(input => {
            input.classList.remove("erro-input");
        });
}

// ========================
// SUBMIT
// ========================
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    console.log("📤 SUBMIT DISPAROU");

    limparErros();

    const nome_completo =
        document.getElementById("nome")
            .value
            .trim();

    const cpf =
         document.getElementById("cpf")
        .value
        .trim();

    const email =
        document.getElementById("email")
            .value
            .trim();

    const telefone =
        document.getElementById("telefone")
            .value
            .trim();

    const senha =
        document.getElementById("senha")
            .value
            .trim();

    const confirmarSenha =
        document.getElementById("confirmarSenha")
            .value
            .trim();

    let temErro = false;

    // ========================
    // VALIDAÇÕES
    // ========================

    if (nome_completo.length < 3) {

        erroNome.textContent =
            "Digite seu nome completo";

        document.getElementById("nome")
            .classList.add("erro-input");

        temErro = true;
    }

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {

        erroEmail.textContent =
            "Digite um e-mail válido";

        document.getElementById("email")
            .classList.add("erro-input");

        temErro = true;
    }

   if (!validarCPF(cpf)) {

    erroCpf.textContent =
        "CPF inválido. Verifique os números digitados.";

    document.getElementById("cpf")
        .classList.add("erro-input");

    temErro = true;
}

    const senhaRegex =
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;

    if (!senhaRegex.test(senha)) {

        erroSenha.textContent =
            "Senha fraca";

        document.getElementById("senha")
            .classList.add("erro-input");

        temErro = true;
    }

    if (senha !== confirmarSenha) {

        erroConfirmar.textContent =
            "As senhas não coincidem";

        document.getElementById("confirmarSenha")
            .classList.add("erro-input");

        temErro = true;
    }

    if (temErro) return;

    // ========================
    // ENVIO API
    // ========================

    setBtnCriarLoading(true);

    try {

        console.log("🌐 ENVIANDO PARA API...");

        const response = await fetch(
            `${API_URL}/usuarios/cadastro`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
    nome_completo,
    email,
    telefone,
    cpf,        // ADICIONAR
    senha
})
            }
        );

        console.log(
            "📡 STATUS:",
            response.status
        );

        let data = {};

        try {

            data = await response.json();

        } catch {

            console.warn("Resposta sem JSON");
        }

        console.log("📦 RESPOSTA:", data);

        if (!response.ok) {

            alert(
                data.erro ||
                data.message ||
                "Erro ao cadastrar"
            );

            return;
        }

        dadosTemporarios = {
            nome_completo,
            email,
            telefone,
            senha
        };

        console.log("✅ CADASTRO OK");

        abrirModal();

    } catch (erro) {

        console.error("❌ ERRO:", erro);

        alert(
            "Erro ao conectar com o servidor."
        );

    } finally {

        setBtnCriarLoading(false);
    }
});

// ========================
// ABRIR MODAL
// ========================
function abrirModal() {

    modal.classList.remove("hidden");

    metodoSelecionado = "email";

    const emailMascarado =
        mascararEmail(
            dadosTemporarios.email
        );

    mensagemEnvio.textContent =
        `Enviamos um código para ${emailMascarado}`;

    if (escolhaMetodo) {
        escolhaMetodo.style.display = "none";
    }

    areaCodigo.style.display = "block";

    iniciarTimerReenvio();

    setTimeout(() => {
        inputCodigo.focus();
    }, 100);
}

// ========================
// FECHAR MODAL
// ========================
function fecharModal() {

    modal.classList.add("hidden");

    clearInterval(intervaloTimer);

    inputCodigo.value = "";
}

// ========================
// MASCARAR EMAIL
// ========================
function mascararEmail(email) {

    const [nome, dominio] =
        email.split("@");

    return (
        nome.slice(0, 3) +
        "****@" +
        dominio
    );
}

// ========================
// MASCARAR TELEFONE
// ========================
function mascararTelefone(telefone) {

    if (!telefone) return "";

    return (
        telefone.slice(0, 6) +
        "****" +
        telefone.slice(-4)
    );
}

// ========================
// ENVIAR CÓDIGO
// ========================
async function enviarCodigo(metodo) {

    metodoSelecionado = metodo;

    try {

        const response = await fetch(
            `${API_URL}/usuarios/enviar-codigo`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: dadosTemporarios.email,
                    metodo
                })
            }
        );

        let data = {};

        try {

            data = await response.json();

        } catch {}

        if (!response.ok) {

            alert(
                data.erro ||
                "Erro ao enviar código"
            );

            return false;
        }

        return true;

    } catch (erro) {

        console.error(erro);

        alert("Erro ao enviar código");

        return false;
    }
}

// ========================
// TIMER
// ========================
function iniciarTimerReenvio() {

    clearInterval(intervaloTimer);

    tempoRestante = 60;

    reenviarCodigo.disabled = true;

    reenviarCodigo.innerHTML =
        `Reenviar em <span id="timer">${tempoRestante}</span>s`;

    intervaloTimer = setInterval(() => {

        tempoRestante--;

        const timer =
            document.getElementById("timer");

        if (timer) {
            timer.textContent = tempoRestante;
        }

        if (tempoRestante <= 0) {

            clearInterval(intervaloTimer);

            reenviarCodigo.disabled = false;

            reenviarCodigo.textContent =
                "Reenviar código";
        }

    }, 1000);
}

// ========================
// REENVIAR
// ========================
reenviarCodigo.addEventListener(
    "click",
    async () => {

        if (!metodoSelecionado) return;

        reenviarCodigo.disabled = true;

        reenviarCodigo.textContent =
            "Enviando...";

        const enviado =
            await enviarCodigo(
                metodoSelecionado
            );

        if (enviado) {

            alert("📩 Código reenviado!");

            iniciarTimerReenvio();
        }
    }
);

// ========================
// OUTRA FORMA
// ========================
outraForma.addEventListener(
    "click",
    async () => {

        if (dadosTemporarios.telefone) {

            await enviarCodigo("telefone");

            mensagemEnvio.textContent =
                `Código enviado para ${mascararTelefone(
                    dadosTemporarios.telefone
                )}`;

        } else {

            areaTelefone.style.display =
                "block";
        }
    }
);

// ========================
// TELEFONE ALTERNATIVO
// ========================
btnEnviarTelefone.addEventListener(
    "click",
    async () => {

        const telefone =
            telefoneAlternativo.value.trim();

        if (!telefone) {

            alert("Digite um telefone");

            return;
        }

        dadosTemporarios.telefone =
            telefone;

        await enviarCodigo("telefone");

        mensagemEnvio.textContent =
            `Código enviado para ${mascararTelefone(
                telefone
            )}`;

        areaTelefone.style.display =
            "none";
    }
);

// ========================
// VERIFICAR CÓDIGO
// ========================
btnVerificar.addEventListener(
    "click",
    async () => {

        if (bloqueioVerificar) {

            alert(
                "Aguarde antes de tentar novamente"
            );

            return;
        }

        const codigo =
            inputCodigo.value.trim();

        if (!codigo || codigo.length < 6) {

            alert(
                "Digite o código de 6 dígitos"
            );

            return;
        }

        btnVerificar.disabled = true;

        btnVerificarTexto.style.display =
            "none";

        btnVerificarSpinner.classList.remove(
            "hidden"
        );

        try {

            const response = await fetch(
                `${API_URL}/usuarios/verificar-codigo`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email:
                            dadosTemporarios.email,

                        codigo
                    })
                }
            );

            const data =
                await response.json();

            if (data.verificado) {

                alert(
                    "✅ Conta verificada!"
                );

                fecharModal();

                window.location.href =
                    "../login/login.html";

            } else {

                alert("❌ Código inválido");

                inputCodigo.value = "";

                inputCodigo.focus();

                bloqueioVerificar = true;

                setTimeout(() => {
                    bloqueioVerificar = false;
                }, 3000);
            }

        } catch (erro) {

            console.error(erro);

            alert(
                "Erro ao verificar código"
            );

        } finally {

            btnVerificar.disabled = false;

            btnVerificarTexto.style.display =
                "";

            btnVerificarSpinner.classList.add(
                "hidden"
            );
        }
    }
);

// ========================
// SOMENTE NÚMEROS
// ========================
inputCodigo.addEventListener(
    "input",
    () => {

        inputCodigo.value =
            inputCodigo.value
                .replace(/\D/g, "")
                .slice(0, 6);
    }
);
