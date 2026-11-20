/* ═══════════════════════════════════════════════════════════
   BENEFÍCIO DE BOAS-VINDAS (front: só EXIBE o valor)
   Quem vale de verdade é o cálculo do backend
   (backend/services/beneficiosService.js, chamado no comprarIngresso).
   Mantenha REGRAS[0] igual a REGRA daquele arquivo.

   Regra: só na 1ª compra paga do usuário (e do CPF):
     15% de desconto em 1 ingresso + taxa de serviço grátis nesse ingresso.

   Este arquivo não declara nada solto no escopo global (tudo fica dentro
   da função abaixo), para não conflitar com o detalhesEventos.js.
   Só expõe: window.Beneficios
═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var TAXA = 0.10; // taxa de serviço (igual ao backend)

    var REGRAS = [
        {
            id: 'boas_vindas',
            comprasPagas: 0,   // vale quando o usuário ainda não fez nenhuma compra paga
            percentual: 0.15,  // 15% de desconto
            ingressos: 1,      // em 1 ingresso só
            taxaZero: true     // e sem taxa de serviço nesse ingresso
        }
    ];

    function arredondar(n) {
        return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    }

    // Descobre qual regra se aplica (ou null)
    function regraAplicavel(comprasPagas, elegivel) {
        if (!elegivel) return null;
        var n = Number(comprasPagas);
        if (!isFinite(n)) return null;
        for (var i = 0; i < REGRAS.length; i++) {
            if (REGRAS[i].comprasPagas === n) return REGRAS[i];
        }
        return null;
    }

    /*
      calcularPedido({ precoUnitario, quantidade, comprasPagas, elegivel })
      Devolve:
        { subtotal, desconto, taxa, taxaDispensada, total, beneficio }
      "beneficio" é a regra aplicada (com .percentual) ou null.
    */
    function calcularPedido(dados) {
        dados = dados || {};
        var preco = Number(dados.precoUnitario) || 0;
        var qtd = Math.max(1, parseInt(dados.quantidade, 10) || 1);

        var subtotal = arredondar(preco * qtd);
        var regra = preco > 0 ? regraAplicavel(dados.comprasPagas, dados.elegivel) : null;

        var desconto = 0;
        var taxaDispensada = 0;
        if (regra) {
            var qtdBeneficio = Math.min(qtd, regra.ingressos);
            desconto = arredondar(preco * qtdBeneficio * regra.percentual);
            taxaDispensada = regra.taxaZero ? arredondar(preco * qtdBeneficio * TAXA) : 0;
        }

        var taxa = arredondar(subtotal * TAXA - taxaDispensada);
        var total = arredondar(subtotal - desconto + taxa);

        return {
            subtotal: subtotal,
            desconto: desconto,
            taxa: taxa,
            taxaDispensada: taxaDispensada,
            total: total,
            beneficio: regra
        };
    }

    window.Beneficios = {
        TAXA_SERVICO: TAXA,
        REGRAS: REGRAS,
        calcularPedido: calcularPedido
    };
})();