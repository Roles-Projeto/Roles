const express = require("express");
const router = express.Router();
const eventosController = require("../controllers/eventosController");
const { verificarToken } = require("../middleware/auth");

// Upload de imagem — exige login (achado do teste de segurança de
// outubro/2026: sem isso, qualquer pessoa, sem conta, conseguia enviar
// arquivos pro servidor). O multer roda dentro de um wrapper pra que um
// arquivo recusado (tipo errado ou maior que 5 MB, ver eventosController.js)
// vire uma resposta JSON normal, em vez de um erro 500 sem tratamento.
router.post("/upload-imagem", verificarToken, (req, res, next) => {
    eventosController.upload.single("imagem")(req, res, (err) => {
        if (err) {
            const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({ erro: err.message || "Erro ao processar o arquivo enviado." });
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: "Nenhuma imagem enviada" });

    // Modo local: multer já salvou o arquivo em disco, só devolve o caminho relativo.
    if (!eventosController.usarSupabase) {
        return res.json({ url: `/uploads/${req.file.filename}` });
    }

    // Modo Supabase: o arquivo está em memória (req.file.buffer), sobe pro Storage.
    try {
        const url = await eventosController.uploadParaSupabase(req.file);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao enviar imagem para o Supabase Storage.", detalhes: err.message });
    }
});

// Leitura — pública, não precisa de token
router.get("/",       eventosController.listarEventos);
router.get("/:id",    eventosController.buscarEvento);

// Escrita — exige login (o controller usa req.usuario.id)
router.post("/",      verificarToken, eventosController.criarEvento);
router.put("/:id",    verificarToken, eventosController.editarEvento);
router.delete("/:id", verificarToken, eventosController.excluirEvento);

module.exports = router;