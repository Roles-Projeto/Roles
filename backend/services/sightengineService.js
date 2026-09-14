const axios = require('axios');
const FormData = require('form-data');

const CHECK_URL = 'https://api.sightengine.com/1.0/check.json';
const TEXT_CHECK_URL = 'https://api.sightengine.com/1.0/text/check.json';

// Modelos de imagem: nudez/sexual, violência gráfica/sangue, armas e
// conteúdo ofensivo/extremista.
const IMAGEM_MODELS = 'nudity-2.1,gore-2.0,weapon,offensive';

// Categorias de texto. Deixamos 'personal' e 'link' de fora de propósito
// -- descrição de evento legitimamente pode ter telefone/link de ingresso.
const TEXTO_CATEGORIAS = 'profanity,weapon,drug,extremism,violence,self-harm';

function checarCredenciais() {
    if (!process.env.SIGHTENGINE_API_USER || !process.env.SIGHTENGINE_API_SECRET) {
        throw new Error(
            'Credenciais da Sightengine não configuradas (SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET ausentes no .env).'
        );
    }
}

function checarStatusFalha(data, origem) {
    if (data.status === 'failure') {
        throw new Error(`${origem} retornou erro: ${data.error?.message || 'motivo desconhecido'}`);
    }
}

// ─── Moderação de imagem via upload do arquivo (buffer do multer) ─────────
async function analisarImagem(file) {
    if (!file || !file.buffer) {
        throw new Error('Imagem não recebida para análise.');
    }
    checarCredenciais();

    const form = new FormData();
    form.append('media', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
    });
    form.append('models', IMAGEM_MODELS);
    form.append('api_user', process.env.SIGHTENGINE_API_USER);
    form.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

    let response;
    try {
        response = await axios.post(CHECK_URL, form, {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 15000
        });
    } catch (error) {
        const detalhe = error.response?.data || error.message;
        throw new Error(`Falha ao consultar a Sightengine: ${JSON.stringify(detalhe)}`);
    }

    checarStatusFalha(response.data, 'Sightengine (imagem)');
    return response.data;
}

// ─── Moderação de imagem já hospedada (usa a URL pública do Supabase) ─────
async function analisarImagemPorUrl(url) {
    if (!url) {
        throw new Error('URL da imagem não informada.');
    }
    checarCredenciais();

    let response;
    try {
        response = await axios.get(CHECK_URL, {
            params: {
                url,
                models: IMAGEM_MODELS,
                api_user: process.env.SIGHTENGINE_API_USER,
                api_secret: process.env.SIGHTENGINE_API_SECRET
            },
            timeout: 15000
        });
    } catch (error) {
        const detalhe = error.response?.data || error.message;
        throw new Error(`Falha ao consultar a Sightengine: ${JSON.stringify(detalhe)}`);
    }

    checarStatusFalha(response.data, 'Sightengine (imagem por URL)');
    return response.data;
}

// ─── Moderação de texto (nome + descrição do evento) ──────────────────────
async function analisarTexto(texto) {
    if (!texto || !texto.trim()) {
        return null; // nada pra analisar
    }
    checarCredenciais();

    let response;
    try {
        response = await axios.post(
            TEXT_CHECK_URL,
            new URLSearchParams({
                text: texto,
                lang: 'pt',
                mode: 'rules',
                categories: TEXTO_CATEGORIAS,
                api_user: process.env.SIGHTENGINE_API_USER,
                api_secret: process.env.SIGHTENGINE_API_SECRET
            }),
            { timeout: 15000 }
        );
    } catch (error) {
        const detalhe = error.response?.data || error.message;
        throw new Error(`Falha ao consultar a Sightengine (texto): ${JSON.stringify(detalhe)}`);
    }

    checarStatusFalha(response.data, 'Sightengine (texto)');
    return response.data;
}

module.exports = {
    analisarImagem,
    analisarImagemPorUrl,
    analisarTexto
};