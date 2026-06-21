'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const API_URL = window.API_BASE || '';

/* ═══════════════════════════════════════════
   SHORTCUTS
═══════════════════════════════════════════ */
const g  = id => document.getElementById(id);
const gv = id => g(id)?.value.trim() || '';

/* ═══════════════════════════════════════════
   AUTH GUARD — redireciona se não logado
═══════════════════════════════════════════ */
function requireLogin() {
    const userId = getUserId();
    if (!userId) {
        window.location.href = '/frontend/login/login.html';
    }
}

/* ═══════════════════════════════════════════
   AVATAR PADRÃO
═══════════════════════════════════════════ */
const DEFAULT_AVATAR_URL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
    "width='40' height='40' viewBox='0 0 40 40'%3E" +
    "%3Ccircle cx='20' cy='20' r='20' fill='%23ccc'/%3E" +
    "%3Ccircle cx='20' cy='16' r='7' fill='%23fff'/%3E" +
    "%3Cellipse cx='20' cy='34' rx='12' ry='8' fill='%23fff'/%3E" +
    "%3C/svg%3E";

function notifyHeader(name, email, picUrl) {
    const photo = picUrl && picUrl.length > 10 ? picUrl : DEFAULT_AVATAR_URL;
    localStorage.setItem('profilePhotoUrl', photo);
    localStorage.setItem('profileName',     name  || '');
    localStorage.setItem('profileEmail',    email || '');
    applyHeaderData(name, email, photo);
}

function applyHeaderData(name, email, photo) {
    const picHeader = document.getElementById('profile-pic-header');
    if (picHeader) {
        picHeader.src     = photo;
        picHeader.onerror = () => { picHeader.src = DEFAULT_AVATAR_URL; };
    }
    const dropdownImg = document.querySelector('#header-logado .user-info img');
    if (dropdownImg) {
        dropdownImg.src     = photo;
        dropdownImg.onerror = () => { dropdownImg.src = DEFAULT_AVATAR_URL; };
    }
    const nameEl  = document.getElementById('profile-name-header');
    const emailEl = document.getElementById('profile-email-header');
    if (nameEl  && name)  nameEl.textContent  = name;
    if (emailEl && email) emailEl.textContent = email;

    const logado    = document.getElementById('header-logado');
    const naoLogado = document.getElementById('header-nao-logado');
    const hamburger = document.getElementById('hamburger-btn');
    if (logado)    logado.style.display    = 'flex';
    if (naoLogado) naoLogado.style.display = 'none';
    if (hamburger) hamburger.style.display = 'flex';
}

function waitForHeaderAndApply(name, email, photo, tries = 0) {
    const picHeader = document.getElementById('profile-pic-header');
    if (picHeader) { applyHeaderData(name, email, photo); return; }
    if (tries < 20) setTimeout(() => waitForHeaderAndApply(name, email, photo, tries + 1), 150);
}

/* ═══════════════════════════════════════════
   GET USER ID
═══════════════════════════════════════════ */
function getUserId() {
    const directKeys = ['cachedProfileUserId', 'userId', 'id', 'user_id', 'usuarioId', 'usuario_id'];
    for (const key of directKeys) {
        const val = localStorage.getItem(key);
        if (val && val !== 'undefined' && val !== 'null') return val;
    }
    const jsonKeys = ['user', 'userData', 'usuario', 'loggedUser', 'currentUser'];
    for (const key of jsonKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const obj = JSON.parse(raw);
            const id  = obj?.id || obj?.userId || obj?.user_id || obj?.usuarioId;
            if (id) return String(id);
        } catch (_) {}
    }
    return null;
}

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
let _toastTimer;
function showToast(msg, type = 'success') {
    const toast = g('toast');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle' };
    g('toast-icon').className  = 'fas ' + (icons[type] || 'fa-check-circle');
    g('toast-msg').textContent = msg;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ═══════════════════════════════════════════
   SHOW/HIDE section state
═══════════════════════════════════════════ */
function showState(prefix, state) {
    const loading = g(`${prefix}-loading`);
    const empty   = g(`${prefix}-empty`);
    const list    = g(`${prefix}-list`);
    if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
    if (empty)   empty.style.display   = state === 'empty'   ? 'flex' : 'none';
    if (list) {
        list.style.display       = state === 'list' ? 'flex' : 'none';
        list.style.flexDirection = 'column';
    }
}

/* ═══════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════ */
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        g('section-' + item.dataset.section)?.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (item.dataset.section === 'ingressos' && !_ticketsLoaded)   loadTickets();
        if (item.dataset.section === 'favoritos'  && !_favoritosLoaded) loadFavoritos();
        if (item.dataset.section === 'visitas'    && !_visitasLoaded)   loadVisitas();
    });
});

/* ═══════════════════════════════════════════
   VALIDATION HELPERS
═══════════════════════════════════════════ */
function markField(inputEl, errorEl, isInvalid) {
    if (!inputEl) return;
    inputEl.classList.toggle('invalid', isInvalid);
    inputEl.classList.toggle('valid',   !isInvalid);
    if (errorEl) errorEl.classList.toggle('visible', isInvalid);
}
function clearField(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('invalid', 'valid');
    if (errorEl) errorEl.classList.remove('visible');
}

