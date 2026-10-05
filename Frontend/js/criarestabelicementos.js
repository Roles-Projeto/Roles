"use strict";

// ====================================================
// CONFIG DA API
// ====================================================

const API_URL = window.API_BASE
    || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://projeto-integrador-roles.onrender.com');

// ====================================================
// VARIÁVEIS GLOBAIS
// ====================================================

const steps         = document.querySelectorAll(".step");
const nextBtn       = document.getElementById("nextBtn");
const prevBtn       = document.getElementById("prevBtn");
const progressBar   = document.getElementById("progress-bar");
const stepIndicator = document.getElementById("step-indicator");

const modal                  = document.getElementById("modalConfirmacao");
const resumoEstabelecimento  = document.getElementById("resumoEstabelecimento");
const cancelarBtn            = document.getElementById("cancelarPublicacao");
const confirmarBtn           = document.getElementById("confirmarPublicacao");

let currentStep = 0;

// ====================================================
// MOSTRAR ETAPA
// ====================================================

function showStep(index) {
    steps.forEach((step, i) => {
        step.style.display = i === index ? "block" : "none";
    });

    prevBtn.style.display = index === 0 ? "none" : "inline-block";

    if (index > 0) {
        prevBtn.innerHTML = '<img src="/frontend/imagens/seta-direita.png" style="transform: scaleX(-1); width:40px;">';
    }

    if (index === steps.length - 1) {
        nextBtn.textContent   = "Publicar Estabelecimento";
        nextBtn.className     = "btn-primary";
        nextBtn.style.padding = "12px 28px";
    } else {
        nextBtn.innerHTML     = '<img src="/frontend/imagens/seta-direita.png" style="width:40px;">';
        nextBtn.className     = "btn-success";
        nextBtn.style.padding = "";
    }

    atualizarProgresso();
}

// ====================================================
// PROGRESSO
// ====================================================

function atualizarProgresso() {
    const total     = steps.length;
    const progresso = ((currentStep + 1) / total) * 100;
    progressBar.style.width   = progresso + "%";
    stepIndicator.textContent = `Etapa ${currentStep + 1} de ${total}`;
}

// ====================================================
// HELPERS — erro visual
// ====================================================

function marcarErro(el) {
    if (!el) return;
    el.style.borderColor = "#ef4444";
    el.style.boxShadow   = "0 0 0 3px rgba(239,68,68,0.15)";
    el.addEventListener("input",  () => limparErro(el), { once: true });
    el.addEventListener("change", () => limparErro(el), { once: true });
}

function limparErro(el) {
    if (!el) return;
    el.style.borderColor = "";
    el.style.boxShadow   = "";
}

function alerta(msg, el) {
    if (el) el.focus();
    alert(msg);
}

// ====================================================
// VALIDAÇÃO POR ETAPA
// ====================================================

