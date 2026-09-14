"use strict";

/**
 * routes/favoritos.js — Rolês
 *
 * GET    /favoritos/usuario/:id  → lista favoritos do usuário
 * POST   /favoritos              → adiciona favorito
 * DELETE /favoritos/:eventoId    → remove favorito (body: { usuarioId })
 */

const express = require("express");
const router  = express.Router();
const db      = require("../db/db_config");

/* ─── Garante que a tabela existe ─── */
async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS favoritos (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            usuario_id  INT         NOT NULL,
            evento_id   VARCHAR(64) NOT NULL,
            titulo      VARCHAR(255),
            categoria   VARCHAR(100),
            data        VARCHAR(100),
            local       VARCHAR(255),
            preco       VARCHAR(50),
            imagem      TEXT,
            url         TEXT,
            criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_usuario_evento (usuario_id, evento_id)
        )
    `).catch(() => {});
}
ensureTable();

/* ─── GET /favoritos/usuario/:id ─── */
router.get("/usuario/:id", async (req, res) => {
    try {
        const rows = await db.query(
            "SELECT * FROM favoritos WHERE usuario_id = ? ORDER BY criado_em DESC",
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao listar favoritos.", detalhes: err.message });
    }
});

/* ─── POST /favoritos ─── */
router.post("/", async (req, res) => {
    const { usuarioId, eventoId, titulo, categoria, data, local, preco, imagem, url } = req.body;
    if (!usuarioId || !eventoId)
        return res.status(400).json({ erro: "usuarioId e eventoId são obrigatórios." });
    try {
        await db.query(
            `INSERT INTO favoritos (usuario_id, evento_id, titulo, categoria, data, local, preco, imagem, url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE titulo = VALUES(titulo)`,
            [usuarioId, eventoId, titulo || null, categoria || null,
             data || null, local || null, preco || null, imagem || null, url || null]
        );
        res.status(201).json({ mensagem: "Favorito salvo." });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao salvar favorito.", detalhes: err.message });
    }
});

/* ─── DELETE /favoritos/:eventoId ─── */
router.delete("/:eventoId", async (req, res) => {
    const { usuarioId } = req.body;
    if (!usuarioId)
        return res.status(400).json({ erro: "usuarioId obrigatório no body." });
    try {
        await db.query(
            "DELETE FROM favoritos WHERE usuario_id = ? AND evento_id = ?",
            [usuarioId, req.params.eventoId]
        );
        res.json({ mensagem: "Favorito removido." });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao remover favorito.", detalhes: err.message });
    }
});

console.log("📡 ROTAS DE FAVORITOS CARREGADAS");
module.exports = router;