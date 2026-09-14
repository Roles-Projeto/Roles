const express = require("express");
const router  = express.Router();
const usuariosController = require("../controllers/usuariosController");
const authController = require("../controllers/authController");

router.post("/login",             authController.loginUsuario);
router.post("/cadastro",          usuariosController.cadastrarUsuario);
router.post("/enviar-codigo",     usuariosController.enviarCodigo);
router.post("/verificar-codigo",  usuariosController.verificarCodigo);
router.post("/recuperar-senha",   usuariosController.recuperarSenha);
router.post("/redefinir-senha",   usuariosController.redefinirSenha);
router.get("/historico-acessos/:id", authController.historicoAcessos);
router.get("/",                   usuariosController.listarUsuarios);
router.put("/perfil",             usuariosController.atualizarUsuario);
router.put("/senha",              usuariosController.alterarSenha); 
router.put("/alerta-dispositivo", usuariosController.toggleAlertaDispositivo); 
router.get("/:id",                usuariosController.buscarUsuarioPorId);

console.log("📡 ROTAS DE USUÁRIOS CARREGADAS");
module.exports = router;