const API_URL = window.API_BASE
    || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://projeto-integrador-roles.onrender.com');

// Se não encontrar os elementos do login, encerra o script
if (!document.getElementById("login-form") && !document.getElementById("forgotPasswordBox")) {
    throw new Error("Login.js carregado fora do contexto correto.");
}

function mostrarNotificacao(elementId, mensagem, tipo = "erro") {
    const el = document.getElementById(elementId);
    const icones = {
        sucesso: "fa-circle-check",
        erro: "fa-circle-exclamation",
        aviso: "fa-triangle-exclamation"
    };

    el.className = `notificacao ativa ${tipo}`;
    el.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;

    setTimeout(() => {
        el.className = "notificacao";
    }, 5000);
}

const clienteBtn    = document.getElementById("cliente-btn");
const empresarioBtn = document.getElementById("empresario-btn");
const mainText      = document.getElementById("main-text");
const subText       = document.getElementById("sub-text");
const form          = document.getElementById("login-form");
const inputEmail    = document.getElementById("email");
const inputPassword = document.getElementById("password");
const headerIframe  = document.getElementById("site-header");

/* ==================================================
================ HEADER LOGIN ========================
================================================== */

function enviarLoginParaHeader(name, email, userType, photoUrl) {
    if (headerIframe && headerIframe.contentWindow) {
        headerIframe.contentWindow.postMessage({
            action: "LOGIN_SUCCESS",
            newName: name,
            newEmail: email,
            newPicUrl: photoUrl || "https://i.imgur.com/default-placeholder.png",
            userType: userType
        }, "*");
        console.log("Mensagem enviada para iframe");
    }
}

/* ==================================================
================ BOTÕES CLIENTE =====================
================================================== */

if (clienteBtn && empresarioBtn) {

    clienteBtn.addEventListener("click", () => {
        clienteBtn.classList.add("active");
        empresarioBtn.classList.remove("active");
        mainText.textContent = "Encontre os melhores lugares para sair e se divertir";
        subText.textContent  = "Entre rapidamente com";
    });

    empresarioBtn.addEventListener("click", () => {
        empresarioBtn.classList.add("active");
        clienteBtn.classList.remove("active");
        mainText.textContent = "Cadastre seu estabelecimento e aumente sua visibilidade";
        subText.textContent  = "Entre rapidamente com";
    });

}

/* ==================================================
================ LOGIN ==============================
================================================== */

