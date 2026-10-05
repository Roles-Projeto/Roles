"use strict";

const db     = require("../db/db_config");
const crypto = require("crypto");
const { venderAssentosReservados, gerarAssentosParaIngresso } = require("./assentosController");

// Valor gravado em ingressos.tipo quando o ingresso não tem custo.
// O criarEventos.js grava "pago" para pagos; confirme aqui o texto que ele usa para os gratuitos.
const TIPO_GRATUITO = "gratuito";

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
// ====================================================================
// SUBSTITUA a função comprarIngresso inteira do ingressosController.js
// por esta, e adicione esta linha junto dos outros "require" no topo:
//
//   const { venderAssentosReservados } = require("./assentosController");
//
// O que mudou em relação à versão anterior:
//  1. quantidade validada (inteiro >= 1) — antes aceitava negativo/quebrado
//  2. ingresso numerado exige assento_ids (mesma quantidade) e vende os assentos
//     RESERVADOS por quem compra, na mesma transação do pedido
//  3. usuario_id vem do token quando existe (req.usuario); o do body só é
//     usado enquanto a rota ainda não tem o middleware verificarToken
//  4. erros com status (400/409) lançados dentro da transação viram resposta HTTP
// ====================================================================
async function comprarIngresso(req, res) {
    const { evento_id, itens, forma_pagamento } = req.body;

    // Preferência: usuário do token. Fallback temporário: body (inseguro — remover
    // depois que a rota POST /ingressos/comprar tiver verificarToken).
    const usuario_id = req.usuario?.id ?? req.body.usuario_id;

    if (!usuario_id || !evento_id || !itens?.length) {
        return res.status(400).json({ erro: "Dados incompletos." });
    }

    try {
        const eventoRows = await db.query("SELECT usuario_id FROM eventos WHERE id = ?", [evento_id]);
        const evento = eventoRows[0];
        if (!evento) return res.status(404).json({ erro: "Evento não encontrado." });

        const ehCortesia = String(evento.usuario_id) === String(usuario_id);

        let valor_total = 0;
        const detalhes  = [];

        for (const item of itens) {
            // Quantidade precisa ser um inteiro >= 1
            const qtd = Number(item.quantidade);
            if (!Number.isInteger(qtd) || qtd < 1) {
                return res.status(400).json({ erro: "Quantidade inválida." });
            }
            item.quantidade = qtd;

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
            const agora = new Date();
            if (tipo.data_inicio_venda && agora < new Date(tipo.data_inicio_venda)) {
                return res.status(400).json({ erro: `A venda de "${tipo.titulo}" ainda não começou.` });
            }
            if (tipo.data_fim_venda && agora > new Date(tipo.data_fim_venda)) {
                return res.status(400).json({ erro: `A venda de "${tipo.titulo}" já foi encerrada.` });
            }

            // Ingresso numerado: precisa dos assentos, um para cada unidade comprada
            let assentoIds = [];
            if (tipo.tipo_selecao === "numerado") {
                assentoIds = Array.isArray(item.assento_ids)
                    ? [...new Set(item.assento_ids.map(Number))]
                    : [];
                if (!assentoIds.length || assentoIds.some(n => !Number.isInteger(n) || n < 1)) {
                    return res.status(400).json({ erro: `Escolha os assentos de "${tipo.titulo}" antes de comprar.` });
                }
                if (assentoIds.length !== qtd) {
                    return res.status(400).json({ erro: "A quantidade de ingressos não confere com os assentos escolhidos." });
                }
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

            // Quantidade mínima por compra (configurada pelo organizador).
            if (tipo.quantidade_min_por_compra && item.quantidade < tipo.quantidade_min_por_compra) {
                return res.status(400).json({
                    erro: `Mínimo de ${tipo.quantidade_min_por_compra} unidade(s) de "${tipo.titulo}" por compra.`
                });
            }

            // Quantidade máxima por compra (olha só o pedido atual; não impede novas compras depois).
            if (tipo.quantidade_max_por_compra && item.quantidade > tipo.quantidade_max_por_compra) {
                return res.status(400).json({
                    erro: `Máximo de ${tipo.quantidade_max_por_compra} unidade(s) de "${tipo.titulo}" por compra.`
                });
            }

            // Limite de ingressos por CPF (total, somando todas as compras).
            // Ingressos antigos só têm limite_um_por_cpf = true, que equivale a 1.
            const limiteCpf = Number(tipo.limite_por_cpf) || (tipo.limite_um_por_cpf ? 1 : 0);
            if (limiteCpf > 0) {
                const compradorRows = await db.query(
                    "SELECT cpf FROM usuarios WHERE id = ?",
                    [usuario_id]
                );
                const cpfComprador = compradorRows[0]?.cpf;

                if (!cpfComprador || !String(cpfComprador).replace(/\D/g, "")) {
                    return res.status(400).json({
                        erro: "Para retirar este ingresso, cadastre seu CPF no seu perfil."
                    });
                }

                const jaRetiradosRows = await db.query(`
                    SELECT COALESCE(SUM(v.quantidade), 0) AS total
                    FROM vendas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    WHERE v.ingresso_id = ?
                      AND u.cpf = ?
                      AND v.status IN ('aprovado', 'cortesia')
                `, [tipo.id, cpfComprador]);
                const jaRetirados = Number(jaRetiradosRows[0]?.total) || 0;

                if (jaRetirados + Number(item.quantidade) > limiteCpf) {
                    const restam = Math.max(0, limiteCpf - jaRetirados);
                    return res.status(409).json({
                        erro: restam === 0
                            ? `Este CPF já retirou o limite de ${limiteCpf} ingresso(s) de "${tipo.titulo}".`
                            : `Cada CPF pode retirar até ${limiteCpf} ingresso(s) de "${tipo.titulo}". Você ainda pode retirar ${restam}.`
                    });
                }
            }
            valor_total += ehCortesia ? 0 : parseFloat(tipo.valor) * item.quantidade;
            detalhes.push({ tipo, quantidade: item.quantidade, assentoIds });
        }

        // Ingresso gratuito (valor 0): não exige forma de pagamento,
        // igual à cortesia. Só compra paga de verdade precisa validar isso.
        const ehGratuito = valor_total === 0;

        if (!ehCortesia && !ehGratuito) {
            const formasValidas = ["credito", "debito", "boleto", "pix"];
            if (!formasValidas.includes(forma_pagamento)) {
                return res.status(400).json({ erro: "Forma de pagamento inválida." });
            }
        }

        const status_pagamento = ehCortesia ? "cortesia" : (ehGratuito ? "aprovado" : simularPagamento(forma_pagamento));
        const formaFinal = ehCortesia ? "cortesia" : (ehGratuito ? "gratuito" : forma_pagamento);

        // Pedido + todas as linhas de venda + assentos vendidos entram na MESMA
        // transação. Se qualquer passo falhar (inclusive uma reserva expirada),
        // o pedido inteiro é revertido — nunca fica pedido "órfão" sem venda.
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

                if (d.assentoIds.length) {
                    await venderAssentosReservados(tx, {
                        ingressoId: d.tipo.id,
                        assentoIds: d.assentoIds,
                        usuarioId: usuario_id,
                        pedidoId: novoPedidoId,
                    });
                }
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
                    }).catch(e => console.error("Erro ao enviar e-mail:", e.message));
                }
            } catch (e) {
                console.error("Erro ao buscar dados para e-mail:", e.message);
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
        // Erros de regra lançados dentro da transação (assento vendido, reserva expirada...)
        if (err.status) return res.status(err.status).json({ erro: err.message });
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
// TIPOS DE INGRESSO — AUXILIARES (dashboard do produtor)
// ====================================================
function erroHttp(status, mensagem) {
    const e = new Error(mensagem);
    e.status = status;
    return e;
}

// Inteiro >= 1.
// undefined = campo não enviado (mantém o valor atual); null/"" = limpar; senão valida.
function intOuNull(valor, nome) {
    if (valor === undefined) return undefined;
    if (valor === null || valor === "") return null;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1) {
        throw erroHttp(400, `${nome} precisa ser um número inteiro de 1 ou mais.`);
    }
    return n;
}

