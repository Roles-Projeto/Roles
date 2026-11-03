/* ==================================================
   BENEFÍCIO DE BOAS-VINDAS - Rolês  (arquivo do FRONTEND)
   Salvar na mesma pasta do FinalizarCompra.js e do config.js
   (URL: /frontend/js/beneficios.js)

   Regra atual (só vale para quem NUNCA fez uma compra paga):
   - 15% de desconto em 1 ingresso
   - taxa de serviço zerada nesse mesmo ingresso
   - os demais ingressos da compra pagam preço cheio + taxa de 10%

   Usado por detalhesEventos.js e FinalizarCompra.js:
   window.Beneficios.calcularPedido({ precoUnitario, quantidade, comprasPagas, elegivel })
================================================== */
(function (raiz) {
    "use strict";

    const TAXA_SERVICO = 0.10;

    // Benefícios por número de compras pagas já feitas (0 = primeira compra).
    // Para criar um benefício na 2ª compra, adicione a chave 1.
    const REGRAS = {
        0: { percentual: 0.15, ingressos: 1, taxaZero: true },
    };

    const arredondar = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

    function calcularPedido({ precoUnitario, quantidade, comprasPagas, elegivel }) {
        const preco = Number(precoUnitario) || 0;
        const qtd = Math.max(1, parseInt(quantidade, 10) || 1);
        const subtotal = arredondar(preco * qtd);

        const regra = (elegivel && preco > 0) ? REGRAS[Number(comprasPagas)] : null;

        // Sem benefício: preço cheio + taxa de 10%
        if (!regra) {
            const taxa = arredondar(subtotal * TAXA_SERVICO);
            return {
                subtotal,
                desconto: 0,
                taxa,
                taxaDispensada: 0,
                total: arredondar(subtotal + taxa),
                beneficio: null,
            };
        }

        // Com benefício: só os primeiros "regra.ingressos" ingressos ganham desconto
        const qtdBeneficio = Math.min(qtd, regra.ingressos);
        const desconto = arredondar(preco * qtdBeneficio * regra.percentual);
        const taxaDispensada = regra.taxaZero ? arredondar(preco * qtdBeneficio * TAXA_SERVICO) : 0;
        const taxa = arredondar(preco * (qtd - (regra.taxaZero ? qtdBeneficio : 0)) * TAXA_SERVICO);
        const total = arredondar(subtotal - desconto + taxa);

        return {
            subtotal,
            desconto,
            taxa,
            taxaDispensada,
            total,
            beneficio: { percentual: regra.percentual, ingressos: regra.ingressos },
        };
    }

    raiz.Beneficios = { calcularPedido, REGRAS, TAXA_SERVICO };
})(window);