function validarEtapa(index) {

    // ── Etapa 1: Informações básicas ──────────────────
    // Obrigatórios: nome, tipo, faixa de preço
    // Opcionais: especialidade, capacidade
    if (index === 0) {
        const nome       = document.getElementById("estab-name");
        const tipo       = document.getElementById("tipo");
        const faixaPreco = document.getElementById("faixa-preco");

        if (!nome?.value?.trim()) { marcarErro(nome); alerta("Informe o nome do estabelecimento.", nome); return false; }
        if (!tipo?.value)         { marcarErro(tipo); alerta("Selecione o tipo do estabelecimento.", tipo); return false; }
        if (!faixaPreco?.value)   { marcarErro(faixaPreco); alerta("Selecione a faixa de preço.", faixaPreco); return false; }
        return true;
    }

    // ── Etapa 2: Imagens ──────────────────────────────
    // Obrigatórios: logo, capa
    // Opcional: galeria
    if (index === 1) {
        const temLogo = !!document.querySelector("#drop-zone-logo img");
        const temCapa = !!document.querySelector("#drop-zone-capa img");

        if (!temLogo) { alert("Adicione o logo do estabelecimento."); return false; }
        if (!temCapa) { alert("Adicione a foto de capa do estabelecimento."); return false; }
        return true;
    }

    // ── Etapa 3: Horários ─────────────────────────────
    // Obrigatório: ao menos 1 dia aberto com horários válidos
    if (index === 2) {
        let algumAberto = false;
        let horarioInvalido = false;

        document.querySelectorAll(".horario-dia-row").forEach(row => {
            const check      = row.querySelector(".dia-check");
            const abertura   = row.querySelector(".hora-abertura")?.value;
            const fechamento = row.querySelector(".hora-fechamento")?.value;
            if (check?.checked) {
                algumAberto = true;
                if (!abertura || !fechamento) horarioInvalido = true;
                else if (abertura >= fechamento) horarioInvalido = true;
            }
        });

        if (!algumAberto)    { alert("Ative ao menos um dia de funcionamento."); return false; }
        if (horarioInvalido) { alert("Verifique os horários: o horário de abertura deve ser anterior ao de fechamento."); return false; }
        return true;
    }

    // ── Etapa 4: Descrição ────────────────────────────
    // Obrigatório: descrição
    // Opcional: comodidades (checkboxes)
    if (index === 3) {
        const descricao = document.getElementById("descricao");
        if (!descricao?.value?.trim()) {
            marcarErro(descricao);
            alerta("Adicione uma descrição do estabelecimento.", descricao);
            return false;
        }
        return true;
    }

    // ── Etapa 5: Localização ──────────────────────────
    // Obrigatórios: nome do local, CEP, rua, número, cidade, estado, telefone
    // Opcionais: complemento, website
    if (index === 4) {
        const localNome = document.getElementById("local-nome");
        const cep       = document.getElementById("cep");
        const rua       = document.getElementById("rua");
        const numero    = document.getElementById("numero");
        const cidade    = document.getElementById("cidade");
        const estado    = document.getElementById("estado");
        const telefone  = document.getElementById("telefone");

        if (!localNome?.value?.trim()) { marcarErro(localNome); alerta("Informe o nome ou endereço do local.", localNome); return false; }
        if (!cep?.value?.trim() || cep.value.replace(/\D/g,"").length < 8) { marcarErro(cep); alerta("Informe um CEP válido.", cep); return false; }
        if (!rua?.value?.trim())    { marcarErro(rua);     alerta("Informe a rua do estabelecimento.", rua); return false; }
        if (!numero?.value?.trim()) { marcarErro(numero);  alerta("Informe o número do endereço.", numero); return false; }
        if (!cidade?.value?.trim()) { alerta("A cidade não foi preenchida. Verifique o CEP."); return false; }
        if (!estado?.value?.trim()) { alerta("O estado não foi preenchido. Verifique o CEP."); return false; }
        if (!telefone?.value?.trim()) { marcarErro(telefone); alerta("Informe o telefone de contato.", telefone); return false; }
        return true;
    }

    // ── Etapa 6: Pratos — opcional ────────────────────
    if (index === 5) return true;

    // ── Etapa 7: Publicação ───────────────────────────
    // Obrigatórios: nome do responsável, termos
    // Opcional: CNPJ, visibilidade
    if (index === 6) {
        const responsavel = document.getElementById("owner-name");
        const termos      = document.getElementById("terms");

        if (!responsavel?.value?.trim()) { marcarErro(responsavel); alerta("Informe o nome do responsável.", responsavel); return false; }
        if (!termos?.checked)            { alert("Você precisa aceitar os Termos de Uso para publicar."); return false; }
        return true;
    }

    return true;
}

// ====================================================
// BOTÃO PRÓXIMO
// ====================================================

nextBtn.addEventListener("click", () => {
    if (!validarEtapa(currentStep)) return;

    if (currentStep === steps.length - 1) {
        mostrarResumo();
        return;
    }
    currentStep++;
    showStep(currentStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ====================================================
// BOTÃO VOLTAR
// ====================================================

prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
});

// ====================================================
// AUTOSAVE
// ====================================================

function salvarRascunho() {
    const dados = {};
    document.querySelectorAll("input:not([type='file']), textarea, select").forEach(input => {
        if (!input.id) return;
        dados[input.id] = input.type === "checkbox" || input.type === "radio" ? input.checked : input.value;
    });
    localStorage.setItem("rascunhoEstabelecimento", JSON.stringify(dados));
}

setInterval(salvarRascunho, 5000);

// ====================================================
// CARREGAR RASCUNHO
// ====================================================

function carregarRascunho() {
    const dados = JSON.parse(localStorage.getItem("rascunhoEstabelecimento"));
    if (!dados) return;
    Object.keys(dados).forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        if (input.type === "checkbox" || input.type === "radio") input.checked = dados[id];
        else input.value = dados[id];
    });
}

