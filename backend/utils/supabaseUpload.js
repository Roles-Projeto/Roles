// backend/utils/supabaseUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../db/supabaseClient');

// ── Alternância de armazenamento de imagem ──
// USE_SUPABASE_STORAGE=true  -> memoryStorage + Supabase Storage (produção/teste real)
// USE_SUPABASE_STORAGE=false -> diskStorage local em /uploads (só serve pra dev local)
const USAR_SUPABASE = process.env.USE_SUPABASE_STORAGE === 'true';

function criarStorage(pastaLocal) {
    return USAR_SUPABASE
        ? multer.memoryStorage()
        : multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, '..', pastaLocal);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                cb(null, Date.now() + path.extname(file.originalname));
            }
        });
}

// Só aceita os tipos de imagem usados no site. Qualquer outro tipo
// (.html, .txt, .exe, etc.) é recusado antes de o arquivo ser salvo —
// achado do teste de segurança de outubro/2026 (upload sem validação
// permitia subir um .html com <script> e executá-lo no servidor).
const TIPOS_IMAGEM_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function filtrarImagem(req, file, cb) {
    if (TIPOS_IMAGEM_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Envie uma imagem (jpg, png, webp ou gif).'));
}

// Pronto pra usar nas rotas: já vem com o filtro de tipo e o limite de
// tamanho (5 MB) configurados, além do armazenamento (local ou Supabase).
function criarUpload(pastaLocal) {
    return multer({
        storage: criarStorage(pastaLocal),
        fileFilter: filtrarImagem,
        limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
    });
}

// Faz upload do buffer recebido do multer pro Supabase Storage
// e devolve a URL pública do arquivo. Só é chamada quando USAR_SUPABASE = true.
async function uploadParaSupabase(file, bucketName) {
    if (!supabase) throw new Error("Client do Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no .env).");

    const nomeArquivo = `${Date.now()}${path.extname(file.originalname)}`;

    const { error } = await supabase.storage
        .from(bucketName)
        .upload(nomeArquivo, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(nomeArquivo);

    return data.publicUrl;
}

module.exports = {
    usarSupabase: USAR_SUPABASE,
    criarStorage,
    criarUpload,
    uploadParaSupabase,
};