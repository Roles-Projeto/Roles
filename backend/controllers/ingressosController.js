"use strict";

const db     = require("../db/db_config");
const crypto = require("crypto");

// ====================================================
// LISTAR EVENTOS DISPONÍVEIS
// ====================================================
async function listarEventos(req, res) {
    try {
        const eventos = await db.query(`
            SELECT e.*,
                   MIN(i.valor) AS preco_minimo,
                   COUNT(i.id)  AS tipos_disponiveis
            FROM eventos e
            LEFT JOIN ingressos i ON i.evento_id = e.id
            WHERE e.data_inicio > NOW()
            GROUP BY e.id
            ORDER BY e.data_inicio ASC
        `);
        res.json(eventos);
    } catch (err) {
        console.error("Erro ao listar eventos:", err);
        res.status(500).json({ erro: "Erro ao listar eventos.", detalhe: err.message });
    }
}

// ====================================================
// VENDAS DOS MEUS EVENTOS (visão do dono/organizador — pro Dashboard)
// GET /pedidos/vendas/:usuario_id
// ====================================================
async function vendasDoDono(req, res) {
    const { usuario_id } = req.params;
    if (!usuario_id) {
        return res.status(400).json({ erro: "usuario_id não informado." });
    }

    try {
              const vendas = await db.query(`
            SELECT
                p.id,
                p.evento_id,
                p.valor_total,
                p.forma_pagamento,
                p.status,
                p.criado_em,
                e.nome                                                  AS nome_evento,
                u.nome_completo                                         AS nome_comprador,
                u.email                                                 AS email_comprador,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso,
                (SELECT COALESCE(SUM(v.quantidade), 0) FROM vendas v WHERE v.pedido_id = p.id) AS quantidade_itens
            FROM pedidos p
            JOIN eventos  e ON e.id = p.evento_id
            JOIN usuarios u ON u.id = p.usuario_id
            WHERE e.usuario_id = ?
            ORDER BY p.criado_em DESC
        `, [usuario_id]);

        res.json(vendas);
    } catch (err) {
        console.error("Erro ao buscar vendas do dono:", err);
        res.status(500).json({ erro: "Erro ao buscar vendas.", detalhe: err.message });
    }
}

// ====================================================
// TOTAL DE INGRESSOS POR EVENTO (visão do dono — pro Dashboard)
// GET /ingressos/totais/:usuario_id
// ====================================================
async function totalIngressosPorUsuario(req, res) {
    const { usuario_id } = req.params;
    if (!usuario_id) {
        return res.status(400).json({ erro: "usuario_id não informado." });
    }

    try {
        const totais = await db.query(`
            SELECT i.evento_id, SUM(i.quantidade_total) AS total
            FROM ingressos i
            JOIN eventos e ON e.id = i.evento_id
            WHERE e.usuario_id = ?
            GROUP BY i.evento_id
        `, [usuario_id]);

        res.json(totais);
    } catch (err) {
        console.error("Erro ao buscar totais de ingressos:", err);
        res.status(500).json({ erro: "Erro ao buscar totais de ingressos.", detalhe: err.message });
    }
}

