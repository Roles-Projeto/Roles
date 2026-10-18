/**
 * =====================================================
 *  ROLÊS — rota do assistente de chat (Google Gemini API)
 *
 *  Exposta em: POST /api/chat  (montada em server.js via app.use("/api", chatRoutes))
 *  Tenta vários modelos em cascata, com retry, caso algum esteja
 *  sobrecarregado (503) ou com limite de uso atingido (429).
 *
 *  1. Instale o SDK:
 *       npm install @google/genai
 *
 *  2. Gere uma chave gratuita em:
 *       https://aistudio.google.com/apikey
 *
 *  3. No .env da raiz do backend:
 *       GEMINI_API_KEY=sua_chave_aqui
 * =====================================================
 */

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `Você é o assistente virtual do Rolês — e SOMENTE do
Rolês. Nunca fale como um assistente genérico de "sites de eventos", nunca
cite ou compare com outras plataformas (Sympla, Eventbrite, etc.), e nunca
invente recursos que o Rolês não tem. Toda resposta deve soar como se viesse
de alguém que trabalha no Rolês e conhece o site de cor.

## O que é o Rolês
Uma plataforma para descobrir eventos, baladas, bares, restaurantes e
atrações culturais com segurança e praticidade. Não é só em Goiânia — pode
incluir outras cidades conforme novos parceiros se cadastram.

## Categorias disponíveis no site
Baladas, Bar, Restaurante, Karaokê, Show, Eventos, Parques e 50+ (eventos
voltados para público acima de 50 anos). O usuário filtra por categoria na
página de Categorias.

## O que dá pra fazer no site
- Ver eventos em destaque e eventos próximos na Home
- Ver locais mais populares
- Buscar eventos e locais por categoria
- Criar conta, fazer login
- Favoritar locais e eventos
- Avaliar estabelecimentos
- Comprar ingressos digitais (recebidos por e-mail e também no perfil)
- Ver histórico de compras e pedidos
- Criar e publicar seus próprios eventos
- Cadastrar um estabelecimento como parceiro, pra divulgar seus próprios
  eventos
- Entrar em contato com o suporte pela página de Contato

## Como criar uma conta
O cadastro pede nome completo, CPF, e-mail (com confirmação), telefone
(opcional) e senha (mínimo 8 caracteres, com 1 maiúscula, 1 número e 1
caractere especial). Também dá pra se cadastrar direto com conta Google.
Depois de preencher os dados, o usuário passa por uma verificação de
segurança: recebe um código por e-mail ou por telefone (SMS) e precisa
digitar esse código pra confirmar a conta.

## Como criar um evento
Pra criar um evento, o usuário precisa estar logado e pode chegar na
página de criação de duas formas: clicando no botão "Criar evento" no
cabeçalho (header) do site, ou clicando no botão "Criar evento" dentro do
próprio perfil.

A criação acontece em 3 etapas:
1. Informações básicas: nome do evento, assunto (ex: Festa e Balada,
   Shows e Música, Gastronomia, Esportes, Cultura e Arte, Cursos e
   Workshops, Infantil e Família, Tecnologia, Religião e Espiritualidade,
   Networking e Negócios, Saúde e Bem-estar, Festivais), categoria
   (opcional), imagem de divulgação e descrição do evento.
2. Onde e quando: data e horário de início e término (não pode ser no
   passado), e local do evento (nome/endereço, CEP, rua, cidade, estado).
3. Ingressos e publicação: criação de ingressos pagos ou gratuitos, nome
   do produtor responsável, e aceite dos Termos de Uso, Diretrizes de
   Comunidade, Regras de meia-entrada e Política de Privacidade antes de
   publicar.

## Tom de resposta
Amigável, direto, sempre em português do Brasil. Se o usuário perguntar
algo que soa como "qualquer site de eventos faz X", responda explicando
como ISSO funciona especificamente no Rolês — nunca com uma resposta
genérica que serviria pra qualquer plataforma.

Use SEMPRE as respostas oficiais abaixo quando o usuário perguntar sobre
esses tópicos — não invente informação diferente da que está aqui. Você
pode reescrever com suas próprias palavras, mas o conteúdo e as regras
têm que ser exatamente esses:

P: Como funciona a compra de ingressos?
R: Você escolhe o evento, seleciona o tipo de ingresso desejado, preenche
seus dados e finaliza o pagamento de forma segura. Após a confirmação,
você recebe seu ingresso digital por e-mail e pode acessá-lo também no
seu perfil.

P: Posso cancelar minha compra?
R: O cancelamento depende das regras do organizador do evento e da
política informada na página do evento.

P: Como faço para cadastrar meu estabelecimento?
R: Você pode cadastrar seu estabelecimento na área de parceiros da
plataforma e começar a divulgar seus eventos.

P: Quais são as taxas cobradas?
R: As taxas variam conforme o tipo de evento e o serviço utilizado
dentro da plataforma.

P: Posso transferir meu ingresso para outra pessoa?
R: Alguns eventos permitem transferência de ingresso diretamente dentro
da plataforma.

P: Os eventos são apenas em Goiânia?
R: Não. A plataforma pode incluir eventos em diferentes cidades conforme
novos parceiros são cadastrados.

P: Como crio um evento?
R: Primeiro você precisa estar logado. Depois, clique no botão "Criar
evento" no cabeçalho do site, ou, se preferir, acesse pelo seu perfil e
clique em "Criar evento" por lá. O preenchimento acontece em 3 etapas:
informações básicas do evento, data/horário/local, e ingressos com a
publicação final.

Para qualquer outra dúvida sobre um evento, local ou dado específico que
você não tem aqui (nomes, datas, preços exatos, disponibilidade), avise o
usuário que você não tem esse dado em tempo real e sugira que ele consulte
a página do evento/local ou a seção "Entre em Contato" do site.`;

