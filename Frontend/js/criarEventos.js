// ====================================================
// VARIÁVEIS GLOBAIS
// ====================================================
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = isLocal ? "http://localhost:3000" : window.location.origin;
const API_URL  = `${API_BASE}/eventos`;

const steps         = document.querySelectorAll(".step");
const nextBtn       = document.getElementById("nextBtn");
const prevBtn       = document.getElementById("prevBtn");
const progressBar   = document.getElementById("progress-bar");
const stepIndicator = document.getElementById("step-indicator");

const modal        = document.getElementById("modalConfirmacao");
const resumoEvento = document.getElementById("resumoEvento");
const cancelarBtn  = document.getElementById("cancelarPublicacao");
const confirmarBtn = document.getElementById("confirmarPublicacao");

let currentStep = 0;

// ====================================================
// MOSTRAR ETAPA
// ====================================================
function showStep(index) {
    steps.forEach((step, i) => { step.style.display = i === index ? "block" : "none"; });
    prevBtn.style.display = index === 0 ? "none" : "inline-block";
    if (index > 0) prevBtn.innerHTML = '<img src="/frontend/imagens/seta-direita.png" style="transform:scaleX(-1);width:40px;">';
    if (index === steps.length - 1) {
        nextBtn.textContent = "Publicar Evento"; nextBtn.className = "btn-primary"; nextBtn.style.padding = "12px 28px";
    } else {
        nextBtn.innerHTML = '<img src="/frontend/imagens/seta-direita.png" style="width:40px;">'; nextBtn.className = "btn-success"; nextBtn.style.padding = "";
    }
    atualizarProgresso();
}

