"use strict";

/**
 * routes/visitas.js — Rolês
 *
 * GET  /visitas/usuario/:id  → lista visitas do usuário
 * POST /visitas              → registra visita
 */

const express = require("express");
const router  = express.Router();
const db      = require("../db/db_config");

/* ─── Garante que a tabela existe ─── */
async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS visitas (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            usuario_id  INT         NOT NULL,
            nome        VARCHAR(255),
            nome_local  VARCHAR(255),
            data_visita DATE,
            nota        TINYINT DEFAULT 0,
            criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
}
ensureTable();

/* ─── GET /visitas/usuario/:id ─── */
router.get("/usuario/:id", async (req, res) => {
    try {
        const rows = await db.query(
            "SELECT * FROM visitas WHERE usuario_id = ? ORDER BY data_visita DESC LIMIT 50",
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao listar visitas.", detalhes: err.message });
    }
});

/* ─── POST /visitas ─── */
router.post("/", async (req, res) => {
    const { usuarioId, nome, nome_local, data_visita, nota } = req.body;
    if (!usuarioId)
        return res.status(400).json({ erro: "usuarioId obrigatório." });
    try {
        // Apaga visitas com mais de 7 dias
        await db.query(
            "DELETE FROM visitas WHERE usuario_id = ? AND data_visita < DATE_SUB(NOW(), INTERVAL 7 DAY)",
            [usuarioId]
        ).catch(() => {});

        await db.query(
            `INSERT INTO visitas (usuario_id, nome, nome_local, data_visita, nota)
             VALUES (?, ?, ?, ?, ?)`,
            [usuarioId, nome || null, nome_local || null, data_visita || null, nota || 0]
        );
        res.status(201).json({ mensagem: "Visita registrada." });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao registrar visita.", detalhes: err.message });
    }
});

console.log("📡 ROTAS DE VISITAS CARREGADAS");
module.exports = router;