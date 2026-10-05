const express        = require("express");
const router         = express.Router();
const authController = require("../controllers/authController");
const authAdmin      = require("../middleware/authAdmin");

router.post("/login",                authController.loginUsuario);
router.get("/historico-acessos/:id", authController.historicoAcessos);
router.post("/desbloquear", authAdmin, authController.desbloquearConta); // ← NOVO

module.exports = router;