window.addEventListener("load", carregarRascunho);

// ====================================================
// MOSTRAR RESUMO NO MODAL
// ====================================================

const stepNavigation = document.querySelector(".step-navigation");

function mostrarResumo() {
    stepNavigation.style.display = "none";

    const nome        = document.getElementById("estab-name")?.value || "-";
    const tipo        = document.getElementById("tipo")?.value || "-";
    const especialidade = document.getElementById("especialidade")?.value || "-";
    const faixaPreco  = document.getElementById("faixa-preco")?.value || "-";
    const responsavel = document.getElementById("owner-name")?.value || "-";
    const descricao   = document.getElementById("descricao")?.value || "-";
    const localNome   = document.getElementById("local-nome")?.value || "";
    const rua         = document.getElementById("rua")?.value || "";
    const numero      = document.getElementById("numero")?.value || "";
    const cidade      = document.getElementById("cidade")?.value || "";
    const estado      = document.getElementById("estado")?.value || "";
    const telefone    = document.getElementById("telefone")?.value || "";

    let local = "-";
    if (rua || localNome || cidade) {
        local = `${localNome}<br>${rua}${numero ? ", " + numero : ""}<br>${cidade}${estado ? " - " + estado : ""}`;
    }

    let horariosHTML = "<ul>";
    document.querySelectorAll(".horario-dia-row").forEach(row => {
        const dia        = row.dataset.dia;
        const check      = row.querySelector(".dia-check");
        const abertura   = row.querySelector(".hora-abertura")?.value || "";
        const fechamento = row.querySelector(".hora-fechamento")?.value || "";
        if (check?.checked && abertura && fechamento) horariosHTML += `<li>${dia}: ${abertura} – ${fechamento}</li>`;
        else if (!check?.checked) horariosHTML += `<li>${dia}: Fechado</li>`;
    });
    horariosHTML += "</ul>";

    let pratosHTML = "Nenhum prato cadastrado";
    if (listaPratos.length > 0) {
        pratosHTML = "<ul>";
        listaPratos.forEach(p => {
            pratosHTML += `<li>${p.tipo === "destaque" ? "⭐" : "🏷️"} <strong>${p.titulo}</strong> (${p.categoria}) ${p.preco ? "— R$ " + p.preco : ""}</li>`;
        });
        pratosHTML += "</ul>";
    }

    const features = [];
    document.querySelectorAll(".feature-check input:checked").forEach(f => {
        const label = f.closest("label");
        if (label) features.push(label.innerText.trim());
    });

    resumoEstabelecimento.innerHTML = `
        <h3>Dados Gerais</h3>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Tipo:</strong> ${tipo}</p>
        <p><strong>Especialidade:</strong> ${especialidade || "-"}</p>
        <p><strong>Faixa de preço:</strong> ${faixaPreco}</p>
        <p><strong>Responsável:</strong> ${responsavel}</p>
        <h3>Localização</h3>
        <p>${local}</p>
        ${telefone ? `<p><strong>Telefone:</strong> ${telefone}</p>` : ""}
        <h3>Horários</h3>
        ${horariosHTML}
        <h3>Descrição</h3>
        <p>${descricao.length > 200 ? descricao.substring(0, 200) + "..." : descricao}</p>
        <h3>Comodidades</h3>
        <p>${features.length > 0 ? features.join(", ") : "Nenhuma selecionada"}</p>
        <h3>Pratos em Destaque</h3>
        ${pratosHTML}
    `;

    modal.style.display = "flex";
}

// ====================================================
// CANCELAR PUBLICAÇÃO
// ====================================================

cancelarBtn.addEventListener("click", () => {
    modal.style.display          = "none";
    stepNavigation.style.display = "flex";
});

// ====================================================
// CONFIRMAR PUBLICAÇÃO
// ====================================================

