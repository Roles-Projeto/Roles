const LIMITE_BLOQUEIO = 0.80;
const LIMITE_REVISAO = 0.50;

// ─── Classifica o resultado da análise de IMAGEM ───────────────────────────
//
// LIMITAÇÃO CONHECIDA: a Sightengine não tem uma categoria oficial e
// documentada específica pra "bestialidade" (conteúdo sexual envolvendo
// animais). O modelo de nudez é treinado majoritariamente pra corpo
// humano. Pode pegar casos extremos por acaso (via sexual_activity), mas
// não há garantia de cobertura pra essa categoria. Se isso virar um
// problema real na prática, vale considerar uma segunda camada de
// verificação (ex: revisão manual, ou outro serviço especializado).
function classificarImagem(resultado) {
    if (!resultado) {
        throw new Error('Resultado da análise de imagem não informado.');
    }

    const nudity = resultado.nudity || {};
    const gore = resultado.gore || {};
    const weapon = resultado.weapon || {};
    const offensive = resultado.offensive || {};
    const weaponClasses = weapon.classes || {};
    const suggestiveClasses = nudity.suggestive_classes || {};

    // Regra rigorosa: qualquer nudez explícita OU conteúdo sugestivo
    // (biquíni, lingerie, cueca, minissaia, etc) conta pro score. Isso
    // inclui "mildly_suggestive", que antes tínhamos deixado de fora —
    // agora entra porque a intenção é barrar até fotos "só sugestivas"
    // tipo biquíni de praia.
    const sexualScore = Math.max(
        nudity.sexual_activity || 0,
        nudity.sexual_display || 0,
        nudity.erotica || 0,
        nudity.very_suggestive || 0,
        nudity.suggestive || 0,
        nudity.mildly_suggestive || 0,
        suggestiveClasses.bikini || 0,
        suggestiveClasses.lingerie || 0,
        suggestiveClasses.male_underwear || 0,
        suggestiveClasses.male_chest || 0,
        suggestiveClasses.miniskirt || 0,
        suggestiveClasses.minishort || 0,
        suggestiveClasses.swimwear_male || 0,
        suggestiveClasses.swimwear_one_piece || 0,
        suggestiveClasses.visibly_undressed || 0,
        suggestiveClasses.sextoy || 0
    );

    const goreScore = gore.prob || 0;

    // 'weapon' não tem "prob" agregado — só "classes". Usamos firearm/knife
    // (arma real); "firearm_gesture" (gesto) e "firearm_toy" (brinquedo)
    // ficam de fora de propósito, pra não bloquear fotos inofensivas.
    const weaponScore = Math.max(
        weaponClasses.firearm || 0,
        weaponClasses.knife || 0
    );

    const offensiveScore = offensive.prob || 0;

    const maiorScore = Math.max(sexualScore, goreScore, weaponScore, offensiveScore);

    if (maiorScore >= LIMITE_BLOQUEIO) return 'BLOQUEADA';
    if (maiorScore >= LIMITE_REVISAO) return 'REVISAO';
    return 'APROVADA';
}

// ─── Classifica o resultado da análise de TEXTO ────────────────────────────
// O endpoint de texto não devolve um score numérico como o de imagem — ele
// devolve, por categoria, uma lista de "matches" com uma "intensity"
// (low/medium/high). Regra adotada aqui:
//   - qualquer match de intensidade "high"          -> BLOQUEADA
//   - qualquer outro match (low/medium, ou sem       -> REVISAO
//     intensidade, ex: weapon/drug/violence/self-harm)
//   - nenhum match em nenhuma categoria              -> APROVADA
const TEXTO_CATEGORIAS = ['profanity', 'weapon', 'drug', 'extremism', 'violence', 'self-harm'];

function classificarTexto(resultado) {
    if (!resultado) {
        throw new Error('Resultado da análise de texto não informado.');
    }

    const matches = TEXTO_CATEGORIAS.flatMap(categoria =>
        (resultado[categoria]?.matches || []).map(m => ({ categoria, ...m }))
    );

    if (matches.length === 0) return 'APROVADA';

    const temAltaIntensidade = matches.some(m => m.intensity === 'high');
    if (temAltaIntensidade) return 'BLOQUEADA';

    return 'REVISAO';
}

module.exports = {
    classificarImagem,
    classificarTexto
};