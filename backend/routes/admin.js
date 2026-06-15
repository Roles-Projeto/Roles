// =====================================================
//  backend/routes/admin.js
//  Versão completa com seção de MENSAGENS adicionada
// =====================================================

const express = require("express");
const router = express.Router();
const authAdmin = require("../middleware/authAdmin");
const connection = require("../db/db_config");
const nodemailer = require("nodemailer");

// ── Transporter (mesmo do contato.js) ───────────────
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
  family: 4,
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// ─────────────────────────────────────────────────────
// 📊 DASHBOARD
// ─────────────────────────────────────────────────────
router.get("/dashboard", authAdmin, (req, res) => {
    const queries = {
        usuarios: "SELECT COUNT(*) as total FROM usuarios",
        estabelecimentos: "SELECT COUNT(*) as total FROM estabelecimentos",
        eventos: "SELECT COUNT(*) as total FROM eventos",
        avaliacoes: "SELECT COUNT(*) as total FROM avaliacoes",
        ingressos: "SELECT COUNT(*) as total FROM ingressos",
        mensagens: "SELECT COUNT(*) as total FROM contatos WHERE status = 'novo'",
    };

    const resultados = {};
    let concluidos = 0;
    const total = Object.keys(queries).length;

    for (const [chave, sql] of Object.entries(queries)) {
        connection.query(sql, [], (err, rows) => {
            resultados[chave] = err ? 0 : rows[0].total;
            concluidos++;
            if (concluidos === total) res.json(resultados);
        });
    }
});

// ─────────────────────────────────────────────────────
// 👥 USUÁRIOS
// ─────────────────────────────────────────────────────
router.get("/usuarios", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome_completo, email, telefone, role, verificado, criado_em FROM usuarios ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/usuarios/:id", authAdmin, (req, res) => {
    const { nome_completo, email, role, verificado } = req.body;
    connection.query(
        "UPDATE usuarios SET nome_completo = ?, email = ?, role = ?, verificado = ? WHERE id = ?",
        [nome_completo, email, role, verificado, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Usuário atualizado com sucesso." });
        }
    );
});

router.put("/usuarios/:id/role", authAdmin, (req, res) => {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ erro: "Role inválido." });
    }
    connection.query(
        "UPDATE usuarios SET role = ? WHERE id = ?",
        [role, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: `Usuário atualizado para ${role}.` });
        }
    );
});

router.delete("/usuarios/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM usuarios WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Usuário deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 🏪 ESTABELECIMENTOS
// ─────────────────────────────────────────────────────
router.get("/estabelecimentos", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome, tipo, cidade, estado, avaliacoes, nota, visibilidade, criado_em FROM estabelecimentos ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/estabelecimentos/:id", authAdmin, (req, res) => {
    const { nome, tipo, cidade, endereco, descricao } = req.body;
    connection.query(
        "UPDATE estabelecimentos SET nome = ?, tipo = ?, cidade = ?, endereco = ?, descricao = ? WHERE id = ?",
        [nome, tipo, cidade, endereco, descricao, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Estabelecimento atualizado com sucesso." });
        }
    );
});

router.delete("/estabelecimentos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM estabelecimentos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Estabelecimento deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 📅 EVENTOS
// ─────────────────────────────────────────────────────
router.get("/eventos", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM eventos ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/eventos/:id", authAdmin, (req, res) => {
    const { nome, assunto, categoria, descricao, nome_produtor, local, cidade, estado, cep, rua, data_inicio, data_fim } = req.body;
    const fimFinal = data_fim || data_inicio;
    connection.query(
        `UPDATE eventos SET
            nome = ?, assunto = ?, categoria = ?, descricao = ?, nome_produtor = ?,
            local_nome = ?, cidade = ?, estado = ?, cep = ?, rua = ?,
            data_inicio = ?, data_fim = ?
         WHERE id = ?`,
        [nome, assunto, categoria, descricao, nome_produtor, local, cidade, estado, cep, rua, data_inicio, fimFinal, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Evento atualizado com sucesso." });
        }
    );
});