// Garante que o evento existe e é do usuário logado.
async function buscarEventoDoUsuario(eventoId, usuarioId) {
    const rows = await db.query(
        "SELECT id, usuario_id, tipo_mapa, mapa_config FROM eventos WHERE id = ?",
        [eventoId]
    );
    const evento = rows[0];
    if (!evento) throw erroHttp(404, "Evento não encontrado.");
    if (String(evento.usuario_id) !== String(usuarioId)) {
        throw erroHttp(403, "Você não tem permissão para alterar os ingressos deste evento.");
    }
    return evento;
}

// Valida o setor escolhido contra o mapa do evento.
//  - nenhum      -> sempre null
//  - imagem      -> precisa ser uma das chaves em mapa_config.setores
//  - ilustrativo -> exige um setor, mas as chaves dos templates ficam no front
function resolverSetorMapa(evento, setorEnviado) {
    const tipoMapa = evento.tipo_mapa || "nenhum";
    if (tipoMapa === "nenhum") return null;

    const setor = typeof setorEnviado === "string" ? setorEnviado.trim() : "";
    if (!setor) throw erroHttp(400, "Escolha o setor do mapa para este ingresso.");

    if (tipoMapa === "imagem") {
        let cfg = evento.mapa_config;
        if (typeof cfg === "string") {
            try { cfg = JSON.parse(cfg); } catch { cfg = null; }
        }
        const chaves = (cfg?.setores || []).map(s => s.chave);
        if (!chaves.includes(setor)) {
            throw erroHttp(400, `O setor "${setor}" não existe no mapa deste evento.`);
        }
    }
    return setor;
}