// ====================================================
// PROGRESSO
// ====================================================
function atualizarProgresso() {
    const total = steps.length;
    progressBar.style.width   = ((currentStep + 1) / total * 100) + "%";
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
function limparErro(el) { if (!el) return; el.style.borderColor = ""; el.style.boxShadow = ""; }
function alerta(msg, el) { if (el) el.focus(); alert(msg); }

// ====================================================
// VALIDAÇÃO POR ETAPA
// ====================================================
function validarEtapa(index) {

    // ── Etapa 1: Informações básicas ──────────────────
    // Obrigatórios: nome, assunto
    // Opcional: categoria
    if (index === 0) {
        const nome    = document.getElementById("event-name");
        const assunto = document.getElementById("assunto");
        if (!nome?.value?.trim()) { marcarErro(nome); alerta("Informe o nome do evento.", nome); return false; }
        if (!assunto?.value)      { marcarErro(assunto); alerta("Selecione um assunto para o evento.", assunto); return false; }
        return true;
    }

    // ── Etapa 2: Imagem ───────────────────────────────
    // Obrigatório: imagem de divulgação
    if (index === 1) {
        if (!imagemEvento) { alert("Adicione uma imagem de divulgação para o evento."); return false; }
        return true;
    }

    // ── Etapa 3: Data e horário ───────────────────────
    // Todos obrigatórios
    if (index === 2) {
        const dataInicio = document.getElementById("start-date");
        const horaInicio = document.getElementById("start-time");
        const dataFim    = document.getElementById("end-date");
        const horaFim    = document.getElementById("end-time");

        if (!dataInicio?.value) { marcarErro(dataInicio); alerta("Informe a data de início.", dataInicio); return false; }
        if (!horaInicio?.value) { marcarErro(horaInicio); alerta("Informe a hora de início.", horaInicio); return false; }
        if (!dataFim?.value)    { marcarErro(dataFim);    alerta("Informe a data de término.", dataFim);   return false; }
        if (!horaFim?.value)    { marcarErro(horaFim);    alerta("Informe a hora de término.", horaFim);   return false; }

        const inicio = new Date(`${dataInicio.value}T${horaInicio.value}`);
        const fim    = new Date(`${dataFim.value}T${horaFim.value}`);
        const agora  = new Date();

        if (inicio < agora)  { marcarErro(dataInicio); marcarErro(horaInicio); alert("A data de início não pode ser no passado."); return false; }
        if (fim <= inicio)   { marcarErro(dataFim); marcarErro(horaFim); alert("A data de término deve ser depois da data de início."); return false; }
        return true;
    }

    // ── Etapa 4: Descrição ────────────────────────────
    // Obrigatório: descrição
    if (index === 3) {
        const descricao = document.getElementById("descricao");
        if (!descricao?.value?.trim()) { marcarErro(descricao); alerta("Adicione uma descrição para o evento.", descricao); return false; }
        return true;
    }

    // ── Etapa 5: Local do evento ──────────────────────
    // Obrigatórios: nome do local, CEP, rua, cidade, estado
    // Opcional: —
    if (index === 4) {
        const localNome = document.getElementById("local-nome");
        const cep       = document.getElementById("cep");
        const rua       = document.getElementById("rua");
        const cidade    = document.getElementById("cidade");
        const estado    = document.getElementById("estado");

        if (!localNome?.value?.trim()) { marcarErro(localNome); alerta("Informe o nome ou endereço do local.", localNome); return false; }
        if (!cep?.value?.trim() || cep.value.replace(/\D/g,"").length < 8) { marcarErro(cep); alerta("Informe um CEP válido.", cep); return false; }
        if (!rua?.value?.trim())    { marcarErro(rua); alerta("Informe a rua do local.", rua); return false; }
        if (!cidade?.value?.trim()) { alerta("A cidade não foi preenchida. Verifique o CEP."); return false; }
        if (!estado?.value?.trim()) { alerta("O estado não foi preenchido. Verifique o CEP."); return false; }
        return true;
    }

    // ── Etapa 6: Ingressos ────────────────────────────
    // Obrigatório: ao menos 1 ingresso criado
    if (index === 5) {
        if (listaIngressos.length === 0) {
            alert("Adicione ao menos um ingresso (pago ou gratuito) antes de continuar.");
            return false;
        }
        return true;
    }

    // ── Etapa 7: Publicação ───────────────────────────
    // Obrigatórios: nome do produtor, termos
    if (index === 6) {
        const produtor = document.getElementById("producer-name");
        const termos   = document.getElementById("terms");
        if (!produtor?.value?.trim()) { marcarErro(produtor); alerta("Informe o nome do produtor.", produtor); return false; }
        if (!termos?.checked)         { alert("Você precisa aceitar os Termos de Uso para publicar."); return false; }
        return true;
    }

    return true;
}

// ====================================================
// BOTÃO PRÓXIMO
// ====================================================
nextBtn.addEventListener("click", () => {
    if (!validarEtapa(currentStep)) return;
    if (currentStep === steps.length - 1) { mostrarResumo(); return; }
    currentStep++;
    showStep(currentStep);
});

// ====================================================
// BOTÃO VOLTAR
// ====================================================
prevBtn.addEventListener("click", () => {
    if (currentStep > 0) { currentStep--; showStep(currentStep); }
});

// ====================================================
// AUTOSAVE
// ====================================================
function salvarRascunho() {
    const dados = {};
    document.querySelectorAll("input, textarea, select").forEach(input => {
        dados[input.id] = input.type === "checkbox" ? input.checked : input.value;
    });
    localStorage.setItem("rascunhoEvento", JSON.stringify(dados));
}
setInterval(salvarRascunho, 5000);

function carregarRascunho() {
    const dados = JSON.parse(localStorage.getItem("rascunhoEvento"));
    if (!dados) return;
    Object.keys(dados).forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        if (input.type === "checkbox") input.checked = dados[id];
        else input.value = dados[id];
    });
}
window.addEventListener("load", carregarRascunho);

// ====================================================
// MOSTRAR RESUMO
// ====================================================
const stepNavigation = document.querySelector(".step-navigation");

