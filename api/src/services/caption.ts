import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

function getClient(): OpenAI {
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY não configurada. Defina a variável de ambiente na API.");
  }
  return new OpenAI({ apiKey: apiKey.trim() });
}

/**
 * Gera caption para Instagram a partir da descrição do usuário.
 * Tudo no nosso sistema — sem n8n.
 */
export async function gerarCaption(descricao: string, mediaType?: "IMAGE" | "REELS"): Promise<string> {
  const openai = getClient();
  const tipo = mediaType === "REELS" ? "Reels (vídeo)" : "post de imagem";
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é um redator de redes sociais. Gere legendas para Instagram em português do Brasil.
Regras: texto envolvente e profissional; inclua 5 a 10 hashtags relevantes no final, separadas por espaço; não repita a descrição literalmente — use como base para criar uma legenda atrativa; tom adequado para negócios/imóveis/marketing.`,
      },
      {
        role: "user",
        content: `Gere a legenda para um ${tipo} no Instagram com base nesta descrição:\n\n${descricao}`,
      },
    ],
    max_tokens: 500,
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Resposta vazia da IA.");
  return text;
}

/**
 * Refaz o caption com base no feedback do usuário.
 * Tudo no nosso sistema — sem n8n.
 */
export async function refazerCaption(captionAtual: string, feedback: string): Promise<string> {
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você ajusta legendas de Instagram conforme o feedback do usuário. Mantenha o tom e o estilo; aplique exatamente o que o usuário pediu; devolva só a nova legenda com hashtags, sem explicação.`,
      },
      {
        role: "user",
        content: `Legenda atual:\n${captionAtual}\n\nPedido do usuário: ${feedback}\n\nNova legenda:`,
      },
    ],
    max_tokens: 500,
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Resposta vazia da IA.");
  return text;
}
