'use strict';

/* ════════════════════════════════════════════════════════════════
   AGENDA DO ORGANIZADOR — ROLÊS
   Arquivo independente: carregue DEPOIS de dashboard.js.
   Usa (somente leitura) os globais do dashboard.js:
     _eventosReais, _vendidosPorEventoReais, _ingressosPorEventoReais
   e as funções: openEditModal, openTicketModal, openRelatorioEvento, showToast
   Expõe: window.renderAgenda()
   ════════════════════════════════════════════════════════════════ */
(function () {
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  // Feriados locais/municipais: adicione aqui. Ex.: { dia: 24, mes: 10, nome: 'Aniversário de Goiânia' }
  const FERIADOS_LOCAIS = [];

  // ───────── helpers de data ─────────
  const pad = n => String(n).padStart(2, '0');
  const chave = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseChave = k => { const [y, m, dd] = k.split('-').map(Number); return new Date(y, m - 1, dd); };
  const inicioDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffDias = (a, b) => Math.round((inicioDia(a) - inicioDia(b)) / 86400000);
  const hoje = () => inicioDia(new Date());
  const hora = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function parseData(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    let s = String(v);
    if (/^\d{4}-\d{2}-\d{2} /.test(s)) s = s.replace(' ', 'T');
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function dataExtensa(d) {
    return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
  }
  function dataCurta(d) {
    return `${DIAS_CURTOS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  // ───────── feriados e datas comerciais ─────────
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  }
  function nthDiaSemana(ano, mes, diaSemana, n) {
    const first = new Date(ano, mes, 1);
    const offset = (diaSemana - first.getDay() + 7) % 7;
    return new Date(ano, mes, 1 + offset + 7 * (n - 1));
  }

  const _cacheFeriados = {};
  function feriadosDoAno(ano) {
    if (_cacheFeriados[ano]) return _cacheFeriados[ano];
    const m = {};
    const add = (d, nome, tipo) => { m[chave(d)] = { nome, tipo }; };
    // feriados nacionais fixos
    [[1, 0, 'Confraternização Universal'], [21, 3, 'Tiradentes'], [1, 4, 'Dia do Trabalho'],
     [7, 8, 'Independência do Brasil'], [12, 9, 'N. Sra. Aparecida'], [2, 10, 'Finados'],
     [15, 10, 'Proclamação da República'], [20, 10, 'Consciência Negra'], [25, 11, 'Natal']]
      .forEach(([dia, mes, nome]) => add(new Date(ano, mes, dia), nome, 'feriado'));
    // móveis
    const p = pascoa(ano);
    add(addDias(p, -48), 'Carnaval (segunda)', 'ponto');
    add(addDias(p, -47), 'Carnaval (terça)', 'ponto');
    add(addDias(p, -2), 'Sexta-feira Santa', 'feriado');
    add(addDias(p, 60), 'Corpus Christi', 'ponto');
    // datas comerciais (não são folga, mas movimentam o público)
    add(new Date(ano, 5, 12), 'Dia dos Namorados', 'data');
    add(nthDiaSemana(ano, 4, 0, 2), 'Dia das Mães', 'data');
    add(nthDiaSemana(ano, 7, 0, 2), 'Dia dos Pais', 'data');
    add(new Date(ano, 9, 31), 'Halloween', 'data');
    add(addDias(nthDiaSemana(ano, 10, 4, 4), 1), 'Black Friday', 'data');
    FERIADOS_LOCAIS.forEach(f => add(new Date(ano, f.mes, f.dia), f.nome, 'feriado'));
    _cacheFeriados[ano] = m;
    return m;
  }
  const infoDia = d => feriadosDoAno(d.getFullYear())[chave(d)] || null;

  // ───────── dados vindos do dashboard.js ─────────
  function lerEventos() {
    const lista = (typeof _eventosReais !== 'undefined' && Array.isArray(_eventosReais)) ? _eventosReais : [];
    const vend = (typeof _vendidosPorEventoReais !== 'undefined') ? _vendidosPorEventoReais : {};
    const tot = (typeof _ingressosPorEventoReais !== 'undefined') ? _ingressosPorEventoReais : {};
    return lista.map(e => {
      const ini = parseData(e.data_inicio);
      if (!ini) return null;
      const fim = parseData(e.data_fim);
      return {
        id: e.id, nome: e.nome || 'Sem nome', ini, fim: (fim && fim > ini) ? fim : null,
        local: e.local_nome || e.cidade || '',
        vendidos: (vend[e.id] && vend[e.id].qtd) || 0,
        total: tot[e.id] || 0
      };
    }).filter(Boolean).sort((a, b) => a.ini - b.ini);
  }

  // Um evento que termina de madrugada (até 6h) não "ocupa" o dia seguinte.
  function ultimoDiaOcupado(ev) {
    if (!ev.fim) return inicioDia(ev.ini);
    const fimEf = new Date(ev.fim.getTime() - 6 * 3600e3);
    return fimEf > ev.ini ? inicioDia(fimEf) : inicioDia(ev.ini);
  }

  function mapaPorDia(evs) {
    const m = {};
    evs.forEach(ev => {
      const a = inicioDia(ev.ini);
      const n = Math.min(Math.max(diffDias(ultimoDiaOcupado(ev), a), 0), 14);
      for (let i = 0; i <= n; i++) (m[chave(addDias(a, i))] = m[chave(addDias(a, i))] || []).push(ev);
    });
    return m;
  }

  // ───────── estado ─────────
  const _h0 = hoje();
  const state = {
    ano: _h0.getFullYear(), mes: _h0.getMonth(),
    selecionado: chave(_h0),
    view: 'mes',
    sugestoes: true,
    antecedencia: 14
  };
  let cache = { evs: [], mapa: {} };

  // ───────── pontuação de datas (heurística, não é dado de mercado) ─────────
  function pontuar(d, ignorarId) {
    const bons = [], ruins = [];
    let s = 0, conflito = false;
    const dow = d.getDay();

    s += [5, 1, 2, 3, 6, 10, 10][dow];
    if (dow === 5 || dow === 6) bons.push(`${DIAS_LONGOS[dow]}: dia de maior procura por eventos`);
    else if (dow >= 1 && dow <= 3) ruins.push(`${DIAS_LONGOS[dow]}: meio de semana, público tende a ser menor`);

    const info = infoDia(d);
    if (info) {
      if (info.tipo === 'data') { s += 1; bons.push(`${info.nome}: boa para eventos temáticos`); }
      else { s += 2; bons.push(`Feriado: ${info.nome}`); }
    }
    const amanha = infoDia(addDias(d, 1));
    if (amanha && amanha.tipo !== 'data' && dow !== 0 && dow !== 6) {
      s += 4; bons.push(`Véspera de feriado (${amanha.nome})`);
    }
    if (d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 25)) { s -= 8; ruins.push('Natal: adesão costuma ser baixa'); }
    if (d.getMonth() === 11 && d.getDate() === 31) { s += 3; bons.push('Réveillon: demanda alta (a concorrência também)'); }

    const dia = d.getDate();
    if (dia <= 8) { s += 2; bons.push('Início do mês: orçamento do público costuma estar mais folgado'); }
    else if (dia >= 20 && dia <= 22) { s += 1; bons.push('Meio do mês: segunda quinzena de pagamento'); }

    // concorrência com os próprios eventos
    const ign = ignorarId == null ? null : String(ignorarId);
    const nos = delta => (cache.mapa[chave(addDias(d, delta))] || []).filter(e => String(e.id) !== ign);
    const mesmoDia = nos(0);
    if (mesmoDia.length) {
      conflito = true; s -= 100;
      ruins.push(`Você já tem "${mesmoDia[0].nome}" neste dia`);
    } else {
      const perto1 = [...nos(-1), ...nos(1)];
      const perto2 = [...nos(-2), ...nos(2)];
      if (perto1.length) { s -= 4; ruins.push(`Colado em "${perto1[0].nome}": vocês dividiriam o mesmo público`); }
      else if (perto2.length) { s -= 2; ruins.push(`Perto de "${perto2[0].nome}" (2 dias): pode dividir público`); }
    }
    return { score: s, bons, ruins, conflito };
  }

  function rotulo(p) {
    if (p.conflito) return { k: 'conflito', txt: 'Conflito' };
    if (p.score >= 12) return { k: 'otima', txt: 'Ótima' };
    if (p.score >= 8) return { k: 'boa', txt: 'Boa' };
    if (p.score >= 4) return { k: 'regular', txt: 'Regular' };
    return { k: 'fraca', txt: 'Fraca' };
  }

  function melhoresDatas(antecedencia, limite) {
    const h = hoje(), todas = [];
    for (let i = antecedencia; i < antecedencia + 90; i++) {
      const d = addDias(h, i);
      const p = pontuar(d, null);
      if (!p.conflito) todas.push({ d, ...p });
    }
    todas.sort((a, b) => b.score - a.score || a.d - b.d);
    const out = [];
    for (const t of todas) {
      if (out.length >= limite) break;
      if (out.some(o => Math.abs(diffDias(o.d, t.d)) <= 1)) continue; // evita sexta+sábado seguidos
      out.push(t);
    }
    return out.sort((a, b) => a.d - b.d);
  }

  // ───────── revisão de datas ─────────
  const KEY_CONFIRMADAS = 'rolesAgendaConfirmadas';
  function lerConfirmadas() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY_CONFIRMADAS) || '[]')); } catch { return new Set(); }
  }
  function salvarConfirmadas(set) {
    try { localStorage.setItem(KEY_CONFIRMADAS, JSON.stringify([...set])); } catch { /* sem storage */ }
  }
  const chaveConfirmacao = ev => `${ev.id}|${chave(ev.ini)}`; // mudou a data -> confirmação some

  function revisar(ev) {
    const h = hoje();
    const dias = diffDias(ev.ini, h);
    const p = pontuar(inicioDia(ev.ini), ev.id);
    const alertas = []; // { nivel: 'alto'|'medio', txt }

    if (p.conflito) alertas.push({ nivel: 'alto', txt: p.ruins.find(r => r.startsWith('Você já tem')) });
    p.ruins.filter(r => !r.startsWith('Você já tem')).forEach(r => alertas.push({ nivel: 'medio', txt: r }));

    const dataAlertas = alertas.length;
    if (ev.total > 0 && dias >= 0 && dias <= 14) {
      const pct = Math.round((ev.vendidos / ev.total) * 100);
      if (pct < 30) alertas.push({ nivel: 'alto', txt: `Só ${pct}% dos ingressos vendidos e faltam ${dias} dia${dias === 1 ? '' : 's'}` });
    } else if (ev.total === 0 && dias <= 30) {
      alertas.push({ nivel: 'medio', txt: 'Nenhum ingresso cadastrado ainda' });
    }

    // data alternativa (±21 dias), só se o problema for a data em si
    let alternativa = null;
    if (dataAlertas > 0 || p.score < 8) {
      let melhor = null;
      for (let delta = -21; delta <= 21; delta++) {
        if (delta === 0) continue;
        const d = addDias(inicioDia(ev.ini), delta);
        if (diffDias(d, h) < 3) continue;
        const q = pontuar(d, ev.id);
        if (q.conflito) continue;
        if (!melhor || q.score > melhor.p.score) melhor = { d, p: q };
      }
      if (melhor && melhor.p.score - p.score >= 4) alternativa = melhor;
    }

    const nivel = alertas.some(a => a.nivel === 'alto') ? 'reavaliar'
      : (alertas.length || p.score < 8) ? 'revisar' : 'ok';
    return { ev, dias, p, alertas, alternativa, nivel };
  }

  // ───────── render ─────────
  function eventoStatusClasse(ev) {
    return ev.ini < new Date() ? 'ag-chip--encerrado' : 'ag-chip--ativo';
  }

  function htmlToolbar() {
    return `
      <div class="ag-toolbar">
        <div class="ag-toolbar-left">
          <div class="ag-view-toggle" role="group" aria-label="Modo de visualização">
            <button type="button" class="${state.view === 'mes' ? 'active' : ''}" data-acao="view" data-view="mes">Mês</button>
            <button type="button" class="${state.view === 'lista' ? 'active' : ''}" data-acao="view" data-view="lista">Lista</button>
          </div>
          <label class="ag-check">
            <input type="checkbox" data-acao="toggle-sugestoes" ${state.sugestoes ? 'checked' : ''}>
            Mostrar potencial das datas
          </label>
        </div>
        <button type="button" class="btn-export" data-acao="ics" title="Baixe e importe no Google Agenda, Outlook ou Apple Calendar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar (.ics)
        </button>
      </div>`;
  }

  function htmlCalendario() {
    const h = hoje();
    const primeiro = new Date(state.ano, state.mes, 1);
    const inicio = addDias(primeiro, -primeiro.getDay());
    let celulas = '';
    for (let i = 0; i < 42; i++) {
      const d = addDias(inicio, i), k = chave(d);
      const evs = cache.mapa[k] || [];
      const foraMes = d.getMonth() !== state.mes;
      const passado = d < h;
      const info = infoDia(d);
      const cls = ['ag-dia'];
      if (foraMes) cls.push('ag-dia--fora');
      if (passado) cls.push('ag-dia--passado');
      if (k === chave(h)) cls.push('ag-dia--hoje');
      if (k === state.selecionado) cls.push('ag-dia--sel');
      if (info && info.tipo !== 'data') cls.push('ag-dia--feriado');
      if (evs.length > 1) cls.push('ag-dia--conflito');
      let heat = '';
      if (state.sugestoes && !passado && !foraMes && !evs.length) {
        const r = rotulo(pontuar(d, null));
        if (r.k === 'otima' || r.k === 'boa') { cls.push('ag-dia--heat-' + r.k); heat = r.txt; }
      }
      const chips = evs.slice(0, 2).map(ev =>
        `<span class="ag-chip ${eventoStatusClasse(ev)}" title="${esc(ev.nome)}">${hora(ev.ini)} ${esc(ev.nome)}</span>`).join('');
      const mais = evs.length > 2 ? `<span class="ag-more">+${evs.length - 2}</span>` : '';
      celulas += `
        <button type="button" class="${cls.join(' ')}" data-acao="sel" data-dia="${k}" aria-label="${esc(dataExtensa(d))}${heat ? ', data ' + heat : ''}">
          <span class="ag-num">${d.getDate()}</span>
          ${info ? `<span class="ag-fer" title="${esc(info.nome)}">${esc(info.nome)}</span>` : ''}
          <span class="ag-chips">${chips}${mais}</span>
        </button>`;
    }
    return `
      <div class="ag-cal">
        <div class="ag-cal-head">
          <button type="button" class="ag-nav" data-acao="prev" aria-label="Mês anterior">‹</button>
          <h3>${MESES[state.mes]} ${state.ano}</h3>
          <button type="button" class="ag-nav" data-acao="next" aria-label="Próximo mês">›</button>
          <button type="button" class="ag-hoje" data-acao="hoje">Hoje</button>
        </div>
        <div class="ag-semana">${DIAS_CURTOS.map(x => `<span>${x}</span>`).join('')}</div>
        <div class="ag-grid">${celulas}</div>
        <div class="ag-legenda">
          <span><i class="lg lg--ativo"></i>Seu evento</span>
          <span><i class="lg lg--encerrado"></i>Encerrado</span>
          <span><i class="lg lg--feriado"></i>Feriado</span>
          <span><i class="lg lg--boa"></i>Boa data livre</span>
          <span><i class="lg lg--conflito"></i>2+ eventos no dia</span>
        </div>
      </div>`;
  }

  function htmlLista() {
    const h = hoje();
    const futuros = cache.evs.filter(e => diffDias(e.ini, h) >= 0);
    if (!futuros.length) {
      return `<div class="ag-cal"><p class="ag-vazio">Você não tem eventos futuros. Veja ao lado as melhores datas para marcar o próximo.</p></div>`;
    }
    let mesAtual = '', html = '';
    futuros.forEach(ev => {
      const rotMes = `${MESES[ev.ini.getMonth()]} ${ev.ini.getFullYear()}`;
      if (rotMes !== mesAtual) { mesAtual = rotMes; html += `<p class="ag-lista-mes">${rotMes}</p>`; }
      const dias = diffDias(ev.ini, h);
      const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
      const pct = ev.total > 0 ? Math.min(100, Math.round((ev.vendidos / ev.total) * 100)) : 0;
      html += `
        <div class="ag-lista-item" data-acao="ir" data-dia="${chave(ev.ini)}">
          <div class="up-date"><span>${ev.ini.getDate()}</span><small>${MESES_CURTOS[ev.ini.getMonth()]}</small></div>
          <div class="up-info">
            <span>${esc(ev.nome)}</span>
            <small>${DIAS_CURTOS[ev.ini.getDay()]} · ${hora(ev.ini)}${ev.local ? ' · ' + esc(ev.local) : ''}</small>
          </div>
          <div class="up-occ">
            <div class="occ-bar"><div style="width:${pct}%; background:${pct >= 75 ? '#FFB627' : '#35D399'}"></div></div>
            <small>${ev.total > 0 ? pct + '% vendido' : 'sem ingressos'}</small>
          </div>
          <span class="ag-quando">${quando}</span>
        </div>`;
    });
    return `<div class="ag-cal ag-lista">${html}</div>`;
  }

  function htmlDetalheDia() {
    const d = parseChave(state.selecionado), k = state.selecionado;
    const h = hoje(), futuroOuHoje = d >= h;
    const evs = cache.mapa[k] || [];
    const info = infoDia(d);

    let blocoEventos = '';
    if (evs.length) {
      blocoEventos = evs.map(ev => {
        const pct = ev.total > 0 ? Math.min(100, Math.round((ev.vendidos / ev.total) * 100)) : 0;
        return `
          <div class="ag-ev">
            <div class="ag-ev-top"><strong>${esc(ev.nome)}</strong><span class="ev-chip ${ev.ini < new Date() ? 'ev-chip--sched' : 'ev-chip--on'}">${ev.ini < new Date() ? 'encerrado' : 'ativo'}</span></div>
            <small>${hora(ev.ini)}${ev.fim ? ' – ' + hora(ev.fim) : ''}${ev.local ? ' · ' + esc(ev.local) : ''}</small>
            <div class="ev-bar" style="margin-top:8px"><div class="ev-fill" style="width:${pct}%"></div></div>
            <small class="ag-ev-sub">${ev.vendidos} / ${ev.total} ingressos</small>
            <div class="ag-ev-actions">
              <button type="button" class="ev-btn ev-btn--purple" data-acao="editar" data-id="${esc(ev.id)}">Editar / mudar data</button>
              <button type="button" class="ev-btn ev-btn--orange" data-acao="ingressos" data-id="${esc(ev.id)}">Ingressos</button>
              <button type="button" class="ev-btn ev-btn--gray" data-acao="relatorio" data-id="${esc(ev.id)}">Relatório</button>
            </div>
          </div>`;
      }).join('');
    } else {
      blocoEventos = `<p class="ag-muted">Nenhum evento seu neste dia.</p>`;
    }

    let potencial = '';
    if (futuroOuHoje) {
      const p = evs.length === 1 ? pontuar(d, evs[0].id) : pontuar(d, null);
      const r = rotulo(p);
      const lista = [...p.bons.map(t => `<li class="ok">${esc(t)}</li>`), ...p.ruins.map(t => `<li class="ruim">${esc(t)}</li>`)].join('');
      potencial = `
        <div class="ag-pot">
          <div class="ag-pot-head"><span>${evs.length ? 'Como está esta data' : 'Potencial desta data'}</span><span class="ag-tag ag-tag--${r.k}">${r.txt}</span></div>
          <ul>${lista}</ul>
        </div>`;
    }

    const criar = (futuroOuHoje && !evs.length)
      ? `<button type="button" class="btn-quick ag-criar" data-acao="criar" data-dia="${k}">Criar evento nesta data</button>` : '';

    return `
      <div class="panel ag-panel">
        <div class="panel-header"><div><h3>${esc(dataExtensa(d))}</h3><p>${info ? esc(info.nome) + (info.tipo === 'data' ? ' (data comemorativa)' : ' (feriado)') : d.getFullYear()}</p></div></div>
        ${blocoEventos}
        ${potencial}
        ${criar}
      </div>`;
  }

  function htmlMelhoresDatas() {
    const sug = melhoresDatas(state.antecedencia, 6);
    const itens = sug.length ? sug.map(s => {
      const r = rotulo(s);
      const motivo = (s.bons[0] || 'Sem conflitos com seus eventos');
      return `
        <button type="button" class="ag-sug" data-acao="ir" data-dia="${chave(s.d)}">
          <span class="ag-sug-data"><b>${s.d.getDate()}</b><small>${MESES_CURTOS[s.d.getMonth()]}</small></span>
          <span class="ag-sug-info"><strong>${DIAS_LONGOS[s.d.getDay()]}</strong><small>${esc(motivo)}</small></span>
          <span class="ag-tag ag-tag--${r.k}">${r.txt}</span>
        </button>`;
    }).join('') : `<p class="ag-muted">Nenhuma data livre encontrada nesse período.</p>`;
    return `
      <div class="panel ag-panel">
        <div class="panel-header"><div><h3>Melhores datas para marcar</h3><p>Próximos 90 dias, sem conflito com seus eventos</p></div></div>
        <label class="ag-select">Antecedência mínima
          <select data-acao="antecedencia">
            ${[7, 14, 30, 60].map(n => `<option value="${n}" ${state.antecedencia === n ? 'selected' : ''}>${n} dias</option>`).join('')}
          </select>
        </label>
        <div class="ag-sug-list">${itens}</div>
        <p class="ag-nota">Pontuação baseada em dia da semana, feriados, datas comerciais, início do mês e proximidade dos seus outros eventos. É uma estimativa, não dado de mercado.</p>
      </div>`;
  }

  function htmlRevisao() {
    const h = hoje();
    const futuros = cache.evs.filter(e => diffDias(e.ini, h) >= 0).slice(0, 8);
    if (!futuros.length) {
      return `
        <div class="panel ag-panel">
          <div class="panel-header"><div><h3>Revisar datas</h3><p>Seus eventos futuros aparecem aqui</p></div></div>
          <p class="ag-muted">Quando você criar eventos, vou avaliar cada data e avisar se vale a pena reconsiderar.</p>
        </div>`;
    }
    const confirmadas = lerConfirmadas();
    const analises = futuros.map(revisar);
    const pendentes = analises.filter(a => a.nivel !== 'ok' && !confirmadas.has(chaveConfirmacao(a.ev))).length;

    const itens = analises.map(a => {
      const ev = a.ev, conf = confirmadas.has(chaveConfirmacao(ev));
      const nivel = conf && a.nivel !== 'ok' ? 'mantida' : a.nivel;
      const tag = { ok: ['Data boa', 'boa'], revisar: ['Vale revisar', 'regular'], reavaliar: ['Reavaliar', 'conflito'], mantida: ['Mantida por você', 'otima'] }[nivel];
      const alertasHtml = (a.alertas.length ? a.alertas : [])
        .map(x => `<li class="${x.nivel === 'alto' ? 'ruim' : 'aviso'}">${esc(x.txt)}</li>`).join('');
      const bonsHtml = (!a.alertas.length ? a.p.bons.slice(0, 2).map(t => `<li class="ok">${esc(t)}</li>`).join('') : '');
      const alt = (a.alternativa && !conf) ? `
        <div class="ag-alt">
          Sugestão: <strong>${dataCurta(a.alternativa.d)}</strong>
          <span class="ag-tag ag-tag--${rotulo(a.alternativa.p).k}">${rotulo(a.alternativa.p).txt}</span>
          <button type="button" class="link-btn" data-acao="ir" data-dia="${chave(a.alternativa.d)}">ver no calendário →</button>
        </div>` : '';
      const aviso = (ev.vendidos > 0 && a.nivel !== 'ok' && !conf)
        ? `<p class="ag-nota">Já há ${ev.vendidos} ingresso${ev.vendidos === 1 ? '' : 's'} vendido${ev.vendidos === 1 ? '' : 's'}: se mudar a data, avise os compradores.</p>` : '';
      const acoes = a.nivel === 'ok' ? '' : (conf
        ? `<button type="button" class="link-btn" data-acao="desfazer" data-id="${esc(ev.id)}">Revisar de novo</button>`
        : `<button type="button" class="ev-btn ev-btn--purple" data-acao="editar" data-id="${esc(ev.id)}">Mudar data</button>
           <button type="button" class="ev-btn" data-acao="manter" data-id="${esc(ev.id)}">Manter data</button>`);
      return `
        <div class="ag-rev">
          <div class="ag-rev-top">
            <button type="button" class="ag-rev-nome" data-acao="ir" data-dia="${chave(ev.ini)}">
              <strong>${esc(ev.nome)}</strong><small>${dataCurta(ev.ini)} · ${hora(ev.ini)} · em ${a.dias} dia${a.dias === 1 ? '' : 's'}</small>
            </button>
            <span class="ag-tag ag-tag--${tag[1]}">${tag[0]}</span>
          </div>
          <ul>${alertasHtml}${bonsHtml}</ul>
          ${alt}${aviso}
          ${acoes ? `<div class="ag-ev-actions">${acoes}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="panel ag-panel">
        <div class="panel-header"><div><h3>Revisar datas</h3>
          <p>${pendentes ? `${pendentes} evento${pendentes === 1 ? '' : 's'} pede${pendentes === 1 ? '' : 'm'} atenção` : 'Nenhum alerta nas suas datas'}</p></div></div>
        ${itens}
      </div>`;
  }

  function render() {
    const root = document.getElementById('agendaRoot');
    if (!root) return;
    cache.evs = lerEventos();
    cache.mapa = mapaPorDia(cache.evs);
    root.innerHTML = `
      ${htmlToolbar()}
      <div class="ag-layout">
        <div class="ag-main">${state.view === 'mes' ? htmlCalendario() : htmlLista()}</div>
        <aside class="ag-side">
          ${htmlDetalheDia()}
          ${htmlMelhoresDatas()}
          ${htmlRevisao()}
        </aside>
      </div>`;
  }

  // ───────── exportação .ics ─────────
  function exportarICS() {
    if (!cache.evs.length) {
      if (typeof showToast === 'function') showToast('Você ainda não tem eventos para exportar.', 'warn');
      return;
    }
    const fmt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const escI = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roles//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Agenda Rolês'];
    cache.evs.forEach(ev => {
      const fim = ev.fim || new Date(ev.ini.getTime() + 3 * 3600e3);
      linhas.push('BEGIN:VEVENT', `UID:roles-evento-${ev.id}@roles`, `DTSTAMP:${stamp}`,
        `DTSTART:${fmt(ev.ini)}`, `DTEND:${fmt(fim)}`, `SUMMARY:${escI(ev.nome)}`,
        `LOCATION:${escI(ev.local)}`,
        `DESCRIPTION:${escI(`${ev.vendidos} de ${ev.total} ingressos vendidos`)}`, 'END:VEVENT');
    });
    linhas.push('END:VCALENDAR');
    const blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roles_agenda.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof showToast === 'function') showToast('Agenda exportada! Importe o arquivo no seu calendário.', 'success');
  }

  // ───────── navegação / ações ─────────
  function irParaDia(k) {
    const d = parseChave(k);
    state.selecionado = k; state.ano = d.getFullYear(); state.mes = d.getMonth();
    state.view = 'mes';
    render();
  }

  function onClick(e) {
    const el = e.target.closest('[data-acao]');
    if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
    const acao = el.dataset.acao;
    switch (acao) {
      case 'sel': state.selecionado = el.dataset.dia; { const d = parseChave(el.dataset.dia); if (d.getMonth() !== state.mes) { state.mes = d.getMonth(); state.ano = d.getFullYear(); } } render(); break;
      case 'ir': irParaDia(el.dataset.dia); break;
      case 'prev': state.mes--; if (state.mes < 0) { state.mes = 11; state.ano--; } render(); break;
      case 'next': state.mes++; if (state.mes > 11) { state.mes = 0; state.ano++; } render(); break;
      case 'hoje': irParaDia(chave(hoje())); break;
      case 'view': state.view = el.dataset.view; render(); break;
      case 'ics': exportarICS(); break;
      case 'editar': if (typeof openEditModal === 'function') openEditModal('evento', el.dataset.id); break;
      case 'ingressos': if (typeof openTicketModal === 'function') openTicketModal(el.dataset.id); break;
      case 'relatorio': if (typeof openRelatorioEvento === 'function') openRelatorioEvento(el.dataset.id); break;
      case 'criar': window.location.href = '/frontend/criareventos/criareventos.html?data=' + el.dataset.dia; break;
      case 'manter': {
        const ev = cache.evs.find(x => String(x.id) === String(el.dataset.id));
        if (ev) { const s = lerConfirmadas(); s.add(chaveConfirmacao(ev)); salvarConfirmadas(s); render(); }
        break;
      }
      case 'desfazer': {
        const ev = cache.evs.find(x => String(x.id) === String(el.dataset.id));
        if (ev) { const s = lerConfirmadas(); s.delete(chaveConfirmacao(ev)); salvarConfirmadas(s); render(); }
        break;
      }
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.dataset.acao === 'toggle-sugestoes') { state.sugestoes = el.checked; render(); }
    if (el.dataset.acao === 'antecedencia') { state.antecedencia = Number(el.value) || 14; render(); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sec = document.getElementById('agenda');
    if (!sec) return;
    sec.addEventListener('click', onClick);
    sec.addEventListener('change', onChange);
  });

  window.renderAgenda = render;
  window.__agendaTeste = { pontuar, rotulo, feriadosDoAno, pascoa, melhoresDatas, revisar, setCache: (evs) => { cache.evs = evs; cache.mapa = mapaPorDia(evs); }, chave };
})();