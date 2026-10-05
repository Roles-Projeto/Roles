const express = require("express");

const router = express.Router();

const usuariosController = require("../controllers/usuariosController");
const authController = require("../controllers/authController");
const twoFactorController = require("../controllers/Twofactorcontroller.js");


/*
 * ============================================================
 * AUTENTICAÇÃO / USUÁRIOS
 * ============================================================
 */

router.post(
  "/login",
  authController.loginUsuario
);

router.post(
  "/cadastro",
  usuariosController.cadastrarUsuario
);

router.post(
  "/enviar-codigo",
  usuariosController.enviarCodigo
);

router.post(
  "/verificar-codigo",
  usuariosController.verificarCodigo
);

router.post(
  "/recuperar-senha",
  usuariosController.recuperarSenha
);

router.post(
  "/redefinir-senha",
  usuariosController.redefinirSenha
);

router.get(
  "/historico-acessos/:id",
  authController.historicoAcessos
);

router.get(
  "/",
  usuariosController.listarUsuarios
);

router.put(
  "/perfil",
  usuariosController.atualizarUsuario
);

router.put(
  "/senha",
  usuariosController.alterarSenha
);

router.put(
  "/alerta-dispositivo",
  usuariosController.toggleAlertaDispositivo
);


/*
 * ============================================================
 * 2FA — LOGIN
 * ============================================================
 *
 * Quando o usuário já possui 2FA:
 *
 * email + senha
 *      ↓
 * código enviado por e-mail
 *      ↓
 * /2fa/verificar-login
 *      ↓
 * JWT normal
 */

router.post(
  "/2fa/verificar-login",
  authController.verificarLogin2fa
);


/*
 * ============================================================
 * 2FA — STATUS
 * ============================================================
 *
 * Consulta o status do 2FA de um usuário já autenticado.
 */

router.get(
  "/2fa/status",
  twoFactorController.status
);


/*
 * ============================================================
 * 2FA — CONFIGURAÇÃO INICIAL
 * ============================================================
 *
 * Primeiro acesso sem 2FA:
 *
 * email + senha
 *      ↓
 * backend envia código "setup" por e-mail
 *      ↓
 * usuário digita código
 *      ↓
 * /2fa/ativar-inicial
 *      ↓
 * 2FA ativado
 *      ↓
 * JWT normal
 *
 * NÃO existe mais:
 * - QR Code
 * - segredo TOTP
 * - aplicativo autenticador
 */

router.post(
  "/2fa/ativar-inicial",
  twoFactorController.ativarInicial
);


/*
 * ============================================================
 * 2FA — DESATIVAÇÃO
 * ============================================================
 *
 * O 2FA é obrigatório.
 *
 * O próprio controller retorna HTTP 403.
 */

router.post(
  "/2fa/desativar",
  twoFactorController.desativar
);


/*
 * ============================================================
 * ROTAS ANTIGAS DE TOTP
 * ============================================================
 *
 * REMOVIDAS:
 *
 * /2fa/configurar
 * /2fa/ativar
 * /2fa/configurar-inicial
 *
 * O sistema não usa mais QR Code/TOTP.
 */


/*
 * ============================================================
 * ROTAS COM :id
 * ============================================================
 *
 * Devem ficar depois das rotas específicas acima.
 */

router.get(
  "/:id/perfil",
  usuariosController.buscarPerfilOrganizador
);

router.post(
  "/:id/seguir",
  usuariosController.seguirOrganizador
);

router.get(
  "/:id/seguindo",
  usuariosController.verificarSeguindo
);

router.get(
  "/:id",
  usuariosController.buscarUsuarioPorId
);


console.log(
  "📡 ROTAS DE USUÁRIOS CARREGADAS"
);

module.exports = router;