// ====================================================
// DETALHE DO EVENTO + TIPOS DE INGRESSO
// ====================================================
async function detalheEvento(req, res) {
    const { id } = req.params;
    try {
        const rows = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);
        const evento = rows[0];
        if (!evento) return res.status(404).json({ erro: "Evento não encontrado." });

        const tiposDb = await db.query(`
            SELECT
                i.id, i.titulo AS nome, i.tipo, i.valor AS preco,
                i.quantidade_total, i.ativo, i.data_inicio_venda, i.data_fim_venda,
                COALESCE((
                    SELECT SUM(v.quantidade) FROM vendas v
                    WHERE v.ingresso_id = i.id AND v.status IN ('aprovado', 'cortesia')
                ), 0) AS ocupados
            FROM ingressos i
            WHERE i.evento_id = ?
            ORDER BY i.id ASC
        `, [id]);

        const agora = new Date();
        const tipos = tiposDb.map(t => {
            const disponivel = Math.max(0, t.quantidade_total - (Number(t.ocupados) || 0));
            return {
                id: t.id,
                nome: t.nome,
                tipo: t.tipo,
                preco: t.preco,
                quantidade_total: t.quantidade_total,
                disponivel,
                status_venda: getStatusVenda(t, disponivel, agora),
                venda_abre_em: t.data_inicio_venda || null,
                venda_encerra_em: t.data_fim_venda || null,
            };
        });

        res.json({ ...evento, tipos_ingresso: tipos });
    } catch (err) {
        console.error("Erro ao buscar evento:", err);
        res.status(500).json({ erro: "Erro interno.", detalhe: err.message });
    }
}
// ====================================================
// COMPRAR INGRESSO
//
// REGRA DE CORTESIA: se quem está comprando (usuario_id) for o mesmo
// usuário dono do evento (eventos.usuario_id), a compra é tratada
// como cortesia — valor zerado, sem checagem de forma de pagamento,
// status "cortesia". Como os KPIs do dashboard só somam receita
// quando status é "aprovado", uma cortesia nunca entra no total de
// vendas nem no ticket médio — mas ainda aparece na lista de vendas
// e gera o ingresso normalmente (com QR code).
// ====================================================
async function comprarIngresso(req, res) {
    const { usuario_id, evento_id, itens, forma_pagamento } = req.body;

    if (!usuario_id || !evento_id || !itens?.length) {
        return res.status(400).json({ erro: "Dados incompletos." });
    }

    try {
        const eventoRows = await db.query("SELECT usuario_id FROM eventos WHERE id = ?", [evento_id]);
        const evento = eventoRows[0];
        if (!evento) return res.status(404).json({ erro: "Evento não encontrado." });

        const ehCortesia = String(evento.usuario_id) === String(usuario_id);

        if (!ehCortesia) {
            const formasValidas = ["credito", "debito", "boleto", "pix"];
            if (!formasValidas.includes(forma_pagamento)) {
                return res.status(400).json({ erro: "Forma de pagamento inválida." });
            }
        }

        let valor_total = 0;
        const detalhes  = [];

                for (const item of itens) {
            const rows = await db.query(
                "SELECT * FROM ingressos WHERE id = ? AND evento_id = ?",
                [item.tipo_ingresso_id, evento_id]
            );
            const tipo = rows[0];
            if (!tipo) {
                return res.status(400).json({ erro: `Ingresso ${item.tipo_ingresso_id} inválido.` });
            }

            // Tipo pausado pelo organizador — não pode ser comprado,
            // mesmo que ainda tenha vagas disponíveis.
            if (tipo.ativo === false || tipo.ativo === 0) {
                return res.status(400).json({ erro: `A venda de "${tipo.titulo}" está pausada no momento.` });
            }

            // Janela de lote (se configurada) — venda só é permitida dentro do período.
                        // Janela de lote (se configurada) — venda só é permitida dentro do período.
            const agora = new Date();
            if (tipo.data_inicio_venda && agora < new Date(tipo.data_inicio_venda)) {
                return res.status(400).json({ erro: `A venda de "${tipo.titulo}" ainda não começou.` });
            }
            if (tipo.data_fim_venda && agora > new Date(tipo.data_fim_venda)) {
                return res.status(400).json({ erro: `A venda de "${tipo.titulo}" já foi encerrada.` });
            }

            // Trava de capacidade — nunca deixa vender/gerar cortesia além do
            // total cadastrado, mesmo que a compra seja cortesia (sem custo,
            // mas ainda ocupa uma vaga física do evento).
            const ocupadosRows = await db.query(`
                SELECT COALESCE(SUM(quantidade), 0) AS total
                FROM vendas
                WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')
            `, [tipo.id]);
            const jaOcupados = Number(ocupadosRows[0]?.total) || 0;
            const disponiveis = tipo.quantidade_total - jaOcupados;

            if (item.quantidade > disponiveis) {
                return res.status(400).json({
                    erro: `Ingressos insuficientes para "${tipo.titulo}": restam apenas ${Math.max(0, disponiveis)}.`
                });
            }

            valor_total += ehCortesia ? 0 : parseFloat(tipo.valor) * item.quantidade;
            detalhes.push({ tipo, quantidade: item.quantidade });
        }

        const status_pagamento = ehCortesia ? "cortesia" : simularPagamento(forma_pagamento);
        const formaFinal = ehCortesia ? "cortesia" : forma_pagamento;

               // Pedido + todas as linhas de venda entram na MESMA transação.
        // Se qualquer INSERT de venda falhar, o pedido inteiro é revertido —
        // nunca mais fica um pedido "órfão" sem a venda correspondente
        // (foi exatamente esse tipo de inconsistência que já corrigimos
        // manualmente uma vez pro evento BTS World Tour).
        //
        // Cada linha de `vendas` agora também grava o pedido_id — com a FK
        // (ON DELETE CASCADE) criada na migration, excluir um pedido passa
        // a arrastar as vendas correspondentes junto, sem deixar lixo órfão.
        const pedido_id = await db.transacao(async (tx) => {
            const pedidoResult = await tx.query(
                "INSERT INTO pedidos (usuario_id, evento_id, valor_total, forma_pagamento, status) VALUES (?, ?, ?, ?, ?)",
                [usuario_id, evento_id, valor_total, formaFinal, status_pagamento]
            );
            const novoPedidoId = pedidoResult.insertId ?? pedidoResult[0]?.id;

            for (const d of detalhes) {
                await tx.query(
                    "INSERT INTO vendas (pedido_id, ingresso_id, usuario_id, quantidade, valor_total, status) VALUES (?, ?, ?, ?, ?, ?)",
                    [novoPedidoId, d.tipo.id, usuario_id, d.quantidade, ehCortesia ? 0 : parseFloat(d.tipo.valor) * d.quantidade, status_pagamento]
                );
            }

            return novoPedidoId;
        });

        const ingressosGerados = detalhes.flatMap(d =>
            Array.from({ length: d.quantidade }, () => ({
                tipo:      d.tipo.titulo,
                codigo_qr: gerarCodigoQR(pedido_id, d.tipo.id, usuario_id),
            }))
        );

        if (status_pagamento === "aprovado") {
            try {
                const { enviarEmailIngresso } = require("../services/emailService");
                const [usuarioRows, eventoInfoRows] = await Promise.all([
                    db.query("SELECT nome_completo, email FROM usuarios WHERE id = ?", [usuario_id]),
                    db.query("SELECT nome, data_inicio, local_nome, cidade FROM eventos WHERE id = ?", [evento_id]),
                ]);
                const usuario = usuarioRows[0];
                const eventoInfo = eventoInfoRows[0];
                if (usuario && eventoInfo) {
                    const d = new Date(eventoInfo.data_inicio);
                    enviarEmailIngresso({
                        nomeCliente:     usuario.nome_completo,
                        emailCliente:    usuario.email,
                        pedido_id,
                        nomeEvento:      eventoInfo.nome,
                        dataEvento:      d.toLocaleDateString("pt-BR"),
                        horaEvento:      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                        localEvento:     `${eventoInfo.local_nome}, ${eventoInfo.cidade}`,
                        nomeIngresso:    detalhes[0]?.tipo?.titulo || "Ingresso",
                        quantidade:      ingressosGerados.length,
                        subtotal:        valor_total,
                        taxaServico:     valor_total * 0.10,
                        totalPago:       valor_total * 1.10,
                        forma_pagamento: formaFinal,
                        ingressos:       ingressosGerados,
                    }).catch(e => console.error("❌ Erro ao enviar e-mail:", e.message));
                }
            } catch (e) {
                console.error("❌ Erro ao buscar dados para e-mail:", e.message);
            }
        }

        res.status(201).json({
            mensagem: ehCortesia
                ? "Ingresso de cortesia gerado com sucesso!"
                : (status_pagamento === "aprovado" ? "Compra realizada com sucesso!" : "Pagamento pendente. Aguardando confirmação."),
            pedido_id,
            status:          status_pagamento,
            valor_total,
            forma_pagamento: formaFinal,
            ingressos:       ingressosGerados,
        });

    } catch (err) {
        console.error("Erro ao comprar ingresso:", err);
        res.status(500).json({ erro: "Erro interno ao processar compra.", detalhe: err.message });
    }
}
// ====================================================
// MEUS INGRESSOS
// ====================================================
async function meusIngressos(req, res) {
    const { usuario_id } = req.params;
    if (!usuario_id) {
        return res.status(400).json({ erro: "usuario_id não informado." });
    }

    try {
        const ingressos = await db.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.evento_id,
                p.valor_total                                           AS preco,
                p.forma_pagamento,
                p.status                                                AS status_pagamento,
                p.criado_em,
                e.nome                                                  AS nome_evento,
                e.data_inicio                                           AS data_evento,
                e.local_nome                                            AS local_evento,
                e.cidade,
                e.estado,
                e.imagem                                                AS img_capa,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso,
                (SELECT valor  FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS preco_unitario
            FROM pedidos p
            JOIN eventos e ON e.id = p.evento_id
            WHERE p.usuario_id = ?
            ORDER BY p.criado_em DESC
        `, [usuario_id]);

        console.log(`✅ meusIngressos: ${ingressos.length} pedido(s) para usuario_id=${usuario_id}`);
        res.json(ingressos);

    } catch (err) {
        console.error("❌ ERRO meusIngressos:", err);
        res.status(500).json({ erro: "Erro ao buscar ingressos.", detalhe: err.message });
    }
}

// ====================================================
// VALIDAR QR CODE
// ====================================================
async function validarQRCode(req, res) {
    res.json({ valido: false, mensagem: "Validação por QR não configurada." });
}

// ====================================================
// DETALHE DO INGRESSO
// ====================================================
async function detalheIngresso(req, res) {
    const { id }         = req.params;
    const { usuario_id } = req.query;

    try {
        const rows = await db.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.evento_id,
                p.valor_total        AS preco,
                p.forma_pagamento,
                p.status             AS status_pagamento,
                p.criado_em,
                e.nome               AS nome_evento,
                e.data_inicio        AS data_evento,
                e.local_nome         AS local_evento,
                e.cidade,
                e.estado,
                e.imagem             AS img_capa,
                i.titulo             AS tipo_ingresso,
                i.valor              AS preco_unitario
            FROM pedidos p
            JOIN eventos    e ON e.id = p.evento_id
            LEFT JOIN ingressos i ON i.evento_id = p.evento_id
            WHERE p.id = ? AND p.usuario_id = ?
            LIMIT 1
        `, [id, usuario_id]);

        const ingresso = rows[0];
        if (!ingresso) return res.status(404).json({ erro: "Ingresso não encontrado." });
        res.json(ingresso);

    } catch (err) {
        console.error("Erro ao buscar ingresso:", err);
        res.status(500).json({ erro: "Erro interno.", detalhe: err.message });
    }
}