function mostrarResumo() {
    stepNavigation.style.display = "none";

    const nome       = document.getElementById("event-name")?.value || "-";
    const produtor   = document.getElementById("producer-name")?.value || "-";
    const dataInicio = document.getElementById("start-date")?.value || "-";
    const horaInicio = document.getElementById("start-time")?.value || "-";
    const dataFim    = document.getElementById("end-date")?.value || "-";
    const horaFim    = document.getElementById("end-time")?.value || "-";
    const nomeLocal  = document.getElementById("local-nome")?.value || "";
    const rua        = document.getElementById("rua")?.value || "";
    const cidade     = document.getElementById("cidade")?.value || "";
    const estado     = document.getElementById("estado")?.value || "";
    const descricao  = document.getElementById("descricao")?.value || "-";

    let local = "-";
    if (nomeLocal || rua || cidade) local = `${nomeLocal}<br>${rua}<br>${cidade}${estado ? " - " + estado : ""}`;

    let ingressosHTML = "<ul>";
    listaIngressos.forEach(ing => {
        ingressosHTML += `<li>${ing.titulo} — ${ing.tipo === "pago" ? "R$ " + ing.valor : "Gratuito"} (${ing.quantidade_total} unid.)</li>`;
    });
    ingressosHTML += "</ul>";

    resumoEvento.innerHTML = `
        <h3>Resumo do Evento</h3>
        <p><strong>Evento:</strong> ${nome}</p>
        <p><strong>Descrição:</strong> ${descricao.length > 200 ? descricao.substring(0, 200) + "..." : descricao}</p>
        <p><strong>Local:</strong> ${local}</p>
        <p><strong>Início:</strong> ${dataInicio} às ${horaInicio}</p>
        <p><strong>Término:</strong> ${dataFim} às ${horaFim}</p>
        <p><strong>Produtor:</strong> ${produtor}</p>
        <p><strong>Ingressos:</strong></p>${ingressosHTML}
        ${imagemEvento ? `<p><strong>Imagem:</strong> ✅ Carregada</p>` : ""}
    `;

    modal.style.display = "flex";
}

// ====================================================
// CANCELAR PUBLICAÇÃO
// ====================================================
cancelarBtn.addEventListener("click", () => {
    modal.style.display = "none";
    stepNavigation.style.display = "flex";
});

// ====================================================
// CONFIRMAR PUBLICAÇÃO
// ====================================================
confirmarBtn.addEventListener("click", async () => {
    const dataInicio = document.getElementById("start-date")?.value;
    const horaInicio = document.getElementById("start-time")?.value;
    const dataFim    = document.getElementById("end-date")?.value;
    const horaFim    = document.getElementById("end-time")?.value;

    let imagemUrl = null;
    if (imagemEvento) {
        try {
            const formData = new FormData();
            formData.append("imagem", imagemEvento);
            const uploadRes  = await fetch(`${API_BASE}/eventos/upload-imagem`, { method: "POST", body: formData });
            const uploadData = await uploadRes.json();
            imagemUrl = uploadData.url;
        } catch (err) { console.error("Erro no upload da imagem:", err); }
    }

    const toISO = (date, time) => {
    return `${date} ${time}:00`;
};

    const evento = {
        nome:          document.getElementById("event-name")?.value?.trim(),
        assunto:       document.getElementById("assunto")?.value,
        categoria:     document.getElementById("categoria")?.value,
        imagem:        imagemUrl,
        data_inicio:   dataInicio && horaInicio ? toISO(dataInicio, horaInicio) : null,
        data_fim:      dataFim && horaFim ? toISO(dataFim, horaFim) : null,
        descricao:     document.getElementById("descricao")?.value?.trim(),
        local_nome:    document.getElementById("local-nome")?.value?.trim(),
        cep:           document.getElementById("cep")?.value?.trim(),
        rua:           document.getElementById("rua")?.value?.trim(),
        cidade:        document.getElementById("cidade")?.value?.trim(),
        estado:        document.getElementById("estado")?.value?.trim(),
        nome_produtor: document.getElementById("producer-name")?.value?.trim(),
        ingressos:     listaIngressos,
    };

    confirmarBtn.disabled    = true;
    confirmarBtn.textContent = "Publicando...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(evento),
        });
        const data = await response.json();
        if (!response.ok) { confirmarBtn.disabled = false; confirmarBtn.textContent = "Confirmar publicação"; throw new Error(data.erro + " | " + (data.detalhes || "")); }
        localStorage.removeItem("rascunhoEvento");
        modal.style.display = "none";
        window.location.replace("../eventos/eventos.html");
    } catch (err) {
        console.error(err);
        alert("❌ Erro ao publicar: " + err.message);
        confirmarBtn.disabled    = false;
        confirmarBtn.textContent = "Confirmar publicação";
    }
});

