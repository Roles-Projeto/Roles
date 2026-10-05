const API_URL = window.API_BASE
    || (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://projeto-integrador-roles.onrender.com"
    );


/* ==================================================
================ VALIDAÇÃO ==========================
================================================== */

if (
    !document.getElementById("login-form") &&
    !document.getElementById("forgotPasswordBox")
) {
    throw new Error(
        "Login.js carregado fora do contexto correto."
    );
}


/* ==================================================
================ NOTIFICAÇÕES ========================
================================================== */

let notificacaoTimeout = null;

function mostrarNotificacao(
    elementId,
    mensagem,
    tipo = "erro",
    persistente = false
) {
    const el =
        document.getElementById(elementId);

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

    el.className =
        `notificacao ativa ${tipo}`;

    el.innerHTML =
        `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;

    if (!persistente) {
        notificacaoTimeout =
            setTimeout(() => {
                el.className =
                    "notificacao";

                notificacaoTimeout =
                    null;
            }, 5000);
    }
}


/* ==================================================
================ ELEMENTOS ===========================
================================================== */

const clienteBtn =
    document.getElementById("cliente-btn");

const empresarioBtn =
    document.getElementById("empresario-btn");

const mainText =
    document.getElementById("main-text");

const subText =
    document.getElementById("sub-text");

const form =
    document.getElementById("login-form");

const inputEmail =
    document.getElementById("email");

const inputPassword =
    document.getElementById("password");

const headerIframe =
    document.getElementById("site-header");


/* ==================================================
================ HEADER ==============================
================================================== */

function enviarLoginParaHeader(
    name,
    email,
    userType,
    photoUrl
) {
    if (
        headerIframe &&
        headerIframe.contentWindow
    ) {
        headerIframe.contentWindow.postMessage(
            {
                action: "LOGIN_SUCCESS",
                newName: name,
                newEmail: email,
                newPicUrl:
                    photoUrl ||
                    "https://i.imgur.com/default-placeholder.png",
                userType
            },
            "*"
        );

        console.log(
            "Mensagem enviada para iframe"
        );
    }
}


/* ==================================================
================ TIPO DE USUÁRIO =====================
================================================== */

if (
    clienteBtn &&
    empresarioBtn
) {
    clienteBtn.addEventListener(
        "click",
        () => {

            clienteBtn.classList.add(
                "active"
            );

            empresarioBtn.classList.remove(
                "active"
            );

            if (mainText) {
                mainText.textContent =
                    "Encontre os melhores lugares para sair e se divertir";
            }

            if (subText) {
                subText.textContent =
                    "Entre rapidamente com";
            }
        }
    );


    empresarioBtn.addEventListener(
        "click",
        () => {

            empresarioBtn.classList.add(
                "active"
            );

            clienteBtn.classList.remove(
                "active"
            );

            if (mainText) {
                mainText.textContent =
                    "Cadastre seu estabelecimento e aumente sua visibilidade";
            }

            if (subText) {
                subText.textContent =
                    "Entre rapidamente com";
            }
        }
    );
}


/* ==================================================
================ CONCLUIR LOGIN ======================
================================================== */

function concluirLogin(
    data,
    email
) {
    if (
        !data ||
        !data.token
    ) {
        console.error(
            "❌ Resposta de login sem token:",
            data
        );

        mostrarNotificacao(
            "notificacaoLogin",
            "Não foi possível concluir o login.",
            "erro"
        );

        return;
    }


    /*
     * SOMENTE AQUI o JWT normal
     * é colocado no localStorage.
     *
     * Antes disso, existe apenas o
     * token temporário em memória.
     */

    localStorage.setItem(
        "userIsLoggedIn",
        "true"
    );

    localStorage.setItem(
        "userType",
        "usuario"
    );

    localStorage.setItem(
        "userId",
        data.id
    );

    localStorage.setItem(
        "token",
        data.token
    );


    const nome =
        data.nome_completo ||
        "Cliente Rolês";

    localStorage.setItem(
        "profileName",
        nome
    );


    const foto =
        data.foto_perfil || "";

    if (foto) {

        localStorage.setItem(
            "profilePhotoUrl",
            foto
        );

    } else {

        localStorage.removeItem(
            "profilePhotoUrl"
        );
    }


    const emailFinal =
        email ||
        data.email ||
        "";

    localStorage.setItem(
        "profileEmail",
        emailFinal
    );


    enviarLoginParaHeader(
        nome,
        emailFinal,
        "usuario",
        foto
    );


    const params =
        new URLSearchParams(
            window.location.search
        );

    const redirect =
        params.get("redirect");


    if (redirect) {

        window.location.href =
            redirect;

    } else if (
        window.parent &&
        window.parent !== window
    ) {

        window.parent.postMessage(
            "LOGIN_SUCCESS",
            "*"
        );

    } else {

        window.location.href =
            "../index.html";
    }
}


/* ==================================================
================ ESTADO DO 2FA =======================
================================================== */

/*
 * IMPORTANTE:
 *
 * Esses valores ficam somente
 * na memória da página.
 *
 * NUNCA salvar tokenTemporario2fa
 * no localStorage.
 */

let tokenTemporario2fa = null;

let emailPendente2fa = null;


/*
 * "login"
 * = usuário já possui 2FA.
 *
 * "setup"
 * = primeiro acesso, ativando 2FA.
 */

let modo2fa = null;


/*
 * Dados temporários usados enquanto
 * mostramos os códigos de recuperação.
 */

let loginPendenteDepoisSetup = null;


/* ==================================================
================ ELEMENTOS DO 2FA ====================
================================================== */

const twoFactorBox =
    document.getElementById(
        "twoFactorBox"
    );

const loginContentEl =
    document.getElementById(
        "loginContent"
    );


const otpInputs =
    Array.from(
        document.querySelectorAll(
            ".otp-input"
        )
    );


const setupOtpInputs =
    Array.from(
        document.querySelectorAll(
            ".setup-otp-input"
        )
    );


const verificar2faBtn =
    document.getElementById(
        "verificar2faBtn"
    );


const backToLogin2fa =
    document.getElementById(
        "backToLogin2fa"
    );


const textoTwoFactor =
    document.getElementById(
        "twoFactorTexto"
    );


const etapaCodigoApp =
    document.getElementById(
        "etapaCodigoApp"
    );


const email2faExibido =
    document.getElementById(
        "email2faExibido"
    );


const emailSetup2faExibido =
    document.getElementById(
        "emailSetup2faExibido"
    );


const alternar2fa =
    document.getElementById(
        "alternar2fa"
    );


const etapaCodigoRecuperacao =
    document.getElementById(
        "etapaCodigoRecuperacao"
    );


const inputCodigoRecuperacao =
    document.getElementById(
        "codigoRecuperacao2fa"
    );


/*
 * A tela de configuração antiga
 * por QR não será utilizada.
 *
 * Caso ainda exista no HTML,
 * deixamos escondida.
 */

const twoFactorSetupBox =
    document.getElementById(
        "twoFactorSetupBox"
    );

if (twoFactorSetupBox) {

    twoFactorSetupBox.style.display =
        "none";
}


/* ==================================================
================ CÓDIGO 2FA ==========================
================================================== */

function codigoDigitado2fa() {

    return otpInputs
        .map(
            input =>
                input.value
        )
        .join("");
}


function limparCodigo2fa() {

    otpInputs.forEach(
        input => {

            input.value =
                "";

            input.classList.remove(
                "preenchido",
                "invalido"
            );
        }
    );
}


/* ==================================================
================ ABRIR ETAPA 2FA =====================
================================================== */

function abrirEtapa2fa() {

    if (
        !twoFactorBox ||
        !loginContentEl
    ) {

        console.error(
            "❌ Elementos da tela 2FA não encontrados."
        );

        return;
    }


    loginContentEl.style.display =
        "none";


    twoFactorBox.classList.add(
        "active"
    );


    /*
     * Texto diferente para:
     *
     * login normal
     * ou primeira ativação.
     */

    if (textoTwoFactor) {

        if (
            modo2fa === "setup"
        ) {

            textoTwoFactor.textContent =
                "Enviamos um código de 6 dígitos para o seu e-mail. Digite o código abaixo para ativar a verificação em duas etapas.";

        } else {

            textoTwoFactor.textContent =
                "Enviamos um código de 6 dígitos para o seu e-mail. Digite o código abaixo para continuar.";
        }
    }


    /*
     * Mostra o e-mail.
     */

    if (email2faExibido) {

        email2faExibido.textContent =
            emailPendente2fa
                ? `Código enviado para: ${emailPendente2fa}`
                : "";
    }


    if (emailSetup2faExibido) {

        emailSetup2faExibido.textContent =
            emailPendente2fa
                ? `Código enviado para: ${emailPendente2fa}`
                : "";
    }


    /*
     * Código normal.
     */

    if (etapaCodigoApp) {

        etapaCodigoApp.style.display =
            "flex";
    }


    /*
     * Recuperação antiga fica escondida.
     */

    if (etapaCodigoRecuperacao) {

        etapaCodigoRecuperacao.style.display =
            "none";
    }


    /*
     * Como o código agora é por e-mail,
     * não mostramos "usar código de recuperação"
     * nessa primeira tela.
     */

    if (alternar2fa) {

        alternar2fa.style.display =
            "none";
    }


    limparCodigo2fa();


    if (otpInputs.length) {

        setTimeout(
            () => {
                otpInputs[0].focus();
            },
            100
        );
    }
}


/* ==================================================
================ FECHAR ETAPA 2FA ====================
================================================== */

function fecharEtapa2fa() {

    tokenTemporario2fa =
        null;

    emailPendente2fa =
        null;

    modo2fa =
        null;

    loginPendenteDepoisSetup =
        null;


    limparCodigo2fa();


    if (twoFactorBox) {

        twoFactorBox.classList.remove(
            "active"
        );
    }


    if (loginContentEl) {

        loginContentEl.style.display =
            "block";
    }


    if (inputPassword) {

        inputPassword.value =
            "";
    }


    const notif2fa =
        document.getElementById(
            "notificacao2fa"
        );

    if (notif2fa) {

        notif2fa.className =
            "notificacao";
    }
}


/* ==================================================
================ LOGIN ===============================
================================================== */

if (form) {

    form.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();


            const email =
                inputEmail
                    ? inputEmail.value.trim()
                    : "";


            const senha =
                inputPassword
                    ? inputPassword.value
                    : "";


            if (
                !email ||
                !senha
            ) {

                mostrarNotificacao(
                    "notificacaoLogin",
                    "Preencha todos os campos.",
                    "aviso"
                );

                return;
            }


            const btnEntrar =
                form.querySelector(
                    "button[type='submit']"
                );


            if (btnEntrar) {

                btnEntrar.disabled =
                    true;
            }


            try {

                const response =
                    await fetch(
                        `${API_URL}/usuarios/login`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    senha
                                })
                        }
                    );


                const data =
                    await response.json();


                console.log(
                    "📩 Backend:",
                    data
                );


                /* ==================================
                 * 2FA JÁ ATIVO
                 * ================================== */

                if (
                    response.ok &&
                    data.requer2fa &&
                    data.tokenTemporario
                ) {

                    tokenTemporario2fa =
                        data.tokenTemporario;

                    emailPendente2fa =
                        email;

                    modo2fa =
                        "login";

                    abrirEtapa2fa();

                    return;
                }


                /* ==================================
                 * PRIMEIRO ACESSO
                 *
                 * ATIVAR 2FA POR E-MAIL
                 * ================================== */

                if (
                    response.ok &&
                    data.requer2faSetup &&
                    data.tokenTemporario
                ) {

                    tokenTemporario2fa =
                        data.tokenTemporario;

                    emailPendente2fa =
                        email;

                    modo2fa =
                        "setup";

                    abrirEtapa2fa();

                    return;
                }


                /* ==================================
                 * LOGIN DIRETO
                 *
                 * Normalmente não deveria acontecer,
                 * pois o backend exige 2FA.
                 * ================================== */

                if (
                    response.ok &&
                    data.token
                ) {

                    concluirLogin(
                        data,
                        email
                    );

                    return;
                }


                /* ==================================
                 * CONTA BLOQUEADA
                 * ================================== */

                if (
                    response.status === 429 &&
                    data.bloqueado
                ) {

                    const minutos =
                        data.minutosRestantes ||
                        15;


                    mostrarNotificacao(
                        "notificacaoLogin",
                        `Conta bloqueada por ${minutos} minuto(s). Tente novamente mais tarde ou redefina sua senha.`,
                        "erro",
                        true
                    );


                    if (btnEntrar) {

                        btnEntrar.disabled =
                            true;

                        btnEntrar.style.opacity =
                            "0.5";

                        btnEntrar.style.cursor =
                            "not-allowed";


                        setTimeout(
                            () => {

                                btnEntrar.disabled =
                                    false;

                                btnEntrar.style.opacity =
                                    "";

                                btnEntrar.style.cursor =
                                    "";


                                mostrarNotificacao(
                                    "notificacaoLogin",
                                    "Bloqueio encerrado. Você já pode tentar novamente.",
                                    "aviso"
                                );

                            },
                            minutos * 60 * 1000
                        );
                    }


                    const forgotLink =
                        document.getElementById(
                            "forgotPasswordLink"
                        );


                    if (forgotLink) {

                        forgotLink.classList.add(
                            "destaque-recuperacao"
                        );

                        forgotLink.textContent =
                            "Redefinir minha senha";
                    }


                    return;
                }


                /* ==================================
                 * SENHA INCORRETA
                 * ================================== */

                const tentativas =
                    data.tentativasRestantes;


                if (
                    tentativas !== undefined
                ) {

                    mostrarNotificacao(
                        "notificacaoLogin",
                        `Senha incorreta. Você tem ${tentativas} tentativa(s) restante(s) antes do bloqueio.`,
                        "aviso"
                    );


                    if (inputPassword) {

                        inputPassword.style.borderColor =
                            "#e53e3e";


                        setTimeout(
                            () => {

                                inputPassword.style.borderColor =
                                    "";

                            },
                            3000
                        );
                    }

                } else {

                    mostrarNotificacao(
                        "notificacaoLogin",
                        data.erro ||
                            "Email ou senha incorretos.",
                        "erro"
                    );
                }


            } catch (err) {

                console.error(
                    "❌ Login:",
                    err
                );


                mostrarNotificacao(
                    "notificacaoLogin",
                    "Não foi possível conectar ao servidor.",
                    "erro"
                );


            } finally {

                if (btnEntrar) {

                    btnEntrar.disabled =
                        false;
                }
            }
        }
    );
}


/* ==================================================
================ VERIFICAR CÓDIGO ====================
================================================== */

async function verificarCodigo2fa() {

    const codigo =
        codigoDigitado2fa();


    if (
        !/^\d{6}$/.test(codigo)
    ) {

        mostrarNotificacao(
            "notificacao2fa",
            "Digite os 6 dígitos enviados para seu e-mail.",
            "aviso"
        );

        return;
    }


    if (
        !tokenTemporario2fa
    ) {

        fecharEtapa2fa();


        mostrarNotificacao(
            "notificacaoLogin",
            "Sua sessão de verificação expirou. Entre novamente.",
            "aviso"
        );

        return;
    }


    if (!verificar2faBtn) {
        return;
    }


    verificar2faBtn.disabled =
        true;

    verificar2faBtn.style.opacity =
        "0.6";


    try {

        let endpoint;

        let body;


        /* ==========================================
         * LOGIN NORMAL
         * ========================================== */

        if (
            modo2fa === "login"
        ) {

            endpoint =
                `${API_URL}/usuarios/2fa/verificar-login`;


            body = {
                tokenTemporario:
                    tokenTemporario2fa,

                codigo,

                recuperacao: false
            };
        }


        /* ==========================================
         * PRIMEIRA ATIVAÇÃO
         * ========================================== */

        else if (
            modo2fa === "setup"
        ) {

            endpoint =
                `${API_URL}/usuarios/2fa/ativar-inicial`;


            body = {
                tokenTemporario:
                    tokenTemporario2fa,

                codigo
            };
        }


        /* ==========================================
         * MODO INVÁLIDO
         * ========================================== */

        else {

            fecharEtapa2fa();


            mostrarNotificacao(
                "notificacaoLogin",
                "Sessão de autenticação inválida. Entre novamente.",
                "erro"
            );

            return;
        }


        console.log(
            "📤 Enviando verificação 2FA:",
            endpoint
        );


        const response =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body)
                }
            );


        const data =
            await response.json();


        console.log(
            "📩 Resposta 2FA:",
            data
        );


        /* ==========================================
         * SUCESSO
         * ========================================== */

        if (response.ok) {

            const email =
                emailPendente2fa;


            /*
             * Primeiro acesso:
             *
             * o backend acabou de ativar
             * o 2FA e entregou os códigos
             * de recuperação.
             */

            if (
                modo2fa === "setup" &&
                Array.isArray(
                    data.codigosRecuperacao
                )
            ) {

                loginPendenteDepoisSetup = {
                    data,
                    email
                };


                tokenTemporario2fa =
                    null;

                emailPendente2fa =
                    null;


                modo2fa =
                    null;


                mostrarCodigosRecuperacao(
                    data.codigosRecuperacao
                );


                return;
            }


            /*
             * Login normal.
             */

            tokenTemporario2fa =
                null;

            emailPendente2fa =
                null;

            modo2fa =
                null;


            concluirLogin(
                data,
                email
            );


            return;
        }


        /* ==========================================
         * TOKEN EXPIRADO
         * ========================================== */

        if (
            response.status === 401 &&
            data.expirado
        ) {

            fecharEtapa2fa();


            mostrarNotificacao(
                "notificacaoLogin",
                "O tempo da verificação acabou. Entre novamente.",
                "aviso"
            );

            return;
        }


        /* ==========================================
         * LIMITE DE TENTATIVAS
         * ========================================== */

        if (
            response.status === 429
        ) {

            mostrarNotificacao(
                "notificacao2fa",
                data.erro ||
                    "Número máximo de tentativas atingido. Solicite um novo código.",
                "erro",
                true
            );


            limparCodigo2fa();

            return;
        }


        /* ==========================================
         * CÓDIGO INCORRETO
         * ========================================== */

        mostrarNotificacao(
            "notificacao2fa",
            data.erro ||
                "Código inválido. Tente novamente.",
            "erro"
        );


        otpInputs.forEach(
            input => {

                input.classList.add(
                    "invalido"
                );
            }
        );


        setTimeout(
            () => {

                limparCodigo2fa();


                if (
                    otpInputs.length
                ) {

                    otpInputs[0].focus();
                }

            },
            500
        );


    } catch (err) {

        console.error(
            "❌ Verificação 2FA:",
            err
        );


        mostrarNotificacao(
            "notificacao2fa",
            "Não foi possível conectar ao servidor.",
            "erro"
        );


    } finally {

        verificar2faBtn.disabled =
            false;

        verificar2faBtn.style.opacity =
            "";
    }
}


/* ==================================================
================ CÓDIGOS DE RECUPERAÇÃO ==============
================================================== */

function mostrarCodigosRecuperacao(
    codigos
) {

    if (
        !twoFactorBox
    ) {
        console.error(
            "Caixa 2FA não encontrada."
        );

        return;
    }


    /*
     * Esconde elementos da verificação.
     */

    if (textoTwoFactor) {

        textoTwoFactor.style.display =
            "none";
    }


    if (email2faExibido) {

        email2faExibido.style.display =
            "none";
    }


    if (etapaCodigoApp) {

        etapaCodigoApp.style.display =
            "none";
    }


    if (verificar2faBtn) {

        verificar2faBtn.style.display =
            "none";
    }


    if (backToLogin2fa) {

        backToLogin2fa.style.display =
            "none";
    }


    /*
     * Remove tela anterior.
     */

    const anterior =
        document.getElementById(
            "recoveryCodesGenerated"
        );


    if (anterior) {
        anterior.remove();
    }


    /*
     * Cria container.
     */

    const box =
        document.createElement(
            "div"
        );


    box.id =
        "recoveryCodesGenerated";


    box.className =
        "recovery-codes-generated";


    /*
     * Ícone.
     */

    const icon =
        document.createElement(
            "div"
        );


    icon.className =
        "setup-recovery-icon";


    icon.innerHTML =
        `<i class="fas fa-shield-halved"></i>`;


    /*
     * Título.
     */

    const titulo =
        document.createElement(
            "h3"
        );


    titulo.textContent =
        "2FA ativado com sucesso!";


    /*
     * Texto.
     */

    const texto =
        document.createElement(
            "p"
        );


    texto.textContent =
        "Guarde estes códigos em um local seguro. Eles podem ser usados para recuperar o acesso à sua conta caso necessário.";


    /*
     * Aviso.
     */

    const aviso =
        document.createElement(
            "p"
        );


    aviso.className =
        "setup-recovery-warning";


    aviso.innerHTML =
        `<i class="fas fa-triangle-exclamation"></i>
         Cada código pode ser usado apenas uma vez.
         Eles não serão exibidos novamente.`;


    /*
     * Lista.
     */

    const lista =
        document.createElement(
            "div"
        );


    lista.className =
        "setup-recovery-list";


    codigos.forEach(
        codigo => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "recovery-code-item";


            item.textContent =
                codigo;


            lista.appendChild(
                item
            );
        }
    );


    /*
     * Botão continuar.
     */

    const continuar =
        document.createElement(
            "button"
        );


    continuar.type =
        "button";


    continuar.className =
        "btn-entrar";


    continuar.innerHTML =
        `<span>Continuar</span>
         <i class="fas fa-arrow-right"></i>`;


    continuar.addEventListener(
        "click",
        () => {

            if (
                !loginPendenteDepoisSetup
            ) {

                window.location.href =
                    "../index.html";

                return;
            }


            const dados =
                loginPendenteDepoisSetup;


            loginPendenteDepoisSetup =
                null;


            concluirLogin(
                dados.data,
                dados.email
            );
        }
    );


    /*
     * Monta a tela.
     */

    box.appendChild(
        icon
    );

    box.appendChild(
        titulo
    );

    box.appendChild(
        texto
    );

    box.appendChild(
        aviso
    );

    box.appendChild(
        lista
    );

    box.appendChild(
        continuar
    );


    twoFactorBox.appendChild(
        box
    );
}


/* ==================================================
================ INPUTS OTP ==========================
================================================== */

if (
    otpInputs.length
) {

    otpInputs.forEach(
        (
            input,
            index
        ) => {


            input.addEventListener(
                "input",
                () => {

                    input.value =
                        input.value
                            .replace(
                                /\D/g,
                                ""
                            )
                            .slice(
                                -1
                            );


                    input.classList.toggle(
                        "preenchido",
                        !!input.value
                    );


                    input.classList.remove(
                        "invalido"
                    );


                    if (
                        input.value &&
                        index <
                            otpInputs.length - 1
                    ) {

                        otpInputs[
                            index + 1
                        ].focus();
                    }
                }
            );


            input.addEventListener(
                "keydown",
                (e) => {

                    if (
                        e.key === "Backspace" &&
                        !input.value &&
                        index > 0
                    ) {

                        otpInputs[
                            index - 1
                        ].focus();
                    }


                    if (
                        e.key === "ArrowLeft" &&
                        index > 0
                    ) {

                        otpInputs[
                            index - 1
                        ].focus();
                    }


                    if (
                        e.key === "ArrowRight" &&
                        index <
                            otpInputs.length - 1
                    ) {

                        otpInputs[
                            index + 1
                        ].focus();
                    }


                    if (
                        e.key === "Enter"
                    ) {

                        verificarCodigo2fa();
                    }
                }
            );


            input.addEventListener(
                "focus",
                () => {
                    input.select();
                }
            );


            /*
             * Permite colar os 6 dígitos.
             */

            input.addEventListener(
                "paste",
                (e) => {

                    e.preventDefault();


                    const colado =
                        (
                            e.clipboardData
                                .getData("text") ||
                            ""
                        )
                            .replace(
                                /\D/g,
                                ""
                            )
                            .slice(
                                0,
                                otpInputs.length
                            );


                    if (!colado) {
                        return;
                    }


                    colado
                        .split("")
                        .forEach(
                            (
                                digito,
                                i
                            ) => {

                                if (
                                    !otpInputs[i]
                                ) {
                                    return;
                                }


                                otpInputs[i].value =
                                    digito;


                                otpInputs[i].classList.add(
                                    "preenchido"
                                );


                                otpInputs[i].classList.remove(
                                    "invalido"
                                );
                            }
                        );


                    const proximo =
                        Math.min(
                            colado.length,
                            otpInputs.length - 1
                        );


                    if (
                        otpInputs[proximo]
                    ) {

                        otpInputs[
                            proximo
                        ].focus();
                    }
                }
            );
        }
    );
}


/* ==================================================
================ BOTÃO VERIFICAR =====================
================================================== */

if (
    verificar2faBtn
) {

    verificar2faBtn.addEventListener(
        "click",
        verificarCodigo2fa
    );
}


/* ==================================================
================ VOLTAR PARA LOGIN ===================
================================================== */

if (
    backToLogin2fa
) {

    backToLogin2fa.addEventListener(
        "click",
        fecharEtapa2fa
    );
}


/* ==================================================
================ CADASTRO ============================
================================================== */

const btnCadastrar =
    document.getElementById(
        "btnCadastrar"
    );


if (
    btnCadastrar
) {

    btnCadastrar.addEventListener(
        "click",
        (e) => {

            e.preventDefault();


            window.parent.location.href =
                "/Frontend/Cadastro/cadastro.html";
        }
    );
}


/* ==================================================
================ MOSTRAR SENHA =======================
================================================== */

const togglePassword =
    document.getElementById(
        "togglePassword"
    );


const password =
    document.getElementById(
        "password"
    );


if (
    togglePassword &&
    password
) {

    password.addEventListener(
        "input",
        () => {

            if (
                password.value.length > 0
            ) {

                togglePassword.classList.add(
                    "show"
                );

            } else {

                togglePassword.classList.remove(
                    "show"
                );

                password.type =
                    "password";

                togglePassword.textContent =
                    "visibility";
            }
        }
    );


    togglePassword.addEventListener(
        "click",
        () => {

            if (
                password.type ===
                "password"
            ) {

                password.type =
                    "text";

                togglePassword.textContent =
                    "visibility_off";

            } else {

                password.type =
                    "password";

                togglePassword.textContent =
                    "visibility";
            }
        }
    );
}


/* ==================================================
================ RECUPERAR SENHA =====================
================================================== */

const forgotPasswordLink =
    document.getElementById(
        "forgotPasswordLink"
    );


const forgotPasswordBox =
    document.getElementById(
        "forgotPasswordBox"
    );


const backToLogin =
    document.getElementById(
        "backToLogin"
    );


const loginContent =
    document.getElementById(
        "loginContent"
    );


if (
    forgotPasswordLink
) {

    forgotPasswordLink.addEventListener(
        "click",
        (e) => {

            e.preventDefault();


            if (loginContent) {

                loginContent.style.display =
                    "none";
            }


            if (forgotPasswordBox) {

                forgotPasswordBox.classList.add(
                    "active"
                );
            }
        }
    );
}


if (
    backToLogin
) {

    backToLogin.addEventListener(
        "click",
        () => {

            if (
                forgotPasswordBox
            ) {

                forgotPasswordBox.classList.remove(
                    "active"
                );
            }


            if (
                loginContent
            ) {

                loginContent.style.display =
                    "block";
            }


            const btnEntrar =
                form &&
                form.querySelector(
                    "button[type='submit']"
                );


            if (
                btnEntrar
            ) {

                btnEntrar.disabled =
                    false;

                btnEntrar.style.opacity =
                    "";

                btnEntrar.style.cursor =
                    "";
            }


            const notif =
                document.getElementById(
                    "notificacaoLogin"
                );


            if (notif) {

                notif.className =
                    "notificacao";
            }


            const forgotLink =
                document.getElementById(
                    "forgotPasswordLink"
                );


            if (forgotLink) {

                forgotLink.classList.remove(
                    "destaque-recuperacao"
                );

                forgotLink.textContent =
                    "Esqueci minha senha";
            }
        }
    );
}


/* ==================================================
================ ENVIAR CÓDIGO RECUPERAÇÃO ===========
================================================== */

const sendRecoveryBtn =
    document.getElementById(
        "sendRecoveryBtn"
    );


if (
    sendRecoveryBtn
) {

    sendRecoveryBtn.addEventListener(
        "click",
        async () => {

            const recoveryEmail =
                document.getElementById(
                    "recoveryEmail"
                );


            const email =
                recoveryEmail
                    ? recoveryEmail.value.trim()
                    : "";


            if (!email) {

                mostrarNotificacao(
                    "notificacaoRecuperar",
                    "Digite seu e-mail.",
                    "aviso"
                );

                return;
            }


            sendRecoveryBtn.disabled =
                true;


            try {

                const response =
                    await fetch(
                        `${API_URL}/usuarios/recuperar-senha`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email
                                })
                        }
                    );


                const data =
                    await response.json();


                if (
                    response.ok
                ) {

                    mostrarNotificacao(
                        "notificacaoRecuperar",
                        "Código enviado para seu e-mail.",
                        "sucesso"
                    );


                    const etapaEmail =
                        document.getElementById(
                            "etapaEmail"
                        );


                    const etapaRedefinir =
                        document.getElementById(
                            "etapaRedefinir"
                        );


                    if (
                        etapaEmail
                    ) {

                        etapaEmail.style.display =
                            "none";
                    }


                    if (
                        etapaRedefinir
                    ) {

                        etapaRedefinir.style.display =
                            "flex";
                    }

                } else {

                    mostrarNotificacao(
                        "notificacaoRecuperar",
                        data.erro ||
                            "Não foi possível enviar o código.",
                        "erro"
                    );
                }


            } catch (err) {

                console.error(
                    "❌ Recuperação:",
                    err
                );


                mostrarNotificacao(
                    "notificacaoRecuperar",
                    "Erro ao enviar o código.",
                    "erro"
                );


            } finally {

                sendRecoveryBtn.disabled =
                    false;
            }
        }
    );
}


/* ==================================================
================ REDEFINIR SENHA =====================
================================================== */

const redefinirSenhaBtn =
    document.getElementById(
        "redefinirSenhaBtn"
    );


if (
    redefinirSenhaBtn
) {

    redefinirSenhaBtn.addEventListener(
        "click",
        async () => {

            const recoveryEmail =
                document.getElementById(
                    "recoveryEmail"
                );


            const codigoRecuperacao =
                document.getElementById(
                    "codigoRecuperacao"
                );


            const novaSenhaInput =
                document.getElementById(
                    "novaSenha"
                );


            const email =
                recoveryEmail
                    ? recoveryEmail.value.trim()
                    : "";


            const codigo =
                codigoRecuperacao
                    ? codigoRecuperacao.value.trim()
                    : "";


            const novaSenha =
                novaSenhaInput
                    ? novaSenhaInput.value
                    : "";


            if (
                !email ||
                !codigo ||
                !novaSenha
            ) {

                mostrarNotificacao(
                    "notificacaoRecuperar",
                    "Preencha todos os campos.",
                    "aviso"
                );

                return;
            }


            redefinirSenhaBtn.disabled =
                true;


            try {

                const response =
                    await fetch(
                        `${API_URL}/usuarios/redefinir-senha`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    codigo,
                                    novaSenha
                                })
                        }
                    );


                const data =
                    await response.json();


                if (
                    response.ok
                ) {

                    mostrarNotificacao(
                        "notificacaoRecuperar",
                        "Senha redefinida com sucesso!",
                        "sucesso"
                    );


                    if (
                        recoveryEmail
                    ) {

                        recoveryEmail.value =
                            "";
                    }


                    if (
                        codigoRecuperacao
                    ) {

                        codigoRecuperacao.value =
                            "";
                    }


                    if (
                        novaSenhaInput
                    ) {

                        novaSenhaInput.value =
                            "";
                    }


                    const etapaEmail =
                        document.getElementById(
                            "etapaEmail"
                        );


                    const etapaRedefinir =
                        document.getElementById(
                            "etapaRedefinir"
                        );


                    if (
                        etapaEmail
                    ) {

                        etapaEmail.style.cssText =
                            "display: none !important";
                    }


                    if (
                        etapaRedefinir
                    ) {

                        etapaRedefinir.style.cssText =
                            "display: none !important";
                    }


                    setTimeout(
                        () => {

                            if (
                                etapaEmail
                            ) {

                                etapaEmail.style.cssText =
                                    "";
                            }


                            if (
                                etapaRedefinir
                            ) {

                                etapaRedefinir.style.cssText =
                                    "";
                            }


                            if (
                                forgotPasswordBox
                            ) {

                                forgotPasswordBox.classList.remove(
                                    "active"
                                );
                            }


                            if (
                                loginContent
                            ) {

                                loginContent.style.display =
                                    "block";
                            }


                            const btnEntrar =
                                form &&
                                form.querySelector(
                                    "button[type='submit']"
                                );


                            if (
                                btnEntrar
                            ) {

                                btnEntrar.disabled =
                                    false;

                                btnEntrar.style.opacity =
                                    "";

                                btnEntrar.style.cursor =
                                    "";
                            }


                            const notif =
                                document.getElementById(
                                    "notificacaoLogin"
                                );


                            if (
                                notif
                            ) {

                                notif.className =
                                    "notificacao";
                            }


                            const forgotLink =
                                document.getElementById(
                                    "forgotPasswordLink"
                                );


                            if (
                                forgotLink
                            ) {

                                forgotLink.classList.remove(
                                    "destaque-recuperacao"
                                );

                                forgotLink.textContent =
                                    "Esqueci minha senha";
                            }

                        },
                        2000
                    );

                } else {

                    mostrarNotificacao(
                        "notificacaoRecuperar",
                        data.erro ||
                            "Não foi possível redefinir a senha.",
                        "erro"
                    );
                }


            } catch (err) {

                console.error(
                    "❌ Redefinição:",
                    err
                );


                mostrarNotificacao(
                    "notificacaoRecuperar",
                    "Erro ao redefinir a senha.",
                    "erro"
                );


            } finally {

                redefinirSenhaBtn.disabled =
                    false;
            }
        }
    );
}