confirmarBtn.addEventListener("click", async () => {
    // ── Verifica se o usuário está logado antes de publicar ──
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Você precisa estar logado para cadastrar um estabelecimento.");
        window.location.href = "/frontend/login/login.html";
        return;
    }

    const nome        = document.getElementById("estab-name")?.value?.trim() || "";
    const tipo        = document.getElementById("tipo")?.value || "";
    const especialidade = document.getElementById("especialidade")?.value || "";
    const faixa_preco = document.getElementById("faixa-preco")?.value || "";
    const capacidade  = document.getElementById("capacidade")?.value || "";
    const descricao   = document.getElementById("descricao")?.value || "";
    const local_nome  = document.getElementById("local-nome")?.value || "";
    const cep         = document.getElementById("cep")?.value || "";
    const rua         = document.getElementById("rua")?.value || "";
    const numero      = document.getElementById("numero")?.value || "";
    const complemento = document.getElementById("complemento")?.value || "";
    const bairro      = document.getElementById("bairro")?.value || "";
    const cidade      = document.getElementById("cidade")?.value || "";
    const estado      = document.getElementById("estado")?.value || "";
    const telefone    = document.getElementById("telefone")?.value || "";
    const website     = document.getElementById("website")?.value || "";
    const responsavel = document.getElementById("owner-name")?.value || "";
    const cnpj        = document.getElementById("cnpj")?.value || "";
    const visibilidade = document.querySelector('input[name="visibilidade"]:checked')?.value || "publico";

    if (cnpj && !validarCNPJ(cnpj)) { alert("❌ CNPJ inválido."); return; }

    const endereco = `${rua}${numero ? ", " + numero : ""}${bairro ? " — " + bairro : ""}, ${cidade}${estado ? " - " + estado : ""}`.trim();

    const horariosArr = [];
    document.querySelectorAll(".horario-dia-row").forEach(row => {
        const dia        = row.dataset.dia;
        const check      = row.querySelector(".dia-check");
        const abertura   = row.querySelector(".hora-abertura")?.value || "";
        const fechamento = row.querySelector(".hora-fechamento")?.value || "";
        if (check?.checked && abertura && fechamento) horariosArr.push(`${dia}: ${abertura}–${fechamento}`);
    });

    const comodidadesArr = [];
    document.querySelectorAll(".feature-check input:checked").forEach(f => {
        const label = f.closest("label");
        if (label) comodidadesArr.push(label.innerText.trim());
    });

    const img_logo       = document.querySelector("#drop-zone-logo img")?.src || "";
    const img_capa       = document.querySelector("#drop-zone-capa img")?.src || "";
    const categoria_card = mapearCategoria(tipo);

    const fotos_galeria = await Promise.all(
        fotosGaleria.map(file => new Promise(resolve => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.readAsDataURL(file);
        }))
    );

    const body = {
        nome, tipo, especialidade, faixa_preco, capacidade, descricao,
        local_nome, cep, rua, numero, complemento, bairro, cidade, estado,
        endereco, telefone, website, responsavel, cnpj, visibilidade,
        horario: horariosArr.join(", "),
        comodidades: comodidadesArr.join(", "),
        img_logo, img_capa, categoria_card,
        fotos_galeria,
        pratos: listaPratos || []
    };

    try {
        confirmarBtn.disabled     = true;
        confirmarBtn.textContent  = "Publicando...";

        const res = await fetch(`${API_URL}/estabelecimentos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(body)
        });
        const resultado = await res.json();
        if (!res.ok) throw new Error(resultado.erro || "Erro ao publicar.");

        localStorage.removeItem("rascunhoEstabelecimento");
        modal.style.display = "none";
        stepNavigation.style.display = "flex";
        alert(`✅ "${nome}" publicado com sucesso!`);
        window.location.href = "../locais/locais.html";

    } catch (err) {
        console.error(err);
        alert(`❌ Erro ao publicar: ${err.message}`);
        confirmarBtn.disabled    = false;
        confirmarBtn.textContent = "Confirmar e Publicar";
    }
});

// ====================================================
// MAPEIA TIPO → CATEGORIA
// ====================================================

function mapearCategoria(tipo) {
    const mapa = {
        "Restaurante": "restaurantes", "Bar e Boteco": "bares",
        "Café e Cafeteria": "bares",   "Lanchonete e Fast Food": "restaurantes",
        "Pizzaria": "restaurantes",    "Churrascaria": "restaurantes",
        "Doceria e Confeitaria": "restaurantes", "Padaria": "restaurantes",
        "Sorveteria": "restaurantes",  "Sushi e Japonês": "restaurantes",
        "Food Truck": "restaurantes",  "Bistrô": "restaurantes",
        "Pub": "bares",                "Enoteca": "bares",
        "Hamburgueria": "restaurantes",
    };
    return mapa[tipo] || "restaurantes";
}

// ====================================================
// INICIALIZAÇÃO
// ====================================================

showStep(currentStep);

// ====================================================
// ESPECIALIDADES POR TIPO
// ====================================================

const especialidadesPorTipo = {
    "Restaurante": ["Brasileiro", "Italiano", "Árabe", "Japonês", "Chinês", "Mexicano", "Francês", "Vegetariano/Vegano", "Frutos do mar", "Fusion"],
    "Bar e Boteco": ["Petiscos", "Cervejas especiais", "Drinks e coquetéis", "Bar temático", "Esportivo"],
    "Café e Cafeteria": ["Café especial", "Brunch", "Torradas e pães", "Bolos e doces", "Vegano"],
    "Lanchonete e Fast Food": ["Hambúrguer", "Hot dog", "Batata frita", "Tacos", "Wraps"],
    "Pizzaria": ["Tradicional", "Gourmet", "Sem glúten", "Por metro", "Pizza no forno a lenha"],
    "Churrascaria": ["Rodízio", "À la carte", "Assado na brasa", "Costela"],
    "Doceria e Confeitaria": ["Bolos personalizados", "Brigadeiros", "Tortas", "Macarons", "Chocolates"],
    "Padaria": ["Pão artesanal", "Café da manhã", "Salgados", "Doces"],
    "Sorveteria": ["Sorvete artesanal", "Açaí", "Frozen", "Sorvete vegano"],
    "Sushi e Japonês": ["Sushi", "Temaki", "Ramen", "Udon", "Teppanyaki"],
    "Food Truck": ["Hambúrguer", "Tacos", "Churrasco", "Vegano", "Comida de rua"],
    "Hamburgueria": ["Smash burger", "Artesanal", "Vegano", "Gourmet"],
};

const tipoSelect        = document.getElementById("tipo");
const especialidadeSelect = document.getElementById("especialidade");

tipoSelect.addEventListener("change", () => {
    limparErro(tipoSelect);
    especialidadeSelect.innerHTML = '<option value="">Selecione uma especialidade</option>';
    (especialidadesPorTipo[tipoSelect.value] || []).forEach(esp => {
        const opt = document.createElement("option");
        opt.textContent = esp;
        especialidadeSelect.appendChild(opt);
    });
});

// ====================================================
// CONTADOR DE CARACTERES
// ====================================================

const estabNameInput = document.getElementById("estab-name");
const charsSpan      = document.getElementById("chars");
if (estabNameInput && charsSpan) {
    estabNameInput.addEventListener("input", () => {
        charsSpan.textContent = 100 - estabNameInput.value.length;
    });
}

// ====================================================
// MÁSCARA TELEFONE
// ====================================================

const telefoneInput = document.getElementById("telefone");
if (telefoneInput) {
    telefoneInput.addEventListener("input", () => {
        let v = telefoneInput.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 6)      v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
        else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
        else if (v.length > 0) v = `(${v}`;
        telefoneInput.value = v;
    });
}

// ====================================================
// MÁSCARA E VALIDAÇÃO CNPJ
// ====================================================

function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const calc = (c, p) => {
        const s = p.reduce((a, v, i) => a + parseInt(c[i]) * v, 0) % 11;
        return s < 2 ? 0 : 11 - s;
    };
    return calc(cnpj, [5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(cnpj[12]) &&
           calc(cnpj, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(cnpj[13]);
}

const cnpjInput = document.getElementById("cnpj");
if (cnpjInput) {
    cnpjInput.addEventListener("input", () => {
        let v = cnpjInput.value.replace(/\D/g, "").slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, "$1.$2")
             .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
             .replace(/\.(\d{3})(\d)/, ".$1/$2")
             .replace(/(\d{4})(\d)/, "$1-$2");
        cnpjInput.value = v;
        cnpjInput.classList.remove("input-valido", "input-invalido");
    });
    cnpjInput.addEventListener("blur", () => {
        const v = cnpjInput.value.replace(/\D/g, "");
        if (!v.length) { cnpjInput.classList.remove("input-valido", "input-invalido"); return; }
        cnpjInput.classList.toggle("input-valido",   validarCNPJ(v));
        cnpjInput.classList.toggle("input-invalido", !validarCNPJ(v));
    });
}

// ====================================================
// HORÁRIO — TOGGLE DIA
// ====================================================

document.querySelectorAll(".dia-check").forEach(check => {
    check.addEventListener("change", () => {
        const row      = check.closest(".horario-dia-row");
        const inputsDiv = row.querySelector(".horario-inputs");
        if (check.checked) {
            inputsDiv.classList.remove("horario-fechado");
            inputsDiv.innerHTML = `
                <div class="icon-input"><i class="fa-regular fa-clock"></i><input type="time" class="hora-abertura" value="08:00"></div>
                <span class="separador-horario">até</span>
                <div class="icon-input"><i class="fa-regular fa-clock"></i><input type="time" class="hora-fechamento" value="22:00"></div>
            `;
        } else {
            inputsDiv.classList.add("horario-fechado");
            inputsDiv.innerHTML = `<span class="fechado-label">Fechado</span>`;
        }
    });
});

// ====================================================
// UPLOAD LOGO
// ====================================================

const dropZoneLogo  = document.getElementById("drop-zone-logo");
const fileInputLogo = document.createElement("input");
fileInputLogo.type = "file"; fileInputLogo.accept = "image/jpeg,image/png,image/gif"; fileInputLogo.style.display = "none";
document.body.appendChild(fileInputLogo);
dropZoneLogo.addEventListener("click",    () => fileInputLogo.click());
fileInputLogo.addEventListener("change",  e => processarImagem(e.target.files[0], dropZoneLogo));
dropZoneLogo.addEventListener("dragover", e => { e.preventDefault(); dropZoneLogo.style.borderColor = "#7c3aed"; });
dropZoneLogo.addEventListener("dragleave",  () => { dropZoneLogo.style.borderColor = ""; });
dropZoneLogo.addEventListener("drop",     e => { e.preventDefault(); dropZoneLogo.style.borderColor = ""; processarImagem(e.dataTransfer.files[0], dropZoneLogo); });

// ====================================================
// UPLOAD CAPA
// ====================================================

const dropZoneCapa  = document.getElementById("drop-zone-capa");
const fileInputCapa = document.createElement("input");
fileInputCapa.type = "file"; fileInputCapa.accept = "image/jpeg,image/png,image/gif"; fileInputCapa.style.display = "none";
document.body.appendChild(fileInputCapa);
dropZoneCapa.addEventListener("click",    () => fileInputCapa.click());
fileInputCapa.addEventListener("change",  e => processarImagem(e.target.files[0], dropZoneCapa));
dropZoneCapa.addEventListener("dragover", e => { e.preventDefault(); dropZoneCapa.style.borderColor = "#7c3aed"; });
dropZoneCapa.addEventListener("dragleave",  () => { dropZoneCapa.style.borderColor = ""; });
dropZoneCapa.addEventListener("drop",     e => { e.preventDefault(); dropZoneCapa.style.borderColor = ""; processarImagem(e.dataTransfer.files[0], dropZoneCapa); });

// ====================================================
// PROCESSAR IMAGEM
// ====================================================

function processarImagem(file, dropZone) {
    if (!file) return;
    if (!["image/jpeg","image/png","image/gif"].includes(file.type)) { alert("Formato inválido. Use JPEG, PNG ou GIF."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Imagem muito grande. Máximo 2MB."); return; }
    const reader = new FileReader();
    reader.onload = e => { dropZone.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`; };
    reader.readAsDataURL(file);
}

// ====================================================
// CEP
// ====================================================

const cepInput    = document.getElementById("cep");
const ruaInput    = document.getElementById("rua");
const cidadeInput = document.getElementById("cidade");
const estadoInput = document.getElementById("estado");
const bairroInput = document.getElementById("bairro");

if (cepInput) {
    cepInput.addEventListener("input", () => {
        let v = cepInput.value.replace(/\D/g, "");
        if (v.length > 5) v = v.slice(0,5) + "-" + v.slice(5,8);
        cepInput.value = v;
    });
    cepInput.addEventListener("blur", async () => {
        const cep = cepInput.value.replace(/\D/g, "");
        if (cep.length !== 8) return;
        try {
            const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) { alert("CEP não encontrado."); return; }
            if (ruaInput)    { ruaInput.value    = data.logradouro || ""; limparErro(ruaInput); }
            if (cidadeInput)   cidadeInput.value = data.localidade || "";
            if (estadoInput)   estadoInput.value = data.uf || "";
            if (bairroInput)   bairroInput.value = data.bairro || "";
        } catch { alert("Erro ao buscar CEP."); }
    });
}