// ====================================================
// AUXILIARES
// ====================================================
function gerarCodigoQR(pedido_id, tipo_id, usuario_id) {
    const dados = `${pedido_id}-${tipo_id}-${usuario_id}-${Date.now()}-${Math.random()}`;
    return crypto.createHash("sha256").update(dados).digest("hex");
}

function getStatusVenda(tipo, disponiveis, agora = new Date()) {
    if (tipo.ativo === false || tipo.ativo === 0) return "pausado";
    if (tipo.data_inicio_venda && agora < new Date(tipo.data_inicio_venda)) return "em_breve";
    if (tipo.data_fim_venda && agora > new Date(tipo.data_fim_venda)) return "encerrado";
    if (disponiveis <= 0) return "esgotado";
    return "disponivel";
}

function simularPagamento(forma_pagamento) {
    if (forma_pagamento === "boleto") return "pendente";
    return "aprovado";
}

// ====================================================
// REENVIAR E-MAIL DO INGRESSO
// POST /pedidos/:id/reenviar-email
// ====================================================
async function reenviarEmailIngresso(req, res) {
    const { id } = req.params;

    try {
        const rows = await db.query(`
            SELECT
                p.id            AS pedido_id,
                p.usuario_id,
                p.valor_total,
                p.forma_pagamento,
                p.status,
                e.nome          AS nome_evento,
                e.data_inicio,
                e.local_nome,
                e.cidade,
                u.nome_completo,
                u.email,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso
            FROM pedidos p
            JOIN eventos  e ON e.id = p.evento_id
            JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ?
            LIMIT 1
        `, [id]);

        const d = rows[0];
        if (!d) return res.status(404).json({ erro: "Pedido não encontrado." });
        if (!d.email) return res.status(400).json({ erro: "Usuário sem e-mail cadastrado." });

        const dataEvt    = new Date(d.data_inicio);
        const codigo_qr  = `ROLES-PEDIDO-${d.pedido_id}-USUARIO-${d.usuario_id}`;

        const { enviarEmailIngresso } = require("../services/emailService");

        await enviarEmailIngresso({
            nomeCliente:     d.nome_completo,
            emailCliente:    d.email,
            pedido_id:       d.pedido_id,
            nomeEvento:      d.nome_evento,
            dataEvento:      dataEvt.toLocaleDateString("pt-BR"),
            horaEvento:      dataEvt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            localEvento:     `${d.local_nome}, ${d.cidade}`,
            nomeIngresso:    d.tipo_ingresso || "Ingresso",
            quantidade:      1,
            subtotal:        d.valor_total,
            taxaServico:     d.valor_total * 0.10,
            totalPago:       d.valor_total * 1.10,
            forma_pagamento: d.forma_pagamento,
            ingressos:       [{ tipo: d.tipo_ingresso || "Ingresso", codigo_qr }],
        });

        res.json({ mensagem: "E-mail reenviado com sucesso." });

    } catch (err) {
        console.error("❌ Erro ao reenviar e-mail:", err);
        res.status(500).json({ erro: "Erro ao reenviar e-mail.", detalhe: err.message });
    }
}