// ====================================================
// INICIALIZAÇÃO
// ====================================================
showStep(currentStep);

// ====================================================
// BLOQUEIO DE DATAS PASSADAS + DURAÇÃO EM TEMPO REAL
// ====================================================
(function inicializarDatas() {
    const hoje       = new Date().toISOString().split('T')[0];
    const startDate  = document.getElementById('start-date');
    const startTime  = document.getElementById('start-time');
    const endDate    = document.getElementById('end-date');
    const endTime    = document.getElementById('end-time');
    const badge      = document.getElementById('duracao-badge');
    const badgeTexto = document.getElementById('duracao-texto');

    // Bloqueia datas passadas diretamente no input
    if (startDate) startDate.min = hoje;
    if (endDate)   endDate.min   = hoje;

    function calcularDuracao() {
        if (!startDate?.value || !startTime?.value || !endDate?.value || !endTime?.value || !badge) return;

        const inicio = new Date(`${startDate.value}T${startTime.value}`);
        const fim    = new Date(`${endDate.value}T${endTime.value}`);
        const agora  = new Date();

        badge.classList.remove('tem-duracao', 'erro-data');

        if (inicio < agora) {
            badgeTexto.textContent = 'A data de início não pode ser no passado';
            badge.classList.add('erro-data');
            badge.querySelector('i').className = 'fa-solid fa-circle-exclamation';
            return;
        }

        if (fim <= inicio) {
            badgeTexto.textContent = 'O término deve ser depois do início';
            badge.classList.add('erro-data');
            badge.querySelector('i').className = 'fa-solid fa-circle-exclamation';
            return;
        }

        const diff        = fim - inicio;
        const totalMin    = Math.floor(diff / 60000);
        const dias        = Math.floor(totalMin / (60 * 24));
        const horas       = Math.floor((totalMin % (60 * 24)) / 60);
        const minutos     = totalMin % 60;

        let durStr = 'Duração: ';
        if (dias > 0)    durStr += `${dias} dia${dias > 1 ? 's' : ''} `;
        if (horas > 0)   durStr += `${horas}h `;
        if (minutos > 0) durStr += `${minutos}min`;

        badgeTexto.textContent = durStr.trim();
        badge.classList.add('tem-duracao');
        badge.querySelector('i').className = 'fa-regular fa-hourglass-half';
    }

    // Quando muda data de início, atualiza mínimo do término
    startDate?.addEventListener('change', () => {
        if (endDate) {
            endDate.min = startDate.value || hoje;
            if (endDate.value && endDate.value < startDate.value) endDate.value = '';
        }
        calcularDuracao();
    });

    startTime?.addEventListener('change', calcularDuracao);
    endDate?.addEventListener('change', calcularDuracao);
    endTime?.addEventListener('change', calcularDuracao);
})();