// ====================================================
// PRATOS EM DESTAQUE (opcional)
// ====================================================

const ticketConfigCard = document.querySelector(".ticket-config-card");
const listaContainer   = document.querySelector(".lista-pratos");
const listaPratos      = [];
let pratoEditandoIndex = null;

document.querySelectorAll(".btn-ticket-action").forEach(btn => {
    btn.addEventListener("click", () => {
        const tipo = btn.dataset.tipo;
        const existente = ticketConfigCard.querySelector(".ticket-item");
        if (existente) existente.remove();
        ticketConfigCard.style.display = "flex";
        criarFormPrato(tipo);
    });
});

function criarFormPrato(tipo) {
    const ticketItem = document.createElement("div");
    ticketItem.classList.add("ticket-item");
    ticketItem.dataset.tipo = tipo;

    const agora       = new Date();
    const minDatetime = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
                            .toISOString().slice(0, 16);

    const camposPromocao = tipo === "promocao" ? `
        <label>Preço original (R$)</label>
        <input type="number" step="0.01" placeholder="0,00" class="preco-original">
        <label>Preço promocional (R$) <span style="color:red">*</span></label>
        <input type="number" step="0.01" placeholder="0,00" class="preco-promo">
        <label>Período da promoção <span class="required">*</span></label>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <div style="flex:1;min-width:180px;">
                <label style="font-size:11px;margin-bottom:4px;display:block;">Início</label>
                <input type="datetime-local" class="promo-inicio" min="${minDatetime}" style="width:100%;">
            </div>
            <span style="color:#9ca3af;font-size:13px;padding-top:18px;">até</span>
            <div style="flex:1;min-width:180px;">
                <label style="font-size:11px;margin-bottom:4px;display:block;">Término</label>
                <input type="datetime-local" class="promo-fim" min="${minDatetime}" style="width:100%;">
            </div>
        </div>
    ` : `
        <label>Preço (R$)</label>
        <input type="number" step="0.01" placeholder="0,00" class="preco-destaque">
    `;

    ticketItem.innerHTML = `
        <button class="remove-ticket" type="button"><img src="/frontend/imagens/fechar.png" alt="Fechar" style="width:16px;height:16px;"></button>
        <h4>${tipo === "destaque" ? "⭐ Adicionar prato destaque" : "🏷️ Adicionar promoção"}</h4>
        <p>${tipo === "destaque" ? "Destaque os pratos mais populares do seu estabelecimento." : "Cadastre uma promoção especial — combo, desconto, happy hour, etc."}</p>
        <label>Nome do prato / item <span style="color:red">*</span></label>
        <input type="text" class="titulo-prato" maxlength="60" placeholder="Ex: Risoto de camarão...">
        <label>Categoria</label>
        <select class="categoria-prato">
            <option value="">Selecione uma categoria</option>
            <option>Entrada</option><option>Prato Principal</option><option>Acompanhamento</option>
            <option>Sobremesa</option><option>Bebida</option><option>Petisco</option>
            <option>Combo / Promoção</option><option>Vegano / Vegetariano</option>
            <option>Sem glúten</option><option>Especial do dia</option>
        </select>
        ${camposPromocao}
        <label>Descrição do prato (opcional)</label>
        <textarea class="descricao-prato" maxlength="150" placeholder="Ingredientes, modo de preparo..."></textarea>
        <div class="ticket-actions"><button class="btnSalvarPrato btn-primary" type="button">Salvar prato</button></div>
    `;

    ticketItem.querySelector(".remove-ticket").addEventListener("click", () => {
        ticketItem.remove();
        pratoEditandoIndex = null;
        if (!listaPratos.length) ticketConfigCard.style.display = "none";
    });

    ticketItem.querySelector(".btnSalvarPrato").addEventListener("click", () => {
        const tituloInput = ticketItem.querySelector(".titulo-prato");
        const titulo = tituloInput.value.trim();
        if (!titulo) { marcarErro(tituloInput); tituloInput.focus(); alert("Informe o nome do prato."); return; }

        const categoria = ticketItem.querySelector(".categoria-prato").value || "-";
        let preco = "";
        if (tipo === "destaque") {
            preco = ticketItem.querySelector(".preco-destaque")?.value || "";
        } else {
            const precoPromo = ticketItem.querySelector(".preco-promo");
            if (!precoPromo?.value) { marcarErro(precoPromo); precoPromo.focus(); alert("Informe o preço promocional."); return; }
            preco = precoPromo.value;
        }
        if (preco) preco = parseFloat(preco).toFixed(2);

        const descricao = ticketItem.querySelector(".descricao-prato")?.value?.trim() || "";

        if (tipo === "promocao") {
            const promoInicio = ticketItem.querySelector(".promo-inicio");
            const promoFim    = ticketItem.querySelector(".promo-fim");
            if (!promoInicio?.value) { marcarErro(promoInicio); promoInicio.focus(); alert("Informe o início do período da promoção."); return; }
            if (!promoFim?.value)    { marcarErro(promoFim);    promoFim.focus();    alert("Informe o término do período da promoção."); return; }
            if (new Date(promoFim.value) <= new Date(promoInicio.value)) {
                marcarErro(promoFim); promoFim.focus(); alert("O término da promoção deve ser depois do início."); return;
            }
        }
        const prato = { titulo, categoria, preco, tipo, descricao };

        if (pratoEditandoIndex !== null) { listaPratos[pratoEditandoIndex] = prato; pratoEditandoIndex = null; }
        else listaPratos.push(prato);

        renderizarPratos();
        ticketItem.remove();
    });

    ticketConfigCard.insertBefore(ticketItem, listaContainer);
}