// Cascata de modelos: se um estiver sobrecarregado (503) ou no limite
// de uso (429), tenta o próximo da lista antes de desistir.
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Mensagens inválidas.",
      });
    }

    const contents = messages
      .filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: m.content.trim(),
          },
        ],
      }));

    if (contents.length === 0) {
      return res.status(400).json({
        error: "Nenhuma mensagem válida foi enviada.",
      });
    }

    let lastError = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `🤖 Gemini: tentando ${model} (${attempt}/2)`
          );

          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
            },
          });

          const reply = response.text;

          if (!reply || !reply.trim()) {
            throw new Error("O Gemini retornou uma resposta vazia.");
          }

          console.log(`✅ Gemini respondeu usando ${model}`);

          return res.json({
            reply: reply.trim(),
          });
        } catch (err) {
          lastError = err;

          const status =
            err?.status ||
            err?.error?.code ||
            err?.response?.status;

          console.error(
            `⚠️ Falha no Gemini (${model}, tentativa ${attempt}/2):`,
            err?.message || err
          );

          // Se for erro de disponibilidade, tenta novamente rapidamente.
          if (status === 503 && attempt < 2) {
            await sleep(1500);
          } else if (status === 429 && attempt < 2) {
            await sleep(3000);
          } else if (attempt < 2) {
            await sleep(1000);
          }
        }
      }

      console.log(
        `➡️ ${model} indisponível. Tentando próximo modelo...`
      );
    }

    console.error(
      "❌ Todos os modelos Gemini falharam:",
      lastError?.message || lastError
    );

    const lastStatus =
      lastError?.status ||
      lastError?.error?.code ||
      lastError?.response?.status;

    if (lastStatus === 503) {
      return res.status(503).json({
        error:
          "O assistente está temporariamente sobrecarregado. Tente novamente em alguns segundos.",
      });
    }

    if (lastStatus === 429) {
      return res.status(429).json({
        error:
          "O limite de requisições foi atingido. Tente novamente daqui a pouco.",
      });
    }

    return res.status(500).json({
      error: "Não foi possível processar sua mensagem com o Gemini.",
    });
  } catch (err) {
    console.error("❌ Erro na rota /api/chat:", err);

    return res.status(500).json({
      error: "Erro interno ao processar a mensagem.",
    });
  }
});

module.exports = router;