function validarJanelaVenda(inicio, fim) {
    if (inicio && fim && new Date(inicio) >= new Date(fim)) {
        throw erroHttp(400, "O início das vendas precisa ser antes do fim.");
    }
}

// ====================================================
// TIPOS DE INGRESSO — LISTAR (com vendidos/cortesia/receita por tipo)
// GET /ingressos/tipos/:evento_id
// Usado pelo modal "Gerenciar ingressos" do dashboard.
// ====================================================
async function listarTiposIngresso(req, res) {
    const { evento_id } = req.params;
    if (!evento_id) {
        return res.status(400).json({ erro: "evento_id não informado." });
    }

    try {
        const linhas = await db.query(`
            SELECT
                i.id, i.evento_id, i.titulo, i.tipo, i.valor, i.quantidade_total,
                i.ativo, i.data_inicio_venda, i.data_fim_venda,
                i.setor_mapa, i.tipo_selecao, i.fileiras, i.assentos_por_fileira,
                i.limite_por_cpf, i.limite_um_por_cpf, i.quantidade_min_por_compra,
                COALESCE(SUM(CASE WHEN v.status = 'aprovado' THEN v.quantidade ELSE 0 END), 0) AS vendidos,
                COALESCE(SUM(CASE WHEN v.status = 'cortesia' THEN v.quantidade ELSE 0 END), 0) AS cortesia,
                COALESCE(SUM(CASE WHEN v.status = 'aprovado' THEN v.valor_total ELSE 0 END), 0) AS receita
            FROM ingressos i
            LEFT JOIN vendas v ON v.ingresso_id = i.id
            WHERE i.evento_id = ?
            GROUP BY i.id, i.evento_id, i.titulo, i.tipo, i.valor, i.quantidade_total,
                     i.ativo, i.data_inicio_venda, i.data_fim_venda,
                     i.setor_mapa, i.tipo_selecao, i.fileiras, i.assentos_por_fileira,
                     i.limite_por_cpf, i.limite_um_por_cpf, i.quantidade_min_por_compra
            ORDER BY i.id ASC
        `, [evento_id]);

        // Ingressos antigos só têm limite_um_por_cpf = true, que equivale a limite 1.
        const tipos = linhas.map(({ limite_um_por_cpf, ...t }) => ({
            ...t,
            limite_por_cpf: t.limite_por_cpf ?? (limite_um_por_cpf ? 1 : null),
        }));

        res.json(tipos);
    } catch (err) {
        console.error("Erro ao listar tipos de ingresso:", err);
        res.status(500).json({ erro: "Erro ao listar tipos de ingresso.", detalhe: err.message });
    }
}

