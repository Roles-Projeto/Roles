const express = require("express");
const multer  = require("multer");

const router = express.Router();

const candidaturasController = require("../controllers/candidaturasController");


/*
 * Arquivo fica em memória (buffer) e é gravado no PostgreSQL.
 * Limite de 5 MB e apenas 1 arquivo.
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 10
    }
});


/*
 * Envolve o multer para devolver erros em JSON no mesmo formato
 * do resto da API ({ erro: "..." }), em vez de cair no erro 500 genérico.
 */
function receberCurriculo(req, res, next) {
    upload.single("curriculo")(req, res, (err) => {

        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError) {

            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    erro: "O currículo deve ter no máximo 5 MB."
                });
            }

            return res.status(400).json({
                erro: "Não foi possível processar o arquivo enviado."
            });
        }

        return next(err);
    });
}


/*
 * POST /candidaturas
 * multipart/form-data:
 *   nome, whatsapp, vaga, email?, cidade_estado?, curriculo?
 */
router.post(
    "/",
    receberCurriculo,
    candidaturasController.criarCandidatura
);


module.exports = router;