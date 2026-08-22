// controllers/avaliacoesController.js

const connection = require("../db/db_config");

// ─── LISTAR avaliações de um evento OU de um estabelecimento ─────────
// GET /avaliacoes?evento_id=X
// GET /avaliacoes?estabelecimento_id=X
function listarAvaliacoes(req, res) {
    const { evento_id, estabelecimento_id } = req.query;

    if (!evento_id && !estabelecimento_id) {
        return res.status(400).json({ erro: "Informe evento_id ou estabelecimento_id." });
    }

    const coluna = evento_id ? "evento_id" : "estabelecimento_id";
    const valor = evento_id || estabelecimento_id;

    connection.query(
        `SELECT id, usuario_id, nome_autor, nota, comentario, created_at
         FROM avaliacoes
         WHERE ${coluna} = ?
         ORDER BY created_at DESC`,
        [valor],
        (err, results) => {
            if (err) return res.status(500).json({ erro: "Erro no servidor.", detalhes: err.message });
            res.json(results);
        }
    );
}

// ─── CRIAR avaliação ──────────────────────────────────────────────────────────
// POST /avaliacoes
// Body: { evento_id | estabelecimento_id, nota, comentario, nome_autor }
// Header: Authorization: Bearer <token>  (opcional)
function criarAvaliacao(req, res) {
    const { evento_id, estabelecimento_id, nota, comentario } = req.body;

    if (!evento_id && !estabelecimento_id) {
        return res.status(400).json({ erro: "Informe evento_id ou estabelecimento_id." });
    }

    if (!nota) {
        return res.status(400).json({ erro: "nota é obrigatória." });
    }

    if (nota < 1 || nota > 5) {
        return res.status(400).json({ erro: "Nota deve ser entre 1 e 5." });
    }

    const usuario = req.usuario; // vem do middleware authOpcional

    if (usuario) {
        connection.query(
            "SELECT nome_completo FROM usuarios WHERE id = ?",
            [usuario.id],
            (err, rows) => {
                if (err) return res.status(500).json({ erro: "Erro ao buscar usuário." });
                const nome_autor = rows[0]?.nome_completo || "Usuário";
                inserir(evento_id, estabelecimento_id, usuario.id, nome_autor, nota, comentario, res);
            }
        );
    } else {
        const nome_autor = (req.body.nome_autor || "").trim() || "Anônimo";
        inserir(evento_id, estabelecimento_id, null, nome_autor, nota, comentario, res);
    }
}

function inserir(evento_id, estabelecimento_id, usuario_id, nome_autor, nota, comentario, res) {
    connection.query(
        `INSERT INTO avaliacoes (evento_id, estabelecimento_id, usuario_id, nome_autor, nota, comentario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [evento_id || null, estabelecimento_id || null, usuario_id || null, nome_autor, nota, comentario || null],
        (err, result) => {
            if (err) return res.status(500).json({ erro: "Erro ao salvar avaliação.", detalhes: err.message });
            res.status(201).json({ mensagem: "Avaliação enviada!", id: result.insertId });
        }
    );
}

// ─── DELETAR avaliação ────────────────────────────────────────────────────────
// DELETE /avaliacoes/:id
function deletarAvaliacao(req, res) {
    const { id } = req.params;

    connection.query(
        "DELETE FROM avaliacoes WHERE id = ?",
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ erro: "Erro ao deletar.", detalhes: err.message });
            res.json({ mensagem: "Avaliação deletada com sucesso!" });
        }
    );
}

module.exports = { listarAvaliacoes, criarAvaliacao, deletarAvaliacao };