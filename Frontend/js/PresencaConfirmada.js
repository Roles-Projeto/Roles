(function () {
    const raw   = localStorage.getItem('eventoSelecionado');
    const dados = raw ? JSON.parse(raw) : null;

    /* ── UTILITÁRIO ──────────────────────────────────── */
    function set(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '—';
    }

    /* ── PREENCHER DADOS DO EVENTO ───────────────────── */
    // Campos disponíveis no localStorage (salvos em DetalhesEventos.js):
    // nome, data, hora, local, imagem, ingressoNome, ingressoPreco, evento_id, tipo_ingresso_id
    if (dados) {
        set('pc-data-txt',  dados.data);
        set('pc-hora-txt',  dados.hora);
        set('pc-local-txt', dados.local);
        set('pc-nome-txt',  dados.nome); // nome do evento (não há campo participante/usuario)
    } else {
        set('pc-data-txt',  '–');
        set('pc-hora-txt',  '–');
        set('pc-local-txt', '–');
        set('pc-nome-txt',  '–');
    }

    /* ── GOOGLE MAPS ─────────────────────────────────── */
    function inicializarMaps() {
        if (!dados || !dados.local) return;

        const query  = encodeURIComponent(dados.local);
        const url    = `https://www.google.com/maps/search/?api=1&query=${query}`;
        const linkEl = document.getElementById('pc-maps-link');
        const cardEl = document.getElementById('tip-maps');

        if (linkEl) linkEl.href = url;
        if (cardEl) cardEl.onclick = () => window.open(url, '_blank');
    }

    inicializarMaps();

    /* ── CLIMA — Open-Meteo (gratuito, sem chave) ────── */
    async function carregarClima() {
        const tipText = document.getElementById('pc-weather-text');
        const tipLink = document.getElementById('pc-clima-link');
        const cardEl  = document.getElementById('tip-clima');

        if (!tipText) return;

        // Extrair cidade do campo local (ex: "Arena SP, São Paulo" → "São Paulo")
        // Tenta pegar a última parte após vírgula, senão usa o local inteiro
        const localRaw  = (dados && dados.local) ? dados.local : 'São Paulo';
        const partes    = localRaw.split(',');
        const cidade    = partes[partes.length - 1].trim() || localRaw.trim();

        try {
            // 1. Geocodificar cidade para obter lat/lon
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
            const geoRes = await fetch(geoUrl);
            const geoJson = await geoRes.json();

            if (!geoJson.results || !geoJson.results.length) {
                tipText.textContent = 'Cidade não encontrada';
                return;
            }

            const { latitude, longitude, name } = geoJson.results[0];

            // 2. Buscar clima atual
            const climaUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
            const climaRes = await fetch(climaUrl);
            const climaJson = await climaRes.json();

            if (climaJson.current_weather) {
                const temp    = Math.round(climaJson.current_weather.temperature);
                const codigo  = climaJson.current_weather.weathercode;
                const descricao = interpretarClima(codigo);

                tipText.textContent = `${temp}°C — ${descricao} em ${name}`;

                const mapsLink = `https://www.google.com/search?q=previs%C3%A3o+do+tempo+${encodeURIComponent(name)}`;
                if (tipLink) tipLink.href = mapsLink;
                if (cardEl)  cardEl.onclick = () => window.open(mapsLink, '_blank');
            } else {
                tipText.textContent = 'Clima indisponível';
            }
        } catch {
            tipText.textContent = 'Não foi possível carregar';
        }
    }

    // Converte código WMO (Open-Meteo) em descrição em português
    function interpretarClima(codigo) {
        if (codigo === 0)              return 'Céu limpo';
        if (codigo <= 2)               return 'Parcialmente nublado';
        if (codigo === 3)              return 'Nublado';
        if (codigo <= 49)              return 'Névoa';
        if (codigo <= 59)              return 'Garoa';
        if (codigo <= 69)              return 'Chuva';
        if (codigo <= 79)              return 'Neve';
        if (codigo <= 84)              return 'Pancadas de chuva';
        if (codigo <= 94)              return 'Tempestade';
        return 'Condição severa';
    }

    carregarClima();

    /* ── DRESS CODE — PINTEREST ──────────────────────── */
    const dressLink = document.getElementById('pc-tip-dress-link');
    const tipDress  = document.getElementById('tip-dress');

    if (dressLink) {
        const termo    = dados && dados.nome ? `look para ${dados.nome}` : 'look casual chique evento';
        const query    = encodeURIComponent(termo);
        dressLink.href = `https://www.pinterest.com/search/pins/?q=${query}`;
    }

    if (tipDress && dressLink) {
        tipDress.onclick = () => window.open(dressLink.href, '_blank');
    }

})();