/* ═══════════════════════════════════════════
   VALIDATORS
═══════════════════════════════════════════ */
function validateNome() {
    const v  = gv('nome');
    const ok = v.length >= 3;
    markField(g('nome'), g('erro-nome'), !ok);
    return ok;
}
function validateEmail() {
    const v  = gv('email');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    markField(g('email'), g('erro-email'), !ok);
    return ok;
}
function validateCPF() {
    const tipo = gv('tipo-doc');
    const raw  = gv('cpf');
    if (!raw) { clearField(g('cpf'), g('erro-cpf')); return true; }
    let ok = true;
    if (tipo === 'CPF') {
        const d = raw.replace(/\D/g, '');
        if (d.length !== 11 || /^(.)\1+$/.test(d)) { ok = false; }
        else {
            let s = 0, r;
            for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
            r = (s * 10) % 11; if (r >= 10) r = 0;
            if (r !== +d[9]) ok = false;
            else {
                s = 0;
                for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
                r = (s * 10) % 11; if (r >= 10) r = 0;
                ok = r === +d[10];
            }
        }
    }
    const errEl = g('erro-cpf');
    if (errEl) errEl.textContent = tipo === 'CPF' ? 'CPF inválido.' : 'Informe o número do documento.';
    markField(g('cpf'), errEl, !ok);
    return ok;
}
function validateTelefone() {
    const v = gv('telefone');
    if (!v) { clearField(g('telefone'), g('erro-telefone')); return true; }
    const d  = v.replace(/\D/g, '');
    const ok = d.length === 10 || d.length === 11;
    markField(g('telefone'), g('erro-telefone'), !ok);
    return ok;
}
function validateNascimento() {
    const v = g('nascimento').value;
    if (!v) { clearField(g('nascimento'), g('erro-nascimento')); return true; }
    const minAge = new Date(); minAge.setFullYear(minAge.getFullYear() - 13);
    const ok = new Date(v) <= minAge;
    markField(g('nascimento'), g('erro-nascimento'), !ok);
    return ok;
}
function validateSenhaNova() {
    const v  = g('senha-nova').value;
    const ok = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/.test(v);
    markField(g('senha-nova'), g('erro-senha-nova'), !ok);
    return ok;
}

/* ═══════════════════════════════════════════
   MÁSCARAS
═══════════════════════════════════════════ */
g('cpf').addEventListener('input', function () {
    if (gv('tipo-doc') !== 'CPF') return;
    let v = this.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/(\d{3})(\d)/,       '$1.$2')
         .replace(/(\d{3})(\d)/,       '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    this.value = v;
});
g('telefone').addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').substring(0, 11);
    v = v.length <= 10
        ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
        : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    this.value = v.replace(/-$/, '');
});

g('nome').addEventListener('blur',       validateNome);
g('email').addEventListener('blur',      validateEmail);
g('cpf').addEventListener('blur',        validateCPF);
g('telefone').addEventListener('blur',   validateTelefone);
g('nascimento').addEventListener('blur', validateNascimento);
g('tipo-doc').addEventListener('change', () => clearField(g('cpf'), g('erro-cpf')));

/* ═══════════════════════════════════════════
   PASSWORD STRENGTH
═══════════════════════════════════════════ */
g('senha-nova').addEventListener('input', function () {
    const v = this.value;
    let sc  = 0;
    if (v.length >= 8)        sc++;
    if (/[A-Za-z]/.test(v))  sc++;
    if (/\d/.test(v))         sc++;
    if (/[@$!%*#?&]/.test(v)) sc++;

    const levels = [
        { w: '0%',   c: '',               t: '' },
        { w: '25%',  c: 'var(--danger)',  t: 'Fraca' },
        { w: '50%',  c: 'var(--warning)', t: 'Moderada' },
        { w: '75%',  c: '#85c200',        t: 'Boa' },
        { w: '100%', c: 'var(--success)', t: 'Forte' },
    ][sc];

    g('strength-fill').style.width      = levels.w;
    g('strength-fill').style.background = levels.c;
    g('strength-label').innerHTML = levels.t
        ? `<span style="color:${levels.c}">${levels.t}</span>` : '';
});

/* ═══════════════════════════════════════════
   SHOW / HIDE PASSWORD
═══════════════════════════════════════════ */
document.querySelectorAll('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = g(btn.dataset.target);
        const show  = input.type === 'password';
        input.type  = show ? 'text' : 'password';
        btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
});

/* ═══════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════ */
function setAvatar(src) {
    const img = g('profile-picture');
    const svg = g('avatar-default-svg');

    const cached       = localStorage.getItem('profilePhotoUrl') || '';
    const isRealCached = cached && cached !== DEFAULT_AVATAR_URL && cached.length > 10;
    const finalSrc     = (src && src.length > 10 && !src.endsWith('/'))
                             ? src
                             : (isRealCached ? cached : '');

    if (finalSrc) {
        img.onload  = () => { img.style.display = 'block'; svg.style.display = 'none'; };
        img.onerror = () => {
            localStorage.removeItem('profilePhotoUrl');
            img.style.display = 'none';
            svg.style.display = 'block';
        };
        img.src = finalSrc;
    } else {
        img.style.display = 'none';
        svg.style.display = 'block';
    }
}

g('edit-picture-btn').addEventListener('click', () => g('picture-upload').click());

g('picture-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('A imagem deve ter no máximo 5 MB.', 'error'); return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('Formato inválido. Use JPG, PNG ou WebP.', 'error'); return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
        const dataUrl = ev.target.result;
        setAvatar(dataUrl);
        localStorage.setItem('profilePhotoUrl', dataUrl);
        notifyHeader(
            localStorage.getItem('profileName')  || '',
            localStorage.getItem('profileEmail') || '',
            dataUrl
        );
        showToast('Foto atualizada! Clique em "Salvar alterações" para confirmar.');
    };
    reader.readAsDataURL(file);
});