// ====================================================
// CATEGORIAS POR ASSUNTO
// ====================================================
const categoriasPorAssunto = {
    "Festa e Balada": ["Aniversário", "Formatura", "Open Bar", "Festa Universitária", "Baile", "After", "Happy Hour"],
    "Shows e Música": ["Sertanejo", "Funk", "Pagode", "Rock", "Eletrônica", "Rap / Trap", "DJ", "K-pop"],
    "Gastronomia": ["Festival gastronômico", "Rodízio", "Degustação", "Churrasco", "Food Truck"],
    "Esportes": ["Futebol", "Corrida", "Treino funcional", "Campeonato", "Torneio"],
    "Cultura e Arte": ["Teatro", "Cinema", "Exposição", "Stand-up", "Dança"],
    "Cursos e Workshops": ["Curso", "Workshop", "Palestra", "Oficina", "Mentoria"],
    "Infantil e Família": ["Festa infantil", "Parque", "Teatro infantil", "Brincadeiras"],
    "Tecnologia": ["Hackathon", "Meetup", "Conferência", "Workshop Tech"],
    "Religião e Espiritualidade": ["Culto", "Retiro", "Congresso", "Meditação"],
    "Networking e Negócios": ["Networking", "Palestra", "Summit", "Feira"],
    "Saúde e Bem-estar": ["Yoga", "Meditação", "Corrida", "Palestra de saúde"],
    "Festivais": ["Festival de música", "Festival gastronômico", "Festival cultural"],
};

const assuntoSelect   = document.getElementById("assunto");
const categoriaSelect = document.getElementById("categoria");

assuntoSelect.addEventListener("change", () => {
    limparErro(assuntoSelect);
    categoriaSelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    (categoriasPorAssunto[assuntoSelect.value] || []).forEach(cat => {
        const opt = document.createElement("option"); opt.textContent = cat; categoriaSelect.appendChild(opt);
    });
});

// ====================================================
// UPLOAD DE IMAGEM
// ====================================================
const dropZone = document.getElementById("drop-zone");
let imagemEvento = null;

const fileInput = document.createElement("input");
fileInput.type = "file"; fileInput.accept = "image/jpeg,image/png,image/gif"; fileInput.style.display = "none";
document.body.appendChild(fileInput);

dropZone.addEventListener("click",    () => fileInput.click());
fileInput.addEventListener("change",  e => processarImagem(e.target.files[0]));
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.style.border = "2px dashed #7c3aed"; });
dropZone.addEventListener("dragleave",  () => { dropZone.style.border = ""; });
dropZone.addEventListener("drop",     e => { e.preventDefault(); dropZone.style.border = ""; processarImagem(e.dataTransfer.files[0]); });