// ====================================================
// TIPOS DE INGRESSO — CRIAR
// POST /ingressos/tipos  (exige login; evento precisa ser do usuário)
// body: { evento_id, titulo, valor, quantidade_total, ativo,
//         data_inicio_venda, data_fim_venda, setor_mapa,
//         limite_por_cpf, quantidade_min_por_compra,
//         tipo_selecao ("livre"|"numerado"), fileiras, assentos_por_fileira }
//
// Ingresso numerado: quantidade_total = fileiras x assentos_por_fileira e a
// grade de assentos é gerada na mesma transação do INSERT.
// O campo "tipo" é definido aqui (pago/gratuito) a partir do valor.
// ====================================================
async function criarTipoIngresso(req, res) {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const {
        evento_id, titulo, valor, quantidade_total, ativo,
        data_inicio_venda, data_fim_venda, setor_mapa,
        limite_por_cpf, quantidade_min_por_compra,
        tipo_selecao, fileiras, assentos_por_fileira,
    } = req.body;

    const tituloLimpo = typeof titulo === "string" ? titulo.trim() : "";
    if (!evento_id || !tituloLimpo || valor == null) {
        return res.status(400).json({ erro: "Dados incompletos para criar o tipo de ingresso." });
    }

    try {
        const evento = await buscarEventoDoUsuario(evento_id, usuarioId);

        const valorNum = parseFloat(valor);
        if (!Number.isFinite(valorNum) || valorNum < 0) throw erroHttp(400, "Valor inválido.");

        const numerado = tipo_selecao === "numerado";
        let qtdFileiras = null;
        let qtdAssentos = null;
        let total;

        if (numerado) {
            qtdFileiras = intOuNull(fileiras, "Fileiras");
            qtdAssentos = intOuNull(assentos_por_fileira, "Assentos por fileira");
            if (!qtdFileiras || !qtdAssentos) {
                throw erroHttp(400, "Informe as fileiras e os assentos por fileira.");
            }
            total = qtdFileiras * qtdAssentos;
        } else {
            total = parseInt(quantidade_total, 10);
            if (!Number.isInteger(total) || total < 1) {
                throw erroHttp(400, "A quantidade total precisa ser 1 ou mais.");
            }
        }

        const limiteCpf = intOuNull(limite_por_cpf, "Limite por CPF") ?? null;
        const qtdMin = intOuNull(quantidade_min_por_compra, "Quantidade mínima") ?? null;
        if (limiteCpf && qtdMin && qtdMin > limiteCpf) {
            throw erroHttp(400, "A quantidade mínima não pode ser maior que o limite por CPF.");
        }

        const inicioFinal = data_inicio_venda || null;
        const fimFinal = data_fim_venda || null;
        validarJanelaVenda(inicioFinal, fimFinal);

        const setorFinal = resolverSetorMapa(evento, setor_mapa);
        const ativoFinal = ativo === false ? false : true;
        const tipoFinal = valorNum > 0 ? "pago" : TIPO_GRATUITO;

        const novoId = await db.transacao(async (tx) => {
            const r = await tx.query(
                `INSERT INTO ingressos
                    (evento_id, titulo, tipo, valor, quantidade_total, ativo,
                     data_inicio_venda, data_fim_venda, setor_mapa,
                     tipo_selecao, fileiras, assentos_por_fileira,
                     limite_por_cpf, quantidade_min_por_compra)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    evento_id, tituloLimpo, tipoFinal, valorNum, total, ativoFinal,
                    inicioFinal, fimFinal, setorFinal,
                    numerado ? "numerado" : "livre", qtdFileiras, qtdAssentos,
                    limiteCpf, qtdMin,
                ]
            );
            const id = r.insertId ?? r[0]?.id;
            if (!id) throw new Error("Não foi possível obter o id do novo ingresso.");

            if (numerado) {
                await gerarAssentosParaIngresso(tx, id, qtdFileiras, qtdAssentos);
            }
            return id;
        });

        res.status(201).json({
            id: novoId,
            evento_id,
            titulo: tituloLimpo,
            tipo: tipoFinal,
            valor: valorNum,
            quantidade_total: total,
            ativo: ativoFinal,
            data_inicio_venda: inicioFinal,
            data_fim_venda: fimFinal,
            setor_mapa: setorFinal,
            tipo_selecao: numerado ? "numerado" : "livre",
            fileiras: qtdFileiras,
            assentos_por_fileira: qtdAssentos,
            limite_por_cpf: limiteCpf,
            quantidade_min_por_compra: qtdMin,
            vendidos: 0,
            cortesia: 0,
            receita: 0,
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ erro: err.message });
        console.error("Erro ao criar tipo de ingresso:", err);
        res.status(500).json({ erro: "Erro ao criar tipo de ingresso.", detalhe: err.message });
    }
}

// ====================================================
// TIPOS DE INGRESSO — EDITAR
// PUT /ingressos/tipos/:id  (exige login; evento precisa ser do usuário)
// body (todos opcionais; o que não vier é mantido como está):
//   { titulo, valor, quantidade_total, ativo, data_inicio_venda, data_fim_venda,
//     setor_mapa, limite_por_cpf, quantidade_min_por_compra }
//
// Regras:
//  - quantidade_total não pode ficar abaixo do que já foi vendido/cortesia
//  - ingresso numerado: a quantidade vem da grade de assentos, então não muda aqui
//  - tipo_selecao, fileiras e assentos_por_fileira não são alterados aqui
//  - o campo "tipo" é recalculado a partir do valor (pago/gratuito); o texto
//    enviado pelo cliente é ignorado
//  - limite_por_cpf null remove o limite (inclusive o limite_um_por_cpf antigo)
// ====================================================
async function atualizarTipoIngresso(req, res) {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { id } = req.params;
    const {
        titulo, valor, quantidade_total, ativo,
        data_inicio_venda, data_fim_venda, setor_mapa,
        limite_por_cpf, quantidade_min_por_compra,
    } = req.body;

    try {
        const rows = await db.query("SELECT * FROM ingressos WHERE id = ?", [id]);
        const atual = rows[0];
        if (!atual) return res.status(404).json({ erro: "Tipo de ingresso não encontrado." });

        const evento = await buscarEventoDoUsuario(atual.evento_id, usuarioId);

        // título
        let tituloFinal = atual.titulo;
        if (titulo !== undefined) {
            tituloFinal = typeof titulo === "string" ? titulo.trim() : "";
            if (!tituloFinal) throw erroHttp(400, "Dê um nome para o tipo de ingresso.");
        }

        // valor + tipo (pago/gratuito)
        let valorFinal = Number(atual.valor);
        if (valor !== undefined && valor !== null && valor !== "") {
            valorFinal = parseFloat(valor);
            if (!Number.isFinite(valorFinal) || valorFinal < 0) throw erroHttp(400, "Valor inválido.");
        }
        let tipoFinal = atual.tipo;
        if (valorFinal > 0) tipoFinal = "pago";
        else if (atual.tipo === "pago") tipoFinal = TIPO_GRATUITO;

        // quantidade total
        const ocupadosRows = await db.query(`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM vendas
            WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')
        `, [id]);
        const jaOcupados = Number(ocupadosRows[0]?.total) || 0;

        const novoTotal = quantidade_total != null && quantidade_total !== ""
            ? parseInt(quantidade_total, 10)
            : Number(atual.quantidade_total);
        if (!Number.isInteger(novoTotal) || novoTotal < 0) throw erroHttp(400, "Quantidade total inválida.");

        if (atual.tipo_selecao === "numerado" && novoTotal !== Number(atual.quantidade_total)) {
            throw erroHttp(400, "Neste ingresso numerado a quantidade é definida pela grade de assentos e não pode ser alterada aqui.");
        }
        if (novoTotal < jaOcupados) {
            throw erroHttp(400, `Quantidade total não pode ser menor que o já ocupado (${jaOcupados} ingressos entre vendidos e cortesia).`);
        }

        // período de vendas e venda ativa
        const ativoFinal = ativo != null ? !!ativo : atual.ativo;
        const inicioFinal = data_inicio_venda !== undefined ? (data_inicio_venda || null) : atual.data_inicio_venda;
        const fimFinal = data_fim_venda !== undefined ? (data_fim_venda || null) : atual.data_fim_venda;
        validarJanelaVenda(inicioFinal, fimFinal);

        // setor do mapa
        const setorFinal = setor_mapa === undefined
            ? atual.setor_mapa
            : resolverSetorMapa(evento, setor_mapa);

        // regras por pessoa
        const limiteNovo = intOuNull(limite_por_cpf, "Limite por CPF");
        const minNovo = intOuNull(quantidade_min_por_compra, "Quantidade mínima");
        const limiteFinal = limiteNovo === undefined ? atual.limite_por_cpf : limiteNovo;
        const minFinal = minNovo === undefined ? atual.quantidade_min_por_compra : minNovo;
        if (limiteFinal && minFinal && Number(minFinal) > Number(limiteFinal)) {
            throw erroHttp(400, "A quantidade mínima não pode ser maior que o limite por CPF.");
        }
        // Se o produtor mexeu no limite, o flag antigo "1 por CPF" deixa de valer.
        const umPorCpfFinal = limiteNovo === undefined ? atual.limite_um_por_cpf : false;

        await db.query(
            `UPDATE ingressos SET
                titulo = ?, tipo = ?, valor = ?, quantidade_total = ?, ativo = ?,
                data_inicio_venda = ?, data_fim_venda = ?, setor_mapa = ?,
                limite_por_cpf = ?, limite_um_por_cpf = ?, quantidade_min_por_compra = ?
             WHERE id = ?`,
            [
                tituloFinal, tipoFinal, valorFinal, novoTotal, ativoFinal,
                inicioFinal, fimFinal, setorFinal,
                limiteFinal ?? null, umPorCpfFinal ?? null, minFinal ?? null,
                id,
            ]
        );

        res.json({ mensagem: "Tipo de ingresso atualizado com sucesso." });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ erro: err.message });
        console.error("Erro ao atualizar tipo de ingresso:", err);
        res.status(500).json({ erro: "Erro ao atualizar tipo de ingresso.", detalhe: err.message });
    }
}
// ====================================================
// TIPOS DE INGRESSO — EXCLUIR
// DELETE /ingressos/tipos/:id  (exige login; evento precisa ser do usuário)
//
// Bloqueia exclusão se já existir venda aprovada ou cortesia
// vinculada a esse tipo, pra não perder o histórico.
// ====================================================
async function excluirTipoIngresso(req, res) {
    const usuarioId = req.usuario?.id;
    if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

    const { id } = req.params;

    try {
        const rows = await db.query("SELECT evento_id FROM ingressos WHERE id = ?", [id]);
        if (!rows[0]) return res.status(404).json({ erro: "Tipo de ingresso não encontrado." });
        await buscarEventoDoUsuario(rows[0].evento_id, usuarioId);

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
        if (err.status) return res.status(err.status).json({ erro: err.message });
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