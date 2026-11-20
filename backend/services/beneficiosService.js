"use strict";

const db = require("../db/db_config");

// ====================================================
// BENEFÍCIO DE BOAS-VINDAS (regra OFICIAL, no backend)
// O front (Frontend/js/beneficios.js) só exibe o valor; quem vale é este cálculo.
// Mantenha REGRA igual a REGRAS[0] do Frontend/js/beneficios.js.
//
// Regra: só na 1ª compra paga do usuário (e do CPF):
//   15% de desconto em 1 ingresso + taxa de serviço grátis nesse ingresso.
// ====================================================
const TAXA_SERVICO = 0.10;
const REGRA = { percentual: 0.15, ingressos: 1, taxaZero: true };
const TIPO_BENEFICIO = "boas_vindas";

const PEDIDO_ZERO = Object.freeze({
    subtotal: 0, desconto: 0, taxa: 0, taxaDispensada: 0, total: 0, aplicou: false,
});

const arredondar = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
const ehMeia = (titulo) => /meia/i.test(titulo || "");

// Pedidos pagos (valor > 0 e não cancelados) do usuário ou de qualquer conta com o mesmo CPF
async function contarComprasPagas(usuarioId, cpf) {
    const filtroCpf = cpf
        ? " OR REPLACE(REPLACE(REPLACE(u.cpf, '.', ''), '-', ''), ' ', '') = ?"
        : "";
    const params = cpf ? [usuarioId, cpf] : [usuarioId];

    const rows = await db.query(`
        SELECT COUNT(DISTINCT p.id) AS total
        FROM pedidos p
        JOIN usuarios u ON u.id = p.usuario_id
        WHERE (p.usuario_id = ?${filtroCpf})
          AND p.valor_total > 0
          AND LOWER(p.status) NOT IN ('cancelado', 'cancelada', 'estornado', 'expirado')
    `, params);

    return Number(rows[0]?.total) || 0;
}

// O usuário ainda tem direito ao benefício?
// Devolve { disponivel, motivo, cpf, comprasPagas }
async function situacaoBeneficio(usuarioId) {
    const usuarioRows = await db.query("SELECT cpf FROM usuarios WHERE id = ?", [usuarioId]);
    const cpfDigitos = soDigitos(usuarioRows[0]?.cpf);
    const cpf = cpfDigitos.length === 11 ? cpfDigitos : null;

    const comprasPagas = await contarComprasPagas(usuarioId, cpf);

    // Sem CPF no perfil não dá para barrar abuso: sem benefício
    if (!cpf) return { disponivel: false, motivo: "sem_cpf", cpf: null, comprasPagas };

    // Quem já comprou antes (sem benefício) perde o direito: vale só na 1ª compra
    if (comprasPagas > 0) return { disponivel: false, motivo: "ja_comprou", cpf, comprasPagas };

    const usados = await db.query(
        "SELECT id FROM beneficios_usados WHERE tipo = ? AND (usuario_id = ? OR cpf = ?) LIMIT 1",
        [TIPO_BENEFICIO, usuarioId, cpf]
    );
    if (usados.length) return { disponivel: false, motivo: "ja_usado", cpf, comprasPagas };

    return { disponivel: true, motivo: null, cpf, comprasPagas };
}

// Cálculo do pedido. detalhes = [{ tipo, quantidade }] (mesmo formato do comprarIngresso).
// O desconto vale para 1 ingresso só (o primeiro item pago que não seja meia-entrada).
function calcularPedido(detalhes, elegivel) {
    const subtotal = arredondar(
        detalhes.reduce((soma, d) => soma + Number(d.tipo.valor) * d.quantidade, 0)
    );

    const itemBeneficio = elegivel
        ? detalhes.find(d => Number(d.tipo.valor) > 0 && !ehMeia(d.tipo.titulo)) || null
        : null;

    let desconto = 0;
    let taxaDispensada = 0;
    if (itemBeneficio) {
        const preco = Number(itemBeneficio.tipo.valor);
        const qtdBeneficio = Math.min(itemBeneficio.quantidade, REGRA.ingressos);
        desconto = arredondar(preco * qtdBeneficio * REGRA.percentual);
        taxaDispensada = REGRA.taxaZero ? arredondar(preco * qtdBeneficio * TAXA_SERVICO) : 0;
    }

    const taxa = arredondar(subtotal * TAXA_SERVICO - taxaDispensada);
    const total = arredondar(subtotal - desconto + taxa);

    return { subtotal, desconto, taxa, taxaDispensada, total, aplicou: !!itemBeneficio };
}

// Grava o uso do benefício. Chamar DENTRO da transação da compra.
// Se a chave única barrar (benefício já usado, ex.: duas compras simultâneas),
// o erro 23505 (PostgreSQL) sobe e o comprarIngresso devolve 409 e reverte o pedido.
async function registrarUso(tx, { usuarioId, cpf, pedidoId, calculo }) {
    await tx.query(
        `INSERT INTO beneficios_usados
            (tipo, usuario_id, cpf, pedido_id, percentual, desconto, taxa_dispensada)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [TIPO_BENEFICIO, usuarioId, cpf, pedidoId, REGRA.percentual, calculo.desconto, calculo.taxaDispensada]
    );
    return true;
}

module.exports = {
    REGRA,
    PEDIDO_ZERO,
    situacaoBeneficio,
    calcularPedido,
    registrarUso,
};