/* ═══════════════════════════════════════════
   LOAD PROFILE
═══════════════════════════════════════════ */
async function loadProfileData() {
    const userId = getUserId();
    if (!userId) {
        window.location.href = '/frontend/login/login.html';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/usuarios/${userId}`);
        if (res.status === 401 || res.status === 403) {
            window.location.href = '/frontend/login/login.html';
            return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // ── Painel esquerdo ──
        g('profile-name-display').textContent  = data.nome_completo || data.nome || 'Usuário';
        g('profile-email-display').textContent = data.email  || '—';
        g('profile-phone-display').textContent = data.telefone || '—';

        if (data.cidade || data.estado) {
            g('profile-city-display').textContent =
                [data.cidade, data.estado].filter(Boolean).join(' — ');
        }

        const rawDate = data.criado_em || data.data_cadastro || data.created_at;
        if (rawDate) {
            const d      = new Date(rawDate);
            const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
            g('profile-member-since').textContent =
                `Membro desde ${months[d.getMonth()]} ${d.getFullYear()}`;
        }

        // ── Avatar ──
        const backendPhoto = data.foto_perfil || data.avatar || '';
        const cachedPhoto  = localStorage.getItem('profilePhotoUrl') || '';
        const isRealCached = cachedPhoto && cachedPhoto !== DEFAULT_AVATAR_URL;
        const photoUrl     = backendPhoto || (isRealCached ? cachedPhoto : '');

        setAvatar(photoUrl);
        if (photoUrl) localStorage.setItem('profilePhotoUrl', photoUrl);
        waitForHeaderAndApply(data.nome_completo || data.nome, data.email, photoUrl || DEFAULT_AVATAR_URL);

        // ── Formulário ──
        if (data.nome_completo || data.nome) g('nome').value = data.nome_completo || data.nome;
        if (data.sobrenome)    g('sobrenome').value  = data.sobrenome;
        if (data.email)        g('email').value      = data.email;
        if (data.telefone)     g('telefone').value   = data.telefone;
        if (data.cpf)          g('cpf').value        = data.cpf;
        if (data.nascimento)   g('nascimento').value = data.nascimento.split('T')[0];
        if (data.sexo)         g('sexo').value       = data.sexo;

        // ── Sessão atual ──
        const ua      = navigator.userAgent;
        const browser = ua.includes('Firefox') ? 'Firefox'
                      : ua.includes('Edg')     ? 'Edge'
                      : ua.includes('Chrome')  ? 'Chrome'
                      : ua.includes('Safari')  ? 'Safari'
                      : 'Navegador';
        const device  = /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop';
        const el      = g('session-current-device');
        if (el) el.textContent = `${browser} — ${device}`;

    } catch (err) {
        console.error('loadProfileData:', err);
        showToast('Não foi possível carregar os dados do perfil.', 'error');
    }
}

/* ═══════════════════════════════════════════
   SAVE PROFILE
═══════════════════════════════════════════ */
g('save-info-btn').addEventListener('click', async () => {
    const isValid = [
        validateNome(),
        validateEmail(),
        validateCPF(),
        validateTelefone(),
        validateNascimento()
    ].every(Boolean);

    if (!isValid) {
        showToast('Corrija os campos destacados antes de salvar.', 'error');
        return;
    }

    const userId = getUserId();
    const btn    = g('save-info-btn');
    btn.classList.add('loading');

    try {
        const picEl  = g('profile-picture');
        const picSrc = (picEl && picEl.style.display !== 'none' && picEl.src && picEl.src.length > 10)
                          ? picEl.src
                          : (localStorage.getItem('profilePhotoUrl') || '');

        const body = {
            id:            userId,
            nome_completo: gv('nome'),
            sobrenome:     gv('sobrenome'),
            email:         gv('email'),
            telefone:      gv('telefone'),
            cpf:           gv('cpf'),
            nascimento:    g('nascimento').value,
            sexo:          g('sexo').value,
            foto_perfil:   picSrc
        };

        const res = await fetch(`${API_URL}/usuarios/perfil`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.erro || err.message || 'HTTP ' + res.status);
        }

        if (picSrc && picSrc !== DEFAULT_AVATAR_URL) {
            localStorage.setItem('profilePhotoUrl', picSrc);
        }
        localStorage.setItem('profileName',  body.nome_completo);
        localStorage.setItem('profileEmail', body.email);

        g('profile-name-display').textContent  = body.nome_completo;
        g('profile-email-display').textContent = body.email;
        g('profile-phone-display').textContent = body.telefone || '—';
        notifyHeader(body.nome_completo, body.email, picSrc || DEFAULT_AVATAR_URL);
        showToast('Perfil atualizado com sucesso!', 'success');

    } catch (err) {
        console.error('saveProfile:', err);
        showToast(err.message || 'Falha ao salvar. Verifique o servidor.', 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

/* ═══════════════════════════════════════════
   CHANGE PASSWORD
═══════════════════════════════════════════ */
g('form-senha').addEventListener('submit', async e => {
    e.preventDefault();

    const atual    = g('senha-atual').value;
    const nova     = g('senha-nova').value;
    const confirma = g('senha-confirma').value;
    let valid      = true;

    if (!atual) {
        markField(g('senha-atual'), g('erro-senha-atual'), true); valid = false;
    } else {
        clearField(g('senha-atual'), g('erro-senha-atual'));
    }
    if (!validateSenhaNova()) valid = false;
    if (nova !== confirma) {
        markField(g('senha-confirma'), g('erro-senha-confirma'), true); valid = false;
    } else {
        clearField(g('senha-confirma'), g('erro-senha-confirma'));
    }

    if (!valid) { showToast('Corrija os campos destacados.', 'error'); return; }

    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');

    try {
        const res = await fetch(`${API_URL}/usuarios/senha`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: getUserId(), senhaAtual: atual, novaSenha: nova })
        });

        if (res.status === 401) {
            const errEl = g('erro-senha-atual');
            if (errEl) errEl.textContent = 'Senha atual incorreta.';
            markField(g('senha-atual'), errEl, true);
            showToast('Senha atual incorreta.', 'error');
            return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);

        showToast('Senha alterada com sucesso!', 'success');
        resetSenhaForm();

    } catch (err) {
        console.error('changePassword:', err);
        showToast('Falha ao alterar a senha. Tente novamente.', 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

g('cancel-senha-btn').addEventListener('click', resetSenhaForm);

function resetSenhaForm() {
    g('form-senha').reset();
    g('strength-fill').style.width = '0%';
    g('strength-label').innerHTML  = '';
    g('form-senha').querySelectorAll('input').forEach(i => i.classList.remove('valid', 'invalid'));
    g('form-senha').querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));
}

/* ═══════════════════════════════════════════
   TICKETS
═══════════════════════════════════════════ */
let _ticketsLoaded = false;
let _allTickets    = [];
let _currentFilter = 'todos';

async function loadTickets() {
    const userId = getUserId();
    if (!userId) return;
    showState('tickets', 'loading');

    const endpoints = [
        `${API_URL}/ingressos/usuario/${userId}`,
        `${API_URL}/ingressos?usuarioId=${userId}`,
        `${API_URL}/pedidos/usuario/${userId}`,
        `${API_URL}/compras/usuario/${userId}`,
    ];

    let raw = null;
    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (res.ok) { raw = await res.json(); break; }
        } catch (_) {}
    }

    _ticketsLoaded = true;
    const items = Array.isArray(raw) ? raw : (raw?.ingressos || raw?.data || raw?.pedidos || []);

    // Atualiza badge no nav
    const badge = g('nav-ticket-count');
    if (badge && items.length > 0) {
        badge.textContent = items.length;
        badge.style.display = 'inline-block';
    }

    // Resumo
    if (items.length > 0) {
        const hoje     = new Date(); hoje.setHours(0,0,0,0);
        const proximos = items.filter(t => t.data_evento && new Date(t.data_evento) >= hoje).length;
        const gasto    = items.reduce((acc, t) => acc + (parseFloat(t.preco) || 0), 0);
        g('summary-total')?.setAttribute('data-val', items.length);
        g('summary-proximos')?.setAttribute('data-val', proximos);
        const sumEl = g('tickets-summary');
        if (sumEl) sumEl.style.display = 'block';
        if (g('summary-total'))    g('summary-total').textContent    = items.length;
        if (g('summary-proximos')) g('summary-proximos').textContent = proximos;
        if (g('summary-gasto'))    g('summary-gasto').textContent    = `R$ ${gasto.toFixed(2).replace('.', ',')}`;
    }

    if (!items.length) { showState('tickets', 'empty'); return; }

    _allTickets = items;
    renderTickets(_allTickets, _currentFilter);

    // Filtros de ingressos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _currentFilter = btn.dataset.filter;
            renderTickets(_allTickets, _currentFilter);
        });
    });
}

function renderTickets(tickets, filter) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    const filtered = tickets.filter(t => {
        const d = t.data_evento ? new Date(t.data_evento) : null;
        if (filter === 'proximos') return d && d >= hoje;
        if (filter === 'passados') return d && d < hoje;
        return true;
    });

    if (!filtered.length) { showState('tickets', 'empty'); return; }

    const list = g('tickets-list');
    list.innerHTML = filtered.map(t => {
        const dataEvento  = t.data_evento ? new Date(t.data_evento) : null;
        const isProximo   = dataEvento && dataEvento >= hoje;
        const isHoje      = dataEvento && dataEvento.toDateString() === new Date().toDateString();
        const isPendente  = (t.status_pagamento || t.status) === 'pendente';

        const accentColor = isPendente ? '#f57f17'
            : isHoje    ? '#E24B4A'
            : isProximo ? '#6C1DCE'
            : '#B4B2A9';

        let statusPill;
        if (isPendente)     statusPill = `<span class="tc-status tc-pendente"><i class="fas fa-clock"></i> Pendente</span>`;
        else if (isHoje)    statusPill = `<span class="tc-status tc-hoje"><i class="fas fa-fire"></i> Hoje!</span>`;
        else if (isProximo) statusPill = `<span class="tc-status tc-proximo"><i class="fas fa-check-circle"></i> Próximo</span>`;
        else                statusPill = `<span class="tc-status tc-passado"><i class="fas fa-check"></i> Realizado</span>`;

        const nomeEvento = t.nome_evento || t.evento || t.titulo || 'Evento';
        const local      = t.local_evento || t.local || t.cidade || '';
        const tipo       = t.tipo_ingresso || '';
        const dataStr    = dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const horaStr    = dataEvento ? dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const precoStr   = t.preco ? `R$ ${parseFloat(t.preco).toFixed(2).replace('.', ',')}` : '';
        const stubLabel  = isPendente ? 'PEND.' : (!isProximo && !isHoje) ? 'USADO' : 'SCAN';
        const imgSrc     = t.img_capa
            ? (t.img_capa.startsWith('http') ? t.img_capa : `${API_URL}${t.img_capa.startsWith('/') ? t.img_capa : '/uploads/' + t.img_capa}`)
            : '';

        return `
        <div class="ticket-card" style="${(!isProximo && !isHoje) ? 'opacity:0.65' : ''}"
             onclick="openTicketDetail('${t.id}')">
            <div class="tc-accent" style="background:${accentColor}"></div>
            <div class="tc-image">
                ${imgSrc
                    ? `<img src="${imgSrc}" alt="${nomeEvento}">`
                    : `<div class="tc-image-placeholder"><i class="fas fa-music"></i></div>`}
            </div>
            <div class="tc-body">
                <div class="tc-top">
                    <div>
                        <div class="tc-event-name">${nomeEvento}</div>
                        ${tipo ? `<div class="tc-event-sub">${tipo}${precoStr ? ' • ' + precoStr : ''}</div>` : ''}
                    </div>
                    ${tipo ? `<span class="tc-badge">${tipo}</span>` : ''}
                </div>
                <div class="tc-meta-row">
                    ${statusPill}
                    <span class="tc-meta-item"><i class="fas fa-calendar-alt"></i>${dataStr}${horaStr ? ' • ' + horaStr : ''}</span>
                    ${local ? `<span class="tc-meta-item"><i class="fas fa-map-marker-alt"></i>${local}</span>` : ''}
                </div>
                <div class="tc-actions">
                    ${(isProximo || isHoje) && !isPendente ? `
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); downloadTicket('${t.id}')">
                            <i class="fas fa-download"></i> Baixar
                        </button>` : ''}
                    ${isProximo && !isPendente ? `
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openTransferModal('${t.id}','${nomeEvento.replace(/'/g, "\\'")}')">
                            <i class="fas fa-exchange-alt"></i> Transferir
                        </button>` : ''}
                    ${isPendente ? `<span style="font-size:11px;color:#f57f17;"><i class="fas fa-info-circle"></i> Aguardando confirmação</span>` : ''}
                </div>
            </div>
            <div class="tc-stub">
                <div class="tc-qr"><i class="fas fa-qrcode"></i></div>
                <span class="tc-stub-label">${stubLabel}</span>
            </div>
        </div>`;
    }).join('');

    showState('tickets', 'list');
}

/* ── Modal de detalhes do ingresso ── */
function openTicketDetail(ticketId) {
    const t = _allTickets.find(x => String(x.id) === String(ticketId));
    if (!t) return;

    const dataEvento = t.data_evento ? new Date(t.data_evento) : null;
    const hoje       = new Date(); hoje.setHours(0,0,0,0);
    const isProximo  = dataEvento && dataEvento >= hoje;
    const isHoje     = dataEvento && dataEvento.toDateString() === new Date().toDateString();
    const isPendente = (t.status_pagamento || t.status) === 'pendente';
    const nomeEvento = t.nome_evento || t.evento || t.titulo || 'Evento';
    const imgSrc     = t.img_capa
        ? (t.img_capa.startsWith('http') ? t.img_capa : `${API_URL}${t.img_capa.startsWith('/') ? t.img_capa : '/uploads/' + t.img_capa}`)
        : '';
    const dataStr    = dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const horaStr    = dataEvento ? dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const precoStr   = t.preco ? `R$ ${parseFloat(t.preco).toFixed(2).replace('.', ',')}` : '—';
    const local      = t.local_evento || t.local || t.cidade || '—';
    const tipo       = t.tipo_ingresso || '—';
    const pedidoNum  = `#${String(t.id).padStart(5, '0')}`;

    let overlay = g('ticket-detail-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ticket-detail-overlay';
        overlay.className = 'ticket-detail-overlay';
        overlay.innerHTML = `<div class="ticket-detail-modal" id="ticket-detail-modal"></div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
        document.body.appendChild(overlay);
    }

    g('ticket-detail-modal').innerHTML = `
        <div class="tdm-header">
            ${imgSrc ? `<img src="${imgSrc}" alt="${nomeEvento}">` : ''}
            <button class="tdm-close" onclick="document.getElementById('ticket-detail-overlay').classList.remove('open')">
                <i class="fas fa-times"></i>
            </button>
            <div class="tdm-header-info"><h3>${nomeEvento}</h3></div>
        </div>
        <div class="tdm-body">
            <div class="tdm-info-grid">
                <div class="tdm-info-item"><label>Pedido</label><span>${pedidoNum}</span></div>
                <div class="tdm-info-item"><label>Status</label><span>${isPendente ? 'Pendente' : 'Confirmado'}</span></div>
                <div class="tdm-info-item"><label>Data</label><span>${dataStr}</span></div>
                <div class="tdm-info-item"><label>Horário</label><span>${horaStr}</span></div>
                <div class="tdm-info-item"><label>Local</label><span>${local}</span></div>
                <div class="tdm-info-item"><label>Tipo</label><span>${tipo}</span></div>
                <div class="tdm-info-item"><label>Valor pago</label><span>${precoStr}</span></div>
                <div class="tdm-info-item"><label>Pagamento</label><span>${t.forma_pagamento || '—'}</span></div>
            </div>
            <div class="tdm-qr">
                <i class="fas fa-qrcode"></i>
                <p>Apresente este QR Code na entrada do evento</p>
            </div>
            <div class="tdm-actions">
                ${(isProximo || isHoje) && !isPendente ? `
                    <button class="btn btn-primary" onclick="downloadTicket('${t.id}')">
                        <i class="fas fa-download"></i> Baixar PDF
                    </button>` : ''}
                ${isProximo && !isPendente ? `
                    <button class="btn btn-ghost" onclick="openTransferModal('${t.id}','${nomeEvento.replace(/'/g, "\\'")}'); document.getElementById('ticket-detail-overlay').classList.remove('open')">
                        <i class="fas fa-exchange-alt"></i> Transferir
                    </button>` : ''}
                <button class="btn btn-ghost" onclick="document.getElementById('ticket-detail-overlay').classList.remove('open')">
                    Fechar
                </button>
            </div>
        </div>`;

    overlay.classList.add('open');
}

/* ═══════════════════════════════════════════
   DOWNLOAD PDF — mesmo modelo (cartão estilo embarque + QR real)
   usado em Confirmacao.js, pra manter o ingresso consistente
   em todo o site.
═══════════════════════════════════════════ */
const LOGO_PATH = '/frontend/imagens/logo-roles.png';

function fmtBRL(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
}

// Carrega uma imagem do próprio projeto e devolve como dataURL (pra addImage do jsPDF)
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

// Gera um QR Code real (lib qrcode.js) e devolve como dataURL
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

async function downloadTicket(ticketId) {
    const t = _allTickets.find(x => String(x.id) === String(ticketId));
    if (!t) return;

    if (!window.jspdf) {
        showToast('Não foi possível carregar o gerador de PDF.', 'error');
        return;
    }

    const dataEvento = t.data_evento ? new Date(t.data_evento) : null;
    const pedidoId    = String(t.id).padStart(5, '0');

    const dados = {
        nome:            t.nome_evento || t.evento || t.titulo || 'Evento',
        data:            dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—',
        hora:            dataEvento ? dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
        local:           t.local_evento || t.local || t.cidade || '—',
        ingressoNome:    t.tipo_ingresso || 'Ingresso',
        quantidade:      t.quantidade || 1,
        totalPago:       t.preco,
        forma_pagamento: t.forma_pagamento,
        beneficios:      Array.isArray(t.beneficios) ? t.beneficios : [],
    };

    try {
        await gerarPdfIngresso(pedidoId, dados);
        showToast('PDF baixado com sucesso!', 'success');
    } catch (err) {
        console.error('downloadTicket:', err);
        showToast('Não foi possível gerar o PDF agora.', 'error');
    }
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

/* ═══════════════════════════════════════════
   TRANSFER MODAL
═══════════════════════════════════════════ */
let _transferTicketId = null;

function openTransferModal(ticketId, ticketName) {
    _transferTicketId = ticketId;
    g('transfer-ticket-name').textContent = ticketName;
    g('transfer-email').value             = '';
    g('erro-transfer-email').classList.remove('visible');
    g('transfer-modal').classList.add('open');
}

g('cancel-transfer-btn').addEventListener('click', () => g('transfer-modal').classList.remove('open'));
g('transfer-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});
g('confirm-transfer-btn').addEventListener('click', async () => {
    const email = g('transfer-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        g('erro-transfer-email').classList.add('visible'); return;
    }
    g('erro-transfer-email').classList.remove('visible');
    const btn = g('confirm-transfer-btn');
    btn.classList.add('loading');
    try {
        const res = await fetch(`${API_URL}/ingressos/${_transferTicketId}/transferir`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email_destinatario: email })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Erro na transferência');
        }
        showToast(`Ingresso transferido para ${email}!`, 'success');
        g('transfer-modal').classList.remove('open');
        _ticketsLoaded = false;
        loadTickets();
    } catch (err) {
        showToast(err.message || 'Falha na transferência.', 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

/* ═══════════════════════════════════════════
   FAVORITOS
═══════════════════════════════════════════ */
let _favoritosLoaded = false;

async function loadFavoritos() {
    const userId = getUserId();
    showState('favoritos', 'loading');

    const localItems = getFavoritosDoStorage();
    if (localItems.length > 0) {
        renderFavoritos(localItems);
        _favoritosLoaded = true;
        if (userId) sincronizarFavoritosComBackend(userId, localItems);
        return;
    }

    if (!userId) { _favoritosLoaded = true; showState('favoritos', 'empty'); return; }

    const endpoints = [
        `${API_URL}/favoritos/usuario/${userId}`,
        `${API_URL}/favoritos?usuarioId=${userId}`,
        `${API_URL}/usuarios/${userId}/favoritos`,
    ];
    let raw = null;
    for (const url of endpoints) {
        try { const res = await fetch(url); if (res.ok) { raw = await res.json(); break; } } catch (_) {}
    }
    _favoritosLoaded = true;
    const items = Array.isArray(raw) ? raw : (raw?.favoritos || raw?.data || []);
    if (!items.length) { showState('favoritos', 'empty'); return; }
    renderFavoritos(items);
}

function getFavoritosDoStorage() {
    try {
        const raw = localStorage.getItem('roles_favoritos_dados');
        if (!raw) return [];
        return Object.values(JSON.parse(raw)).filter(Boolean);
    } catch { return []; }
}

function renderFavoritos(items) {
    if (!items.length) { showState('favoritos', 'empty'); return; }

    const colorMap = {
        'Shows e Música':      { color: '#7F77DD', light: '#EEEDFE' },
        'Festa e Balada':      { color: '#D4537E', light: '#FBEAF0' },
        'Balada':              { color: '#D4537E', light: '#FBEAF0' },
        'Gastronomia':         { color: '#D85A30', light: '#FAECE7' },
        'Restaurante':         { color: '#D85A30', light: '#FAECE7' },
        'Bar':                 { color: '#BA7517', light: '#FAEEDA' },
        'Parque':              { color: '#3B6D11', light: '#EAF3DE' },
        'Esportes':            { color: '#0F6E56', light: '#E1F5EE' },
        'Cultura e Arte':      { color: '#534AB7', light: '#EEEDFE' },
        'Tecnologia':          { color: '#185FA5', light: '#E6F1FB' },
        'Infantil e Família':  { color: '#993C1D', light: '#FAECE7' },
        'default':             { color: '#7F77DD', light: '#EEEDFE' },
    };

    const iconMap = {
        'Shows e Música':      'fa-music',
        'Festa e Balada':      'fa-music',
        'Balada':              'fa-music',
        'Gastronomia':         'fa-utensils',
        'Restaurante':         'fa-utensils',
        'Bar':                 'fa-cocktail',
        'Parque':              'fa-tree',
        'Esportes':            'fa-running',
        'Cultura e Arte':      'fa-palette',
        'Tecnologia':          'fa-laptop',
        'Infantil e Família':  'fa-child',
        'default':             'fa-calendar-star',
    };

    g('favoritos-list').innerHTML = items.map(f => {
        const nome      = f.titulo || f.nome || f.nome_local || '—';
        const categoria = f.categoria || '';
        const data      = f.data   || '';
        const local     = f.local  || f.cidade || '';
        const preco     = f.preco  || '';
        const url       = f.url    || '#';
        const id        = f.id     || '';

        const palette   = colorMap[categoria] || colorMap['default'];
        const icon      = iconMap[categoria]  || iconMap['default'];

        // Iniciais para o thumb (até 3 letras)
        const initials = nome
            .split(' ')
            .filter(Boolean)
            .slice(0, 3)
            .map(w => w[0].toUpperCase())
            .join('');

        const thumbHtml = f.imagem
            ? `<img src="${f.imagem}" alt="${nome}"
                    style="width:100%;height:100%;object-fit:cover;display:block;">`
            : `<span style="font-size:13px;font-weight:600;letter-spacing:.5px;
                            color:${palette.color};">${initials}</span>`;

        const metaDate  = data  ? `<span class="fav-meta-item"><i class="fas fa-calendar-alt"></i>${data}</span>`  : '';
        const metaLocal = local ? `<span class="fav-meta-item"><i class="fas fa-map-marker-alt"></i>${local}</span>` : '';

        return `
        <div class="fav-event-card" data-evento-id="${id}">
            <div class="fav-accent" style="background:${palette.color};"></div>

            <div class="fav-thumb" style="background:${palette.light};">
                ${thumbHtml}
            </div>

            <div class="fav-body">
                <div class="fav-top">
                    <p class="fav-name">${nome}</p>
                    ${categoria ? `<span class="fav-cat-tag">${categoria}</span>` : ''}
                </div>

                ${(metaDate || metaLocal) ? `
                <div class="fav-meta">
                    ${metaDate}
                    ${metaLocal}
                </div>` : ''}

                <div class="fav-foot">
                    ${preco ? `<span class="fav-price">${preco}</span>` : '<span></span>'}
                    <div class="fav-actions">
                        <a href="${url}" class="btn btn-primary btn-sm">
                            <i class="fas fa-eye"></i> Ver evento
                        </a>
                        <button class="btn btn-ghost btn-sm fav-del-btn"
                                onclick="removeFavoritoLocal('${id}', this)"
                                title="Remover dos favoritos"
                                aria-label="Remover ${nome} dos favoritos">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    showState('favoritos', 'list');
}

function removeFavoritoLocal(id, btn) {
    try {
        const dados = JSON.parse(localStorage.getItem('roles_favoritos_dados') || '{}');
        delete dados[id];
        localStorage.setItem('roles_favoritos_dados', JSON.stringify(dados));
    } catch (_) {}
    try {
        const set = new Set(JSON.parse(localStorage.getItem('roles_favoritos') || '[]'));
        set.delete(id);
        localStorage.setItem('roles_favoritos', JSON.stringify([...set]));
    } catch (_) {}
    const item = btn.closest('.list-item');
    item.style.transition = 'opacity .3s, transform .3s';
    item.style.opacity = '0'; item.style.transform = 'translateX(20px)';
    setTimeout(() => {
        item.remove();
        if (!g('favoritos-list').querySelectorAll('.list-item').length) showState('favoritos', 'empty');
        showToast('Removido dos favoritos.');
    }, 310);
}

async function sincronizarFavoritosComBackend(userId, localItems) {
    try {
        for (const item of localItems) {
            if (!item.id) continue;
            await fetch(`${API_URL}/favoritos`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuarioId: userId, eventoId: item.id, ...item })
            });
        }
    } catch (_) {}
}

async function removeFavorito(id, btn) { removeFavoritoLocal(id, btn); }

/* ═══════════════════════════════════════════
   VISITAS
═══════════════════════════════════════════ */
let _visitasLoaded = false;

async function loadVisitas() {
    const userId = getUserId();
    if (!userId) return;
    showState('visitas', 'loading');

    const endpoints = [
        `${API_URL}/visitas/usuario/${userId}`,
        `${API_URL}/historico/usuario/${userId}`,
        `${API_URL}/usuarios/${userId}/visitas`,
    ];
    let raw = null;
    for (const url of endpoints) {
        try { const res = await fetch(url); if (res.ok) { raw = await res.json(); break; } } catch (_) {}
    }
    _visitasLoaded = true;
    const items = Array.isArray(raw) ? raw : (raw?.visitas || raw?.data || []);
    if (!items.length) { showState('visitas', 'empty'); return; }

    g('visitas-list').innerHTML = items.map(v => {
        const nota    = parseInt(v.nota || v.avaliacao || 0);
        const dataStr = v.data_visita ? new Date(v.data_visita).toLocaleDateString('pt-BR') : '—';
        const stars   = [1,2,3,4,5].map(i =>
            `<i class="fas fa-star ${i <= nota ? 'filled' : 'empty'}"></i>`).join('');
        return `
        <div class="list-item">
            <div class="item-icon"><i class="fas fa-map-marker-alt"></i></div>
            <div class="item-info">
                <div class="item-name">${v.nome || v.nome_local || '—'}</div>
                <div class="item-sub">Visitado em ${dataStr}</div>
            </div>
            <div class="stars">${stars}</div>
        </div>`;
    }).join('');
    showState('visitas', 'list');
}

/* ═══════════════════════════════════════════
   SESSÕES
═══════════════════════════════════════════ */
document.querySelectorAll('.session-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const card = btn.closest('.session-card');
        card.style.transition = 'opacity .3s, transform .3s';
        card.style.opacity = '0'; card.style.transform = 'translateX(20px)';
        setTimeout(() => { card.remove(); showToast('Sessão encerrada.'); }, 310);
    });
});

g('logout-all-btn')?.addEventListener('click', () => {
    const outras = document.querySelectorAll('.session-card:not(.current)');
    if (outras.length === 0) {
        // Só tem a sessão atual — encerra tudo e faz logout
        showToast('Sessão encerrada. Saindo...', 'warning');
        setTimeout(() => {
            localStorage.clear();
            window.location.href = '/frontend/login/login.html';
        }, 1500);
        return;
    }
    // Remove outras sessões visualmente
    outras.forEach((card, i) => setTimeout(() => {
        card.style.transition = 'opacity .3s'; card.style.opacity = '0';
        setTimeout(() => card.remove(), 310);
    }, i * 80));
    setTimeout(() => showToast('Todas as outras sessões foram encerradas.'), outras.length * 80 + 100);
});

/* ═══════════════════════════════════════════
   DELETE MODAL
═══════════════════════════════════════════ */
g('open-delete-modal').addEventListener('click',  () => g('delete-modal').classList.add('open'));
g('cancel-delete-btn').addEventListener('click',  () => g('delete-modal').classList.remove('open'));
g('delete-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});
g('confirm-delete-btn').addEventListener('click', async () => {
    const userId = getUserId();
    if (userId) {
        try {
            await fetch(`${API_URL}/usuarios/${userId}`, { method: 'DELETE' });
        } catch (_) {}
    }
    showToast('Conta excluída. Redirecionando...', 'warning');
    g('delete-modal').classList.remove('open');
    setTimeout(() => { localStorage.clear(); window.location.href = '/frontend/login/login.html'; }, 2200);
});

/* ═══════════════════════════════════════════
   LOGOUT
═══════════════════════════════════════════ */
g('logout-nav').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/frontend/login/logoutUsuario.html';
});

/* ═══════════════════════════════════════════
   FAQ
═══════════════════════════════════════════ */
document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
        const open = q.classList.toggle('open');
        q.nextElementSibling.classList.toggle('visible', open);
    });
});

/* ═══════════════════════════════════════════
   RECUPERAR SENHA — modal inline no perfil
═══════════════════════════════════════════ */
g('btn-abrir-recuperar-senha').addEventListener('click', () => {
    // reseta o modal
    g('recuperar-etapa-1').style.display = 'block';
    g('recuperar-etapa-2').style.display = 'none';
    g('recuperar-email').value           = '';
    g('recuperar-codigo').value          = '';
    g('recuperar-nova-senha').value      = '';
    document.querySelectorAll('#recuperar-senha-modal .field-error')
        .forEach(e => e.classList.remove('visible'));
    g('recuperar-senha-modal').classList.add('open');
});

g('btn-cancelar-recuperar').addEventListener('click', () => {
    g('recuperar-senha-modal').classList.remove('open');
});

g('recuperar-senha-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// Etapa 1 — enviar código
g('btn-enviar-codigo-recuperar').addEventListener('click', async () => {
    const email = g('recuperar-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        g('erro-recuperar-email').classList.add('visible'); return;
    }
    g('erro-recuperar-email').classList.remove('visible');

    const btn = g('btn-enviar-codigo-recuperar');
    btn.classList.add('loading');

    try {
        const res = await fetch(`${API_URL}/usuarios/recuperar-senha`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao enviar código.');

        showToast('Código enviado para ' + email + '!', 'success');
        g('recuperar-etapa-1').style.display = 'none';
        g('recuperar-etapa-2').style.display = 'block';

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

// Voltar para etapa 1
g('btn-voltar-recuperar').addEventListener('click', () => {
    g('recuperar-etapa-1').style.display = 'block';
    g('recuperar-etapa-2').style.display = 'none';
});

// Etapa 2 — redefinir senha
g('btn-redefinir-senha').addEventListener('click', async () => {
    const email    = g('recuperar-email').value.trim();
    const codigo   = g('recuperar-codigo').value.trim();
    const novaSenha = g('recuperar-nova-senha').value;

    let valid = true;
    if (!codigo) { g('erro-recuperar-codigo').classList.add('visible'); valid = false; }
    else g('erro-recuperar-codigo').classList.remove('visible');

    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/.test(novaSenha)) {
        g('erro-recuperar-nova-senha').classList.add('visible'); valid = false;
    } else {
        g('erro-recuperar-nova-senha').classList.remove('visible');
    }
    if (!valid) return;

    const btn = g('btn-redefinir-senha');
    btn.classList.add('loading');

    try {
        const res = await fetch(`${API_URL}/usuarios/redefinir-senha`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, codigo, novaSenha }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao redefinir senha.');

        showToast('Senha redefinida com sucesso!', 'success');
        g('recuperar-senha-modal').classList.remove('open');

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

/* ═══════════════════════════════════════════
   HISTÓRICO DE ACESSOS
═══════════════════════════════════════════ */
g('btn-ver-historico').addEventListener('click', async () => {
    const card = g('historico-card');
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });

    g('historico-loading').style.display = 'flex';
    g('historico-empty').style.display   = 'none';
    g('historico-list').style.display    = 'none';

    const userId = getUserId();
    try {
        const res  = await fetch(`${API_URL}/usuarios/historico-acessos/${userId}`);
        const rows = await res.json();

        g('historico-loading').style.display = 'none';

        if (!rows.length) {
            g('historico-empty').style.display = 'flex'; return;
        }

        g('historico-list').innerHTML = rows.map(r => {
            const data = new Date(r.criado_em).toLocaleString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const icon = r.dispositivo?.includes('Mobile') ? 'fa-mobile-alt' : 'fa-laptop';
            return `
            <div class="list-item">
                <div class="item-icon"><i class="fas ${icon}"></i></div>
                <div class="item-info">
                    <div class="item-name">${r.dispositivo || 'Dispositivo desconhecido'}</div>
                    <div class="item-sub">${data} · IP: ${r.ip || '—'}</div>
                </div>
            </div>`;
        }).join('');

        g('historico-list').style.display = 'block';

    } catch (err) {
        g('historico-loading').style.display = 'none';
        showToast('Erro ao carregar histórico.', 'error');
    }
});

g('btn-fechar-historico').addEventListener('click', () => {
    g('historico-card').style.display = 'none';
});

/* ── TOGGLE ALERTA NOVO DISPOSITIVO ── */
g('btn-toggle-alerta')?.addEventListener('click', async () => {
    const userId = getUserId();
    const ativo  = g('btn-toggle-alerta').textContent.trim() === 'Desativar';
    const novoVal = ativo ? 0 : 1;

    try {
        await fetch(`${API_URL}/usuarios/alerta-dispositivo`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: userId, alerta: novoVal })
        });

        if (novoVal === 0) {
            g('alerta-status').className = 'status-badge off';
            g('alerta-status').innerHTML = '<i class="fas fa-times-circle"></i> Desativado';
            g('btn-toggle-alerta').textContent = 'Ativar';
        } else {
            g('alerta-status').className = 'status-badge ok';
            g('alerta-status').innerHTML = '<i class="fas fa-check-circle"></i> Ativo';
            g('btn-toggle-alerta').textContent = 'Desativar';
        }
        showToast(novoVal === 0 ? 'Alertas desativados.' : 'Alertas ativados.');
    } catch {
        showToast('Erro ao atualizar preferência.', 'error');
    }
});
/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    requireLogin();

    const cachedName  = localStorage.getItem('profileName')     || '';
    const cachedEmail = localStorage.getItem('profileEmail')    || '';
    const cachedPhoto = localStorage.getItem('profilePhotoUrl') || DEFAULT_AVATAR_URL;
    waitForHeaderAndApply(cachedName, cachedEmail, cachedPhoto);

    loadProfileData();
    loadTickets();

    const urlParams = new URLSearchParams(window.location.search);
    const section   = urlParams.get('section');
    if (section) {
        document.querySelector(`.nav-item[data-section="${section}"]`)?.click();
    }
});