function renderizarPratos() {
    listaContainer.innerHTML = "";
    if (!listaPratos.length) {
        if (!ticketConfigCard.querySelector(".ticket-item")) ticketConfigCard.style.display = "none";
        return;
    }
    listaContainer.innerHTML = "<h3>Pratos cadastrados</h3>";
    listaPratos.forEach((p, i) => {
        const item = document.createElement("div");
        item.classList.add("prato-resumo");
        item.innerHTML = `
            <div>
                <strong>${p.titulo}</strong>
                <span class="prato-badge ${p.tipo === "destaque" ? "badge-destaque" : "badge-promocao"}">${p.tipo === "destaque" ? "⭐ Destaque" : "🏷️ Promoção"}</span>
                &nbsp;— ${p.categoria} ${p.preco ? "— R$ " + p.preco : ""}
            </div>
            <div>
                <button class="btn-editar" onclick="editarPrato(${i})">Editar</button>
                <button class="btn-excluir" onclick="excluirPrato(${i})">Excluir</button>
            </div>
        `;
        listaContainer.appendChild(item);
    });
    ticketConfigCard.style.display = "flex";
}

function editarPrato(index) {
    pratoEditandoIndex = index;
    const p = listaPratos[index];
    const existente = ticketConfigCard.querySelector(".ticket-item");
    if (existente) existente.remove();
    ticketConfigCard.style.display = "flex";
    criarFormPrato(p.tipo);
    const form = ticketConfigCard.querySelector(".ticket-item");
    form.querySelector(".titulo-prato").value    = p.titulo;
    form.querySelector(".categoria-prato").value = p.categoria !== "-" ? p.categoria : "";
    const precoField = form.querySelector(p.tipo === "destaque" ? ".preco-destaque" : ".preco-promo");
    if (precoField && p.preco) precoField.value = p.preco;
}