if (form) {

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = inputEmail.value.trim();
        const senha = inputPassword.value;

        if (!email || !senha) {
            mostrarNotificacao("notificacaoLogin", "Preencha todos os campos.", "aviso");
            return;
        }

        try {

            const response = await fetch(`${API_URL}/usuarios/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();
            console.log("📩 Backend:", data);

            if (response.ok) {

                // ── Login bem-sucedido ──
                localStorage.setItem("userIsLoggedIn", "true");
                localStorage.setItem("userType", "usuario");
                localStorage.setItem("userId", data.id);
                localStorage.setItem("token", data.token);

                const nome = data.nome_completo || "Cliente Rolês";
                localStorage.setItem("profileName", nome);

                const foto = data.foto_perfil || "";
                if (foto) {
                    localStorage.setItem("profilePhotoUrl", foto);
                } else {
                    localStorage.removeItem("profilePhotoUrl");
                }

                localStorage.setItem("profileEmail", email);
                enviarLoginParaHeader(nome, email, "usuario", foto);

                if (window.parent && window.parent !== window) {
                    window.parent.postMessage("LOGIN_SUCCESS", "*");
                } else {
                    window.location.href = "../index.html";
                }

            } else if (response.status === 429 && data.bloqueado) {

                // ── Conta bloqueada ──
                const minutos = data.minutosRestantes || 30;

                mostrarNotificacao(
                    "notificacaoLogin",
                    `🔒 Conta bloqueada por ${minutos} minuto(s). Tente novamente mais tarde ou redefina sua senha.`,
                    "erro"
                );

                // Desabilita o botão de login durante o bloqueio
                const btnEntrar = form.querySelector("button[type='submit']");
                if (btnEntrar) {
                    btnEntrar.disabled      = true;
                    btnEntrar.style.opacity = "0.5";
                    btnEntrar.style.cursor  = "not-allowed";

                    setTimeout(() => {
                        btnEntrar.disabled      = false;
                        btnEntrar.style.opacity = "";
                        btnEntrar.style.cursor  = "";
                        mostrarNotificacao(
                            "notificacaoLogin",
                            "Bloqueio encerrado. Você já pode tentar novamente.",
                            "aviso"
                        );
                    }, minutos * 60 * 1000);
                }

                // Destaca o link de recuperação de senha
                const forgotLink = document.getElementById("forgotPasswordLink");
                if (forgotLink) {
                    forgotLink.style.fontWeight = "bold";
                    forgotLink.style.color      = "#e53e3e";
                    forgotLink.textContent      = "⚠️ Redefinir minha senha";
                }

            } else {

                // ── Senha errada — mostra tentativas restantes ──
                const tentativas = data.tentativasRestantes;

                if (tentativas !== undefined) {
                    mostrarNotificacao(
                        "notificacaoLogin",
                        `Senha incorreta. Você tem ${tentativas} tentativa(s) restante(s) antes do bloqueio.`,
                        "aviso"
                    );

                    inputPassword.style.borderColor = "#e53e3e";
                    setTimeout(() => {
                        inputPassword.style.borderColor = "";
                    }, 3000);

                } else {
                    mostrarNotificacao(
                        "notificacaoLogin",
                        data.erro || "Email ou senha incorretos.",
                        "erro"
                    );
                }

            }

        } catch (err) {
            console.error(err);
            mostrarNotificacao("notificacaoLogin", "Não foi possível conectar ao servidor.", "erro");
        }

    });

}

/* ==================================================
================ CADASTRO ===========================
================================================== */

const btnCadastrar = document.getElementById("btnCadastrar");

if (btnCadastrar) {
    btnCadastrar.addEventListener("click", (e) => {
        e.preventDefault();
        window.parent.location.href = "/Frontend/Cadastro/cadastro.html";
    });
}

/* ==================================================
================ MOSTRAR SENHA ======================
================================================== */

const togglePassword = document.getElementById("togglePassword");
const password       = document.getElementById("password");

if (togglePassword && password) {

    password.addEventListener("input", () => {
        if (password.value.length > 0) {
            togglePassword.classList.add("show");
        } else {
            togglePassword.classList.remove("show");
            password.type            = "password";
            togglePassword.textContent = "visibility";
        }
    });

    togglePassword.addEventListener("click", () => {
        if (password.type === "password") {
            password.type              = "text";
            togglePassword.textContent = "visibility_off";
        } else {
            password.type              = "password";
            togglePassword.textContent = "visibility";
        }
    });

}

/* ==================================================
================ RECUPERAR SENHA ====================
================================================== */

const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotPasswordBox  = document.getElementById("forgotPasswordBox");
const backToLogin        = document.getElementById("backToLogin");
const loginContent       = document.getElementById("loginContent");

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginContent.style.display = "none";
        forgotPasswordBox.classList.add("active");
    });
}

if (backToLogin) {
    backToLogin.addEventListener("click", () => {
        forgotPasswordBox.classList.remove("active");
        loginContent.style.display = "block";
    });
}

/* ==================================================
================ ENVIAR CÓDIGO ======================
================================================== */

const sendRecoveryBtn = document.getElementById("sendRecoveryBtn");

if (sendRecoveryBtn) {

    sendRecoveryBtn.addEventListener("click", async () => {

        const email = document.getElementById("recoveryEmail").value.trim();

        if (!email) {
            mostrarNotificacao("notificacaoRecuperar", "Digite seu e-mail.", "aviso");
            return;
        }

        try {

            const response = await fetch(`${API_URL}/usuarios/recuperar-senha`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                mostrarNotificacao("notificacaoRecuperar", "Código enviado para seu e-mail.", "sucesso");
                document.getElementById("etapaEmail").style.display    = "none";
                document.getElementById("etapaRedefinir").style.display = "flex";
            } else {
                mostrarNotificacao("notificacaoRecuperar", data.erro, "erro");
            }

        } catch (err) {
            console.log(err);
            mostrarNotificacao("notificacaoRecuperar", "Erro ao enviar o código.", "erro");
        }

    });

}

/* ==================================================
================ REDEFINIR SENHA ====================
================================================== */

const redefinirSenhaBtn = document.getElementById("redefinirSenhaBtn");

if (redefinirSenhaBtn) {

    redefinirSenhaBtn.addEventListener("click", async () => {

        const email     = document.getElementById("recoveryEmail").value.trim();
        const codigo    = document.getElementById("codigoRecuperacao").value.trim();
        const novaSenha = document.getElementById("novaSenha").value;

        if (!email || !codigo || !novaSenha) {
            mostrarNotificacao("notificacaoRecuperar", "Preencha todos os campos.", "aviso");
            return;
        }

        try {

            const response = await fetch(`${API_URL}/usuarios/redefinir-senha`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, codigo, novaSenha })
            });

            const data = await response.json();

            if (response.ok) {

                mostrarNotificacao("notificacaoRecuperar", "Senha redefinida com sucesso!", "sucesso");

                document.getElementById("recoveryEmail").value          = "";
                document.getElementById("codigoRecuperacao").value      = "";
                document.getElementById("novaSenha").value              = "";
                document.getElementById("etapaEmail").style.cssText     = "display: none !important";
                document.getElementById("etapaRedefinir").style.cssText = "display: none !important";

                setTimeout(() => {
                    document.getElementById("etapaEmail").style.cssText     = "";
                    document.getElementById("etapaRedefinir").style.cssText  = "";
                    forgotPasswordBox.classList.remove("active");
                    loginContent.style.display = "block";
                }, 2000);

            } else {
                mostrarNotificacao("notificacaoRecuperar", data.erro, "erro");
            }

        } catch (err) {
            console.log(err);
            mostrarNotificacao("notificacaoRecuperar", "Erro ao redefinir a senha.", "erro");
        }

    });

}