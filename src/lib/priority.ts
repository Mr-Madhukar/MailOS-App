import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Uses a fast LLM to classify an email's priority into "high", "med", or "low".
 */
export async function classifyEmailPriority(
  from: string,
  subject: string,
  snippet: string,
  body?: string
): Promise<"high" | "med" | "low"> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY not configured, using fallback priority classifier");
    return fallbackPriority(from, subject, snippet);
  }

  const contentToAnalyze = `
Sender: ${from}
Subject: ${subject}
Snippet: ${snippet}
${body ? `Body: ${body.slice(0, 1000)}` : ""}
`;

  try {
    const response = await generateText({
      model: openrouter("google/gemma-2-9b-it:free"),
      prompt: `You are an email priority classifier. Analyze the following email and determine its priority level.
Return ONLY one of these three words: "high", "med", or "low".
Do not include any other text, reasoning, or punctuation.

Email:
${contentToAnalyze}
`,
      maxTokens: 5,
      temperature: 0.1,
    } as any);

    const priority = response.text.trim().toLowerCase();
    if (priority.includes("high")) return "high";
    if (priority.includes("med") || priority.includes("medium")) return "med";
    return "low";
  } catch (error) {
    console.error("LLM priority classification failed:", error);
    return fallbackPriority(from, subject, snippet);
  }
}

function fallbackPriority(from: string, subject: string, snippet: string): "high" | "med" | "low" {
  const textToAnalyze = `${from} ${subject} ${snippet}`.toLowerCase();
  if (
    textToAnalyze.includes("urgent") ||
    textToAnalyze.includes("action required") ||
    textToAnalyze.includes("important") ||
    textToAnalyze.includes("security alert")
  ) {
    return "high";
  } else if (
    textToAnalyze.includes("review") ||
    textToAnalyze.includes("roadmap") ||
    textToAnalyze.includes("meeting") ||
    textToAnalyze.includes("sync")
  ) {
    return "med";
  }
  return "low";
}
