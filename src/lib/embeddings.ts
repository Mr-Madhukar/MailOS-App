import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Generates a 1536-dimensional vector embedding for the given text.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY is not defined. Returning mock embedding.");
    return new Array(1536).fill(0);
  }

  try {
    const { embedding } = await embed({
      model: openrouter.textEmbeddingModel("openai/text-embedding-3-small"),
      value: text.replace(/\n/g, " "),
    });

    return embedding;
  } catch (error) {
    console.error("Failed to generate embedding via OpenRouter:", error);
    // Return a mock embedding (zeros) so that the database doesn't crash on null/invalid vectors
    return new Array(1536).fill(0);
  }
}