router.delete("/eventos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM eventos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Evento deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 🎟 INGRESSOS
// ─────────────────────────────────────────────────────
router.get("/ingressos", authAdmin, (req, res) => {
    connection.query(
        `SELECT i.id, i.titulo, i.tipo, i.valor, i.quantidade_total, i.evento_id,
                e.nome AS evento_nome
         FROM ingressos i
         LEFT JOIN eventos e ON e.id = i.evento_id
         ORDER BY i.id DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/ingressos/:id", authAdmin, (req, res) => {
    const { titulo, tipo, valor, quantidade_total } = req.body;
    connection.query(
        "UPDATE ingressos SET titulo = ?, tipo = ?, valor = ?, quantidade_total = ? WHERE id = ?",
        [titulo, tipo, valor, quantidade_total, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Ingresso atualizado com sucesso." });
        }
    );
});

router.delete("/ingressos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM ingressos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Ingresso deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// ✉️  MENSAGENS DE CONTATO  ← NOVO
// ─────────────────────────────────────────────────────

// Listar todas as mensagens
router.get("/mensagens", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM contatos ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// Marcar como lido
router.put("/mensagens/:id/lido", authAdmin, (req, res) => {
    connection.query(
        "UPDATE contatos SET status = 'lido' WHERE id = ? AND status = 'novo'",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Mensagem marcada como lida." });
        }
    );
});

// Responder mensagem — salva no banco e envia e-mail ao remetente
router.post("/mensagens/:id/responder", authAdmin, async (req, res) => {
    const { resposta } = req.body;
    if (!resposta || !resposta.trim()) {
        return res.status(400).json({ erro: "Resposta não pode ser vazia." });
    }

    // Busca a mensagem original
    connection.query(
        "SELECT * FROM contatos WHERE id = ?",
        [req.params.id],
        async (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            if (!rows.length) return res.status(404).json({ erro: "Mensagem não encontrada." });

            const contato = rows[0];

            // Salva resposta no banco
            connection.query(
                "UPDATE contatos SET status = 'respondido', resposta = ?, respondido_em = NOW() WHERE id = ?",
                [resposta.trim(), req.params.id],
                async (err2) => {
                    if (err2) return res.status(500).json({ erro: err2.message });

                    // Envia e-mail de resposta ao usuário
                    try {
                        await transporter.sendMail({
                            from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
                            to: contato.email,
                            subject: `Re: [Protocolo #${req.params.id}] ${contato.assunto}`,
                            html: `
                                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;">
                                    <div style="background:#0c0c1d;padding:20px 28px;">
                                        <h2 style="color:#fff;margin:0;font-size:18px;">Rolês Suporte</h2>
                                    </div>
                                    <div style="padding:24px 28px;">
                                        <p style="font-size:15px;margin:0 0 12px;">Olá, <strong>${contato.nome}</strong>!</p>
                                        <p style="font-size:14px;color:#555;margin:0 0 16px;">Respondemos à sua mensagem sobre <strong>${contato.assunto}</strong>:</p>
                                        <div style="background:#f8f8f8;padding:16px;border-radius:8px;font-size:14px;line-height:1.65;color:#333;">
                                            ${resposta.trim().replace(/\n/g, "<br>")}
                                        </div>
                                        <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0 14px;">
                                        <p style="font-size:12px;color:#aaa;margin:0;">Sua mensagem original:</p>
                                        <p style="font-size:13px;color:#999;padding:10px 14px;border-left:3px solid #ddd;margin:8px 0 0;line-height:1.6;">
                                            ${contato.mensagem.replace(/\n/g, "<br>")}
                                        </p>
                                    </div>
                                    <div style="background:#fafafa;padding:12px 28px;border-top:1px solid #f0f0f0;">
                                        <p style="margin:0;font-size:11px;color:#bbb;">
  Protocolo #${contato.id} — NÃO RESPONDER fora do sistema
</p>
                                    </div>
                                </div>
                            `,
                        });
                        res.json({ mensagem: "Resposta enviada com sucesso!" });
                    } catch (mailErr) {
                        console.error("Erro ao enviar e-mail de resposta:", mailErr.message);
                        res.status(500).json({ erro: "Resposta salva, mas falha ao enviar e-mail: " + mailErr.message });
                    }
                }
            );
        }
    );
});

// Deletar mensagem
router.delete("/mensagens/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM contatos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Mensagem deletada com sucesso." });
        }
    );
});

// GET /admin/mensagens/:id/thread — busca conversa completa
router.get("/mensagens/:id/thread", authAdmin, (req, res) => {
    connection.query(
        `SELECT * FROM contato_respostas 
         WHERE contato_id = ? 
         ORDER BY criado_em ASC`,
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// ─────────────────────────────────────────────────────
// ⭐ AVALIAÇÕES
// ─────────────────────────────────────────────────────
router.get("/avaliacoes", authAdmin, (req, res) => {
    connection.query(
        `SELECT a.id, a.nota, a.comentario, a.nome_autor, a.created_at,
                e.nome AS estabelecimento_nome
         FROM avaliacoes a
         LEFT JOIN estabelecimentos e ON e.id = a.estabelecimento_id
         ORDER BY a.created_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.delete("/avaliacoes/:id", authAdmin, (req, res) => {
    connection.query(
        "SELECT estabelecimento_id FROM avaliacoes WHERE id = ?",
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            if (!rows.length) return res.status(404).json({ erro: "Avaliação não encontrada." });

            const estId = rows[0].estabelecimento_id;

            connection.query("DELETE FROM avaliacoes WHERE id = ?", [req.params.id], (err2) => {
                if (err2) return res.status(500).json({ erro: err2.message });

                // Recalcula média do estabelecimento
                connection.query(
                    "SELECT COUNT(*) AS total, AVG(nota) AS media FROM avaliacoes WHERE estabelecimento_id = ?",
                    [estId],
                    (err3, r) => {
                        if (!err3 && r[0]) {
                            connection.query(
                                "UPDATE estabelecimentos SET nota = ?, avaliacoes = ? WHERE id = ?",
                                [parseFloat(r[0].media || 0).toFixed(1), r[0].total, estId],
                                () => {}
                            );
                        }
                        res.json({ mensagem: "Avaliação deletada com sucesso." });
                    }
                );
            });
        }
    );
});

module.exports = router;