// ====================================================
// TIPOS DE INGRESSO — LISTAR (com vendidos/cortesia por tipo)
// GET /ingressos/tipos/:evento_id
// Usado pelo modal "Gerenciar ingressos" do dashboard.
// ====================================================
async function listarTiposIngresso(req, res) {
    const { evento_id } = req.params;
    if (!evento_id) {
        return res.status(400).json({ erro: "evento_id não informado." });
    }

    try {
               const tipos = await db.query(`
            SELECT
                i.id, i.evento_id, i.titulo, i.tipo, i.valor, i.quantidade_total,
                i.ativo, i.data_inicio_venda, i.data_fim_venda,
                COALESCE(SUM(CASE WHEN v.status = 'aprovado' THEN v.quantidade ELSE 0 END), 0) AS vendidos,
                COALESCE(SUM(CASE WHEN v.status = 'cortesia' THEN v.quantidade ELSE 0 END), 0) AS cortesia
            FROM ingressos i
            LEFT JOIN vendas v ON v.ingresso_id = i.id
            WHERE i.evento_id = ?
            GROUP BY i.id, i.evento_id, i.titulo, i.tipo, i.valor, i.quantidade_total,
                     i.ativo, i.data_inicio_venda, i.data_fim_venda
            ORDER BY i.id ASC
        `, [evento_id]);

        res.json(tipos);
    } catch (err) {
        console.error("Erro ao listar tipos de ingresso:", err);
        res.status(500).json({ erro: "Erro ao listar tipos de ingresso.", detalhe: err.message });
    }
}

