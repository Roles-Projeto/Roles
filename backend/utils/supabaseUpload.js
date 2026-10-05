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
    uploadParaSupabase,
};