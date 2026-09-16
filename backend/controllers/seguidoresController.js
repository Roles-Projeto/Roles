"use strict";
// controllers/seguidoresController.js

const connection = require("../db/db_config");

/* ════════════════════════════════════════
   CONTAR SEGUIDORES DE UM ORGANIZADOR
   GET /seguidores/count/:organizador_id
   (rota pública — qualquer um pode ver a contagem)
════════════════════════════════════════ */
async function contarSeguidores(req, res) {
  const { organizador_id } = req.params;
  try {
    const results = await connection.query(
      "SELECT COUNT(*)::int AS total FROM seguidores WHERE organizador_id = ?",
      [organizador_id]
    );
    const total = results[0]?.total ?? 0;
    res.json({ total });
  } catch (err) {
    console.error("❌ ERRO contarSeguidores:", err.message);
    res.status(500).json({ erro: "Erro ao contar seguidores.", detalhes: err.message });
  }
}

/* ════════════════════════════════════════
   VERIFICAR SE O USUÁRIO LOGADO JÁ SEGUE
   GET /seguidores/verificar/:organizador_id
   Exige login (req.usuario vem do middleware verificarToken)
════════════════════════════════════════ */
async function verificarSeSegue(req, res) {
  const seguidorId = req.usuario?.id;
  const { organizador_id } = req.params;

  if (!seguidorId) return res.status(401).json({ erro: "Não autenticado." });

  try {
    const results = await connection.query(
      "SELECT id FROM seguidores WHERE seguidor_id = ? AND organizador_id = ?",
      [seguidorId, organizador_id]
    );
    res.json({ segue: results.length > 0 });
  } catch (err) {
    console.error("❌ ERRO verificarSeSegue:", err.message);
    res.status(500).json({ erro: "Erro ao verificar status de seguidor.", detalhes: err.message });
  }
}

/* ════════════════════════════════════════
   SEGUIR UM ORGANIZADOR
   POST /seguidores   Body: { organizador_id }
   Exige login
════════════════════════════════════════ */
async function seguir(req, res) {
  const seguidorId = req.usuario?.id;
  const { organizador_id } = req.body;

  if (!seguidorId) return res.status(401).json({ erro: "Não autenticado." });
  if (!organizador_id) return res.status(400).json({ erro: "organizador_id é obrigatório." });

  if (String(seguidorId) === String(organizador_id)) {
    return res.status(400).json({ erro: "Você não pode seguir o seu próprio perfil." });
  }

  try {
    await connection.query(
      "INSERT INTO seguidores (seguidor_id, organizador_id) VALUES (?, ?)",
      [seguidorId, organizador_id]
    );
    res.status(201).json({ mensagem: "Agora você está seguindo este organizador." });
  } catch (err) {
    // 23505 = unique_violation no Postgres — já segue, trata como sucesso (idempotente).
    // Só funciona de verdade se houver uma constraint UNIQUE(seguidor_id, organizador_id)
    // na tabela — ver nota no arquivo de migração sugerida.
    if (err.code === "23505") {
      return res.json({ mensagem: "Você já segue este organizador." });
    }
    console.error("❌ ERRO seguir:", err.message);
    res.status(500).json({ erro: "Erro ao seguir organizador.", detalhes: err.message });
  }
}

/* ════════════════════════════════════════
   DEIXAR DE SEGUIR
   DELETE /seguidores/:organizador_id
   Exige login
════════════════════════════════════════ */
async function deixarDeSeguir(req, res) {
  const seguidorId = req.usuario?.id;
  const { organizador_id } = req.params;

  if (!seguidorId) return res.status(401).json({ erro: "Não autenticado." });

  try {
    await connection.query(
      "DELETE FROM seguidores WHERE seguidor_id = ? AND organizador_id = ?",
      [seguidorId, organizador_id]
    );
    res.json({ mensagem: "Você deixou de seguir este organizador." });
  } catch (err) {
    console.error("❌ ERRO deixarDeSeguir:", err.message);
    res.status(500).json({ erro: "Erro ao deixar de seguir.", detalhes: err.message });
  }
}

module.exports = {
  contarSeguidores,
  verificarSeSegue,
  seguir,
  deixarDeSeguir,
};