// ====================================================
// TIPOS DE INGRESSO — CRIAR
// POST /ingressos/tipos
// body: { evento_id, titulo, tipo, valor, quantidade_total }
// ====================================================
async function criarTipoIngresso(req, res) {
    const { evento_id, titulo, tipo, valor, quantidade_total, ativo, data_inicio_venda, data_fim_venda } = req.body;

    if (!evento_id || !titulo || valor == null || quantidade_total == null) {
        return res.status(400).json({ erro: "Dados incompletos para criar o tipo de ingresso." });
    }

    try {
        const eventoRows = await db.query("SELECT id FROM eventos WHERE id = ?", [evento_id]);
        if (!eventoRows[0]) return res.status(404).json({ erro: "Evento não encontrado." });

        const ativoFinal = ativo === false ? false : true;
        const inicioFinal = data_inicio_venda || null;
        const fimFinal = data_fim_venda || null;

        const result = await db.query(
            "INSERT INTO ingressos (evento_id, titulo, tipo, valor, quantidade_total, ativo, data_inicio_venda, data_fim_venda) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [evento_id, titulo, tipo || null, parseFloat(valor), parseInt(quantidade_total), ativoFinal, inicioFinal, fimFinal]
        );
        const novoId = result.insertId ?? result[0]?.id;

        res.status(201).json({
            id: novoId,
            evento_id,
            titulo,
            tipo: tipo || null,
            valor: parseFloat(valor),
            quantidade_total: parseInt(quantidade_total),
            ativo: ativoFinal,
            data_inicio_venda: inicioFinal,
            data_fim_venda: fimFinal,
            vendidos: 0,
            cortesia: 0,
        });
    } catch (err) {
        console.error("Erro ao criar tipo de ingresso:", err);
        res.status(500).json({ erro: "Erro ao criar tipo de ingresso.", detalhe: err.message });
    }
}
// ====================================================
// TIPOS DE INGRESSO — EDITAR
// PUT /ingressos/tipos/:id
// body: { titulo, tipo, valor, quantidade_total }
//
// Não deixa reduzir quantidade_total abaixo do que já foi vendido
// ou dado como cortesia — evitaria "sumir" com histórico de vendas.
// ====================================================
async function atualizarTipoIngresso(req, res) {
    const { id } = req.params;
    const { titulo, tipo, valor, quantidade_total, ativo, data_inicio_venda, data_fim_venda } = req.body;

    try {
        const rows = await db.query("SELECT * FROM ingressos WHERE id = ?", [id]);
        const atual = rows[0];
        if (!atual) return res.status(404).json({ erro: "Tipo de ingresso não encontrado." });

        const ocupadosRows = await db.query(`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM vendas
            WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')
        `, [id]);
        const jaOcupados = Number(ocupadosRows[0]?.total) || 0;

        const novoTotal = quantidade_total != null ? parseInt(quantidade_total) : atual.quantidade_total;
        if (novoTotal < jaOcupados) {
            return res.status(400).json({
                erro: `Quantidade total não pode ser menor que o já ocupado (${jaOcupados} ingressos entre vendidos e cortesia).`
            });
        }

        const ativoFinal = ativo != null ? !!ativo : atual.ativo;
        const inicioFinal = data_inicio_venda !== undefined ? (data_inicio_venda || null) : atual.data_inicio_venda;
        const fimFinal = data_fim_venda !== undefined ? (data_fim_venda || null) : atual.data_fim_venda;

        await db.query(
            "UPDATE ingressos SET titulo = ?, tipo = ?, valor = ?, quantidade_total = ?, ativo = ?, data_inicio_venda = ?, data_fim_venda = ? WHERE id = ?",
            [
                titulo ?? atual.titulo,
                tipo ?? atual.tipo,
                valor != null ? parseFloat(valor) : atual.valor,
                novoTotal,
                ativoFinal,
                inicioFinal,
                fimFinal,
                id
            ]
        );

        res.json({ mensagem: "Tipo de ingresso atualizado com sucesso." });
    } catch (err) {
        console.error("Erro ao atualizar tipo de ingresso:", err);
        res.status(500).json({ erro: "Erro ao atualizar tipo de ingresso.", detalhe: err.message });
    }
}
// ====================================================
// TIPOS DE INGRESSO — EXCLUIR
// DELETE /ingressos/tipos/:id
//
// Bloqueia exclusão se já existir venda aprovada ou cortesia
// vinculada a esse tipo, pra não perder o histórico.
// ====================================================
async function excluirTipoIngresso(req, res) {
    const { id } = req.params;

    try {
        const ocupadosRows = await db.query(`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM vendas
            WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')
        `, [id]);
        const jaOcupados = Number(ocupadosRows[0]?.total) || 0;

        if (jaOcupados > 0) {
            return res.status(400).json({
                erro: `Não é possível excluir: já existem ${jaOcupados} ingresso(s) vendido(s)/cortesia neste tipo.`
            });
        }

        await db.query("DELETE FROM ingressos WHERE id = ?", [id]);
        res.json({ mensagem: "Tipo de ingresso excluído com sucesso." });
    } catch (err) {
        console.error("Erro ao excluir tipo de ingresso:", err);
        res.status(500).json({ erro: "Erro ao excluir tipo de ingresso.", detalhe: err.message });
    }
}

module.exports = {
    listarEventos,
    detalheEvento,
    comprarIngresso,
    meusIngressos,
    validarQRCode,
    detalheIngresso,
    reenviarEmailIngresso,
    vendasDoDono,
    totalIngressosPorUsuario,
    listarTiposIngresso,
    criarTipoIngresso,
    atualizarTipoIngresso,
    excluirTipoIngresso,
};