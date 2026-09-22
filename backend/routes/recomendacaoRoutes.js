// backend/routes/recomendacaoRoutes.js
const express = require("express");
const router = express.Router();
const recomendacaoService = require("../services/recomendacaoService");
const notificacaoService = require("../services/notificacaoService");

// GET /recomendacoes/:usuarioId?latitude=..&longitude=..
// Retorna a lista de eventos recomendados pro usuário
router.get("/:usuarioId", async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const { latitude, longitude } = req.query;

        const recomendados = await recomendacaoService.obterRecomendacoes({
            usuarioId: Number(usuarioId),
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            limite: 10,
        });

        res.json(recomendados);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar recomendações.", detalhes: err.message });
    }
});

// POST /recomendacoes/interacoes
// Chame isso toda vez que o usuário CLICAR em um evento ou fizer uma BUSCA
// Body: { usuarioId, eventoId, tipo, categoria, termoBusca }
router.post("/interacoes", async (req, res) => {
    try {
        await recomendacaoService.registrarInteracao(req.body);
        res.status(201).json({ mensagem: "Interação registrada com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao registrar interação.", detalhes: err.message });
    }
});

// POST /recomendacoes/usuarios/:usuarioId/localizacao
// Chame isso quando o app/navegador pegar o GPS do usuário
// Body: { latitude, longitude }
router.post("/usuarios/:usuarioId/localizacao", async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const { latitude, longitude } = req.body;

        await recomendacaoService.atualizarLocalizacaoUsuario({
            usuarioId: Number(usuarioId),
            latitude,
            longitude,
        });

        // já aproveita e verifica na hora se tem evento perto pra notificar
        const notificacoes = await notificacaoService.verificarENotificarUsuario(Number(usuarioId));

        res.json({ mensagem: "Localização atualizada com sucesso!", notificacoes });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar localização.", detalhes: err.message });
    }
});

// ============================================================
// ROTA DE TESTE — só pra facilitar o desenvolvimento.
// Acessa direto pelo navegador, sem precisar de Postman/PowerShell:
//   GET /recomendacoes/testar-notificacao/1
// Ela dispara a verificação de notificação pro usuário informado,
// usando a localização que já estiver salva nele no banco (por isso
// você precisa ter rodado o UPDATE de ultima_latitude/longitude antes,
// seja manualmente no Supabase ou via POST /usuarios/:id/localizacao).
//
// IMPORTANTE: remova essa rota (ou proteja com autenticação de admin)
// antes de ir pra produção — ela não tem nenhuma trava de segurança.
// ============================================================
router.get("/testar-notificacao/:usuarioId", async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const notificacoes = await notificacaoService.verificarENotificarUsuario(Number(usuarioId));
        res.json({
            mensagem: notificacoes.length > 0
                ? `${notificacoes.length} notificação(ões) disparada(s).`
                : "Nenhuma notificação disparada (score abaixo do mínimo, sem localização salva, ou já notificado antes).",
            notificacoes,
        });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao testar notificação.", detalhes: err.message });
    }
});

module.exports = router;