function excluirPrato(index) { listaPratos.splice(index, 1); renderizarPratos(); }

// ====================================================
// GALERIA DE FOTOS (opcional)
// ====================================================

const MAX_FOTOS  = 8;
let fotosGaleria = [];

function renderGalleryGrid() {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    grid.innerHTML = "";
    fotosGaleria.forEach((file, i) => {
        const slot = document.createElement("div");
        slot.className = "gallery-slot filled";
        slot.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Foto ${i+1}"><button class="gallery-remove" data-index="${i}" title="Remover"><i class="fa-solid fa-xmark"></i></button>`;
        grid.appendChild(slot);
    });
    if (fotosGaleria.length < MAX_FOTOS) {
        const add = document.createElement("div");
        add.className = "gallery-slot add-slot";
        add.innerHTML = `<i class="fa-solid fa-plus"></i><span>Adicionar foto</span>`;
        add.addEventListener("click", () => document.getElementById("gallery-input").click());
        grid.appendChild(add);
    }
    grid.querySelectorAll(".gallery-remove").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            fotosGaleria.splice(+e.currentTarget.dataset.index, 1);
            renderGalleryGrid();
        });
    });
}

const galleryInput = document.getElementById("gallery-input");
if (galleryInput) {
    galleryInput.addEventListener("change", e => {
        fotosGaleria.push(...Array.from(e.target.files).slice(0, MAX_FOTOS - fotosGaleria.length));
        renderGalleryGrid();
        e.target.value = "";
    });
}

renderGalleryGrid();