function processarImagem(file) {
    if (!file) return;
    if (!["image/jpeg","image/png","image/gif"].includes(file.type)) { alert("Formato inválido. Use JPEG, PNG ou GIF."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Imagem muito grande. Máximo 2MB."); return; }
    imagemEvento = file;
    const reader = new FileReader();
    reader.onload = e => { dropZone.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`; };
    reader.readAsDataURL(file);
}

// ====================================================
// CEP
// ====================================================
const cepInput    = document.getElementById("cep");
const ruaInput    = document.getElementById("rua");
const cidadeInput = document.getElementById("cidade");
const estadoInput = document.getElementById("estado");

cepInput.addEventListener("input", () => {
    let v = cepInput.value.replace(/\D/g,"");
    if (v.length > 5) v = v.slice(0,5) + "-" + v.slice(5,8);
    cepInput.value = v;
});

cepInput.addEventListener("blur", async () => {
    const cep = cepInput.value.replace(/\D/g,"");
    if (cep.length !== 8) return;
    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) { alert("CEP não encontrado."); ruaInput.value = cidadeInput.value = estadoInput.value = ""; return; }
        ruaInput.value    = data.logradouro || ""; limparErro(ruaInput);
        cidadeInput.value = data.localidade || "";
        estadoInput.value = data.uf || "";
    } catch { alert("Erro ao buscar CEP."); }
});

// ====================================================
// INGRESSOS
// ====================================================
const ticketConfigCard  = document.querySelector(".ticket-config-card");
const listaContainer    = document.querySelector(".lista-ingressos");
const listaIngressos    = [];
let ingressoEditandoIndex = null;

document.querySelectorAll(".btn-ticket-action").forEach(btn => {
    btn.addEventListener("click", () => {
        const existente = ticketConfigCard.querySelector(".ticket-item");
        if (existente) existente.remove();
        ticketConfigCard.style.display = "flex";
        criarFormIngresso(btn.dataset.tipo);
    });
});

function criarFormIngresso(tipo) {
    const ticketItem = document.createElement("div");
    ticketItem.classList.add("ticket-item");
    ticketItem.dataset.tipo = tipo;

    const camposValor = tipo === "pago" ? `
        <label>Valor a receber (R$) <span style="color:red">*</span></label>
        <input type="number" step="0.01" placeholder="0,00" class="valor-ingresso">
        <label>Valor do participante (R$)</label>
        <input type="number" step="0.01" value="0.00" class="valor-participante" readonly>
    ` : "";

    ticketItem.innerHTML = `
        <button class="remove-ticket" type="button"><img src="/frontend/imagens/fechar.png" alt="Excluir" style="width:20px;height:20px;"></button>
        <h4>${tipo === "pago" ? "Criar ingresso pago" : "Criar ingresso gratuito"}</h4>
        <p>${tipo === "pago" ? "A taxa de serviço é repassada ao comprador." : "Este ingresso é gratuito. Nenhum valor será cobrado."}</p>
        <label>Título do ingresso <span style="color:red">*</span></label>
        <input type="text" class="titulo-ingresso" maxlength="45" placeholder="Ingresso único, Meia-Entrada, VIP, etc.">
        <label>Quantidade <span style="color:red">*</span></label>
        <input type="number" class="quantidade-ingresso" placeholder="Ex. 100" min="1">
        ${camposValor}
        <label><input type="checkbox"> Criar meia-entrada para este ingresso</label>
        <a href="#">Saiba mais sobre as políticas de meia-entrada</a>
        <div class="radio-group" style="margin-top:12px;">
            <label><input type="radio" name="venda-form" value="por-data" checked> Por data</label>
            <label><input type="radio" name="venda-form" value="por-lote" class="radio-lote"> Por lote <span class="help-lote" title="Permite vender em etapas.">?</span></label>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
            <div style="flex:1;min-width:220px;"><label style="display:block;margin-bottom:6px;">Início das Vendas</label><input type="datetime-local" class="data-inicio-venda" style="padding:10px;width:100%;border-radius:8px;border:1px solid #ccc;font-size:14px;box-sizing:border-box;"></div>
            <div style="flex:1;min-width:220px;"><label style="display:block;margin-bottom:6px;">Término das Vendas</label><input type="datetime-local" class="data-fim-venda" style="padding:10px;width:100%;border-radius:8px;border:1px solid #ccc;font-size:14px;box-sizing:border-box;"></div>
        </div>
        <label>Quem pode comprar</label>
        <select class="quem-compra"><option>Para todo o público</option><option>Restrito a convidados</option><option>Adicionar manualmente</option></select>
        <label>Quantidade por compra (opcional)</label>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <input type="number" class="min-compra" placeholder="Mínima" min="1" style="flex:1;min-width:120px;">
            <input type="number" class="max-compra" placeholder="Máxima" min="1" style="flex:1;min-width:120px;">
        </div>
        <label>Descrição do ingresso (opcional)</label>
        <textarea class="descricao-ingresso" maxlength="100" placeholder="Informações adicionais."></textarea>
        <div class="ticket-actions"><button class="btnSalvarIngresso btn-primary" type="button">Salvar ingresso</button></div>
    `;

    if (tipo === "pago") {
        const vi = ticketItem.querySelector(".valor-ingresso");
        const vp = ticketItem.querySelector(".valor-participante");
        vi.addEventListener("input", () => { const v = parseFloat(vi.value); vp.value = !isNaN(v) ? (v * 1.10).toFixed(2) : "0.00"; });
    }

    ticketItem.querySelector(".radio-lote").addEventListener("change", () => {
        if (listaIngressos.length < 1) { alert("Para 'Por lote', crie mais de um ingresso."); ticketItem.querySelector('input[value="por-data"]').checked = true; }
    });

    ticketItem.querySelector(".remove-ticket").addEventListener("click", () => {
        ticketItem.remove();
        ingressoEditandoIndex = null;
        if (!listaIngressos.length) ticketConfigCard.style.display = "none";
    });

    ticketItem.querySelector(".btnSalvarIngresso").addEventListener("click", () => {
        const tituloInput    = ticketItem.querySelector(".titulo-ingresso");
        const quantidadeInput = ticketItem.querySelector(".quantidade-ingresso");
        const titulo     = tituloInput.value.trim();
        const quantidade = quantidadeInput.value;

        if (!titulo)                       { marcarErro(tituloInput);     alerta("Informe o título do ingresso.", tituloInput);     return; }
        if (!quantidade || quantidade <= 0) { marcarErro(quantidadeInput); alerta("Informe a quantidade de ingressos.", quantidadeInput); return; }

        let valor = 0;
        if (tipo === "pago") {
            const vi = ticketItem.querySelector(".valor-ingresso");
            if (!vi.value || parseFloat(vi.value) <= 0) { marcarErro(vi); alerta("Informe o valor do ingresso pago.", vi); return; }
            valor = parseFloat(vi.value).toFixed(2);
        }

        const ingresso = { titulo, valor, tipo, quantidade_total: quantidade };
        if (ingressoEditandoIndex !== null) { listaIngressos[ingressoEditandoIndex] = ingresso; ingressoEditandoIndex = null; }
        else listaIngressos.push(ingresso);

        renderizarIngressos();
        ticketItem.remove();
    });

    ticketConfigCard.insertBefore(ticketItem, listaContainer);
}

function renderizarIngressos() {
    listaContainer.innerHTML = "";
    if (!listaIngressos.length) { if (!ticketConfigCard.querySelector(".ticket-item")) ticketConfigCard.style.display = "none"; return; }
    listaContainer.innerHTML = "<h3>Ingressos criados</h3>";
    listaIngressos.forEach((ing, i) => {
        const item = document.createElement("div");
        item.classList.add("ingresso-resumo");
        item.innerHTML = `
            <div><strong>${ing.titulo}</strong> &nbsp;— ${ing.tipo === "pago" ? "R$ " + ing.valor : "Gratuito"} (${ing.quantidade_total} unid.)</div>
            <div>
                <button class="btn-editar" onclick="editarIngresso(${i})">Editar</button>
                <button class="btn-excluir" onclick="excluirIngresso(${i})">Excluir</button>
            </div>
        `;
        listaContainer.appendChild(item);
    });
}

function editarIngresso(index) {
    ingressoEditandoIndex = index;
    const ing = listaIngressos[index];
    const existente = ticketConfigCard.querySelector(".ticket-item");
    if (existente) existente.remove();
    ticketConfigCard.style.display = "flex";
    criarFormIngresso(ing.tipo);
    const form = ticketConfigCard.querySelector(".ticket-item");
    form.querySelector(".titulo-ingresso").value    = ing.titulo;
    form.querySelector(".quantidade-ingresso").value = ing.quantidade_total;
    if (ing.tipo === "pago") {
        const vi = form.querySelector(".valor-ingresso");
        const vp = form.querySelector(".valor-participante");
        vi.value = ing.valor;
        vp.value = (parseFloat(ing.valor) * 1.10).toFixed(2);
    }
}

function excluirIngresso(index) { listaIngressos.splice(index, 1); renderizarIngressos(); }