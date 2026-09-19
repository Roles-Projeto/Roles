/**
 * =====================================================
 *  ROLÊS — rota do assistente de chat (Anthropic API)
 *
 *  Exposta em: POST /api/chat  (montada em server.js via app.use("/api", chatRoutes))
 *
 *  Requer no .env da raiz do backend:
 *    ANTHROPIC_API_KEY=sua_chave_aqui
 * =====================================================
 */

const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Você é o assistente virtual do Rolês, um app que ajuda
usuários a descobrir eventos, atrações culturais e opções de entretenimento
com segurança e praticidade. Responda de forma amigável, objetiva e sempre
em português. Se não souber uma informação específica sobre um evento real,
avise o usuário que não tem esse dado em tempo real.`;

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensagens inválidas." });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages, // [{ role: "user"|"assistant", content: "..." }, ...]
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    res.json({ reply });
  } catch (err) {
    console.error("Erro na API da Anthropic:", err);
    res.status(500).json({ error: "Erro ao processar a mensagem." });
  }
});

module.exports = router;