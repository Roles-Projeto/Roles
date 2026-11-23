"use strict";
// backend/routes/adminArquivo.js
// Arquivar e restaurar registros (nada é apagado do banco) + listagem do "Arquivo" (só Master).
//
// IMPORTANTE: monte este router DEPOIS do adminAcesso (ele usa req._eu) e DEPOIS do
// middleware `autorizar`, que cuida de permissões, proteção de contas e auditoria.

const express = require("express");
const connection = require("../db/db_config");

const router = express.Router();
const q = (sql, p = []) => connection.query(sql, p);
const h = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) => {
        console.error("adminArquivo:", e.message);
        res.status(500).json({ erro: "Erro interno." });
    });

// módulo na URL -> tabela real, coluna usada como título e rótulo exibido
// (os nomes das tabelas e colunas abaixo são fixos no código: nunca vêm do usuário)
const ITENS = {
    usuarios: { tabela: "usuarios", titulo: "nome_completo", rotulo: "Usuário" },
    estabelecimentos: { tabela: "estabelecimentos", titulo: "nome", rotulo: "Local" },
    eventos: { tabela: "eventos", titulo: "nome", rotulo: "Evento" },
    avaliacoes: { tabela: "avaliacoes", titulo: "comentario", rotulo: "Avaliação" },
    ingressos: { tabela: "ingressos", titulo: "titulo", rotulo: "Ingresso" },
    mensagens: { tabela: "contatos", titulo: "assunto", rotulo: "Mensagem" },
};

const soMaster = (req) => req._eu && req._eu.role === "master";

// Nota e contagem de avaliações do local passam a ignorar avaliações arquivadas
async function recalcularNotaLocal(estId) {
    if (!estId) return;
    const r = (await q(
        "SELECT COUNT(*) AS total, AVG(nota) AS media FROM avaliacoes WHERE estabelecimento_id = ? AND arquivado_em IS NULL",
        [estId]
    ))[0];
    await q(
        "UPDATE estabelecimentos SET nota = ?, avaliacoes = ? WHERE id = ?",
        [parseFloat((r && r.media) || 0).toFixed(1), Number(r && r.total) || 0, estId]
    );
}

// ── LISTAGEM DO ARQUIVO (só Master) ──
router.get("/arquivo", h(async (req, res) => {
    if (!req._eu) return res.status(401).json({ erro: "Sessão inválida." });
    if (!soMaster(req)) return res.status(403).json({ erro: "Apenas o Admin Master vê o Arquivo." });

    const lista = [];
    for (const [modulo, cfg] of Object.entries(ITENS)) {
        try {
            const rows = await q(
                `SELECT t.id, t.${cfg.titulo} AS titulo, t.arquivado_em, t.motivo_arquivamento,
                        a.nome_completo AS arquivado_por_nome
                 FROM ${cfg.tabela} t
                 LEFT JOIN usuarios a ON a.id = t.arquivado_por
                 WHERE t.arquivado_em IS NOT NULL
                 ORDER BY t.arquivado_em DESC
                 LIMIT 200`
            );
            rows.forEach((r) => lista.push({
                tipo: modulo,
                rotulo: cfg.rotulo,
                id: r.id,
                titulo: r.titulo ? String(r.titulo).slice(0, 80) : `${cfg.rotulo} #${r.id}`,
                motivo: r.motivo_arquivamento || "",
                arquivado_em: r.arquivado_em,
                arquivado_por_nome: r.arquivado_por_nome || "",
            }));
        } catch (e) {
            // tabela sem as colunas de arquivamento: as outras continuam funcionando
            console.error("arquivo", modulo, e.message);
        }
    }
    lista.sort((a, b) => new Date(b.arquivado_em) - new Date(a.arquivado_em));
    res.json(lista.slice(0, 500));
}));

// ── ARQUIVAR ──
// PUT /admin/:modulo/:id/arquivar   body: { motivo? }
router.put("/:modulo/:id/arquivar", h(async (req, res) => {
    if (!req._eu) return res.status(401).json({ erro: "Sessão inválida." });
    const cfg = ITENS[req.params.modulo];
    const id = req.params.id;
    if (!cfg || !/^\d+$/.test(id)) return res.status(400).json({ erro: "Item inválido." });

    const campos = req.params.modulo === "usuarios" ? "id, arquivado_em, role"
        : req.params.modulo === "avaliacoes" ? "id, arquivado_em, estabelecimento_id"
        : "id, arquivado_em";
    const item = (await q(`SELECT ${campos} FROM ${cfg.tabela} WHERE id = ?`, [id]))[0];
    if (!item) return res.status(404).json({ erro: `${cfg.rotulo} não encontrado.` });
    if (item.arquivado_em) return res.status(409).json({ erro: "Este item já está arquivado." });

    if (req.params.modulo === "usuarios") {
        if (item.role === "master") return res.status(403).json({ erro: "A conta Master não pode ser arquivada." });
        if (String(id) === String(req._eu.id)) return res.status(403).json({ erro: "Você não pode arquivar a própria conta." });
    }

    const motivo = String((req.body && req.body.motivo) || "").trim().slice(0, 200) || null;
    await q(
        `UPDATE ${cfg.tabela} SET arquivado_em = NOW(), arquivado_por = ?, motivo_arquivamento = ? WHERE id = ?`,
        [req._eu.id, motivo, id]
    );
    if (req.params.modulo === "avaliacoes") {
        try { await recalcularNotaLocal(item.estabelecimento_id); }
        catch (e) { console.error("recalcular nota:", e.message); }
    }
    res.json({ mensagem: "Arquivado." });
}));

// ── RESTAURAR (só Master) ──
// PUT /admin/:modulo/:id/restaurar
router.put("/:modulo/:id/restaurar", h(async (req, res) => {
    if (!req._eu) return res.status(401).json({ erro: "Sessão inválida." });
    if (!soMaster(req)) return res.status(403).json({ erro: "Apenas o Admin Master pode restaurar." });
    const cfg = ITENS[req.params.modulo];
    const id = req.params.id;
    if (!cfg || !/^\d+$/.test(id)) return res.status(400).json({ erro: "Item inválido." });

    const extra = req.params.modulo === "avaliacoes" ? ", estabelecimento_id" : "";
    const item = (await q(`SELECT id, arquivado_em${extra} FROM ${cfg.tabela} WHERE id = ?`, [id]))[0];
    if (!item) return res.status(404).json({ erro: `${cfg.rotulo} não encontrado.` });
    if (!item.arquivado_em) return res.status(409).json({ erro: "Este item não está arquivado." });

    await q(
        `UPDATE ${cfg.tabela} SET arquivado_em = NULL, arquivado_por = NULL, motivo_arquivamento = NULL WHERE id = ?`,
        [id]
    );
    if (req.params.modulo === "avaliacoes") {
        try { await recalcularNotaLocal(item.estabelecimento_id); }
        catch (e) { console.error("recalcular nota:", e.message); }
    }
    res.json({ mensagem: "Restaurado." });
}));

module.exports = router;