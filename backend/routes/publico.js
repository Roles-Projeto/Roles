// backend/routes/publico.js
// Rotas públicas (sem token) da landing page do empresário.
//
// Registre no arquivo principal do servidor, junto das outras rotas:
//   app.use("/publico", require("./routes/publico"));
const express = require("express");
const router = express.Router();
const publicoController = require("../controllers/publicoController");

router.get("/estatisticas", publicoController.estatisticas);
router.get("/depoimentos", publicoController.depoimentos);

module.exports = router;