/**
 * Contact (Relationship) Intelligence
 *
 * For a given email address:
 * 1. Fetch sent + received threads via Corsair Gmail search
 * 2. Extract interaction timeline, response rate, key topics
 * 3. OpenAI: synthesize relationship summary and recommended next action
 */
import { getInboxService } from "../inbox";
import { createChatCompletion, isOpenAiConfigured } from "./openai";
import { daysSince, extractEmailAddress } from "./daily-brief-time";

export type ContactIntelResult = {
  email: string;
  name?: string;
  totalInteractions: number;
  lastInteractionDaysAgo: number | null;
  lastInteractionDate?: string;
  sentByUser: number;
  receivedFromContact: number;
  /** Estimated response rate 0–1 */
  responseRate: number | null;
  recentTopics: string[];
  relationshipSummary: string;
  recommendedAction: string;
  recentThreads: Array<{ id: string; subject: string; date?: string; direction: "sent" | "received" }>;
};

const SYSTEM_PROMPT = `You are a relationship intelligence assistant. Given email interaction data between a user and a contact, produce:
- relationshipSummary: 1-2 sentences describing the relationship quality, recency, and context
- recommendedAction: 1 clear sentence — what the user should do next with this contact
- recentTopics: array of 2-4 topic keywords from the email subjects

Respond with valid JSON only:
{
  "relationshipSummary": "...",
  "recommendedAction": "...",
  "recentTopics": ["...", "..."]
}`;

type RawThreadItem = { id: string; subject?: string; date?: string; from?: string };

type ContactThreadDirection = RawThreadItem & { direction: "sent" | "received" };

async function fetchContactThreads(
  tenantId: string,
  contactEmail: string,
): Promise<{
  sentThreads: RawThreadItem[];
  receivedThreads: RawThreadItem[];
}> {
  const inbox = getInboxService();
  const status = await inbox.getConnectionStatus(tenantId);
  if (status.gmail !== "connected") {
    return { sentThreads: [], receivedThreads: [] };
  }
  try {
    const [sentResult, receivedResult] = await Promise.all([
      inbox.listThreads(tenantId, {
        query: `to:${contactEmail} in:sent`,
        maxResults: 15,
      }),
      inbox.listThreads(tenantId, {
        query: `from:${contactEmail}`,
        maxResults: 15,
      }),
    ]);
    return {
      sentThreads: sentResult.threads ?? [],
      receivedThreads: receivedResult.threads ?? [],
    };
  } catch {
    return { sentThreads: [], receivedThreads: [] };
  }
}

function mergeAndSortThreads(
  sentThreads: RawThreadItem[],
  receivedThreads: RawThreadItem[],
): ContactThreadDirection[] {
  const seenIds = new Set<string>();
  const allThreads: ContactThreadDirection[] = [];
  for (const t of [
    ...receivedThreads.map((item) => ({ ...item, direction: "received" as const })),
    ...sentThreads.map((item) => ({ ...item, direction: "sent" as const })),
  ]) {
    if (!seenIds.has(t.id)) {
      seenIds.add(t.id);
      allThreads.push(t);
    }
  }
  return allThreads.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

async function synthesizeContactIntel(params: {
  contactName: string;
  contactEmail: string;
  totalInteractions: number;
  sentCount: number;
  receivedCount: number;
  lastInteractionDaysAgo: number | null;
  responseRate: number | null;
  threads: ContactThreadDirection[];
}): Promise<{ relationshipSummary: string; recommendedAction: string; recentTopics: string[] }> {
  let relationshipSummary = `You have exchanged ${params.totalInteractions} emails with ${params.contactName}.`;
  let recommendedAction = `Send a follow-up to ${params.contactName}.`;
  let recentTopics: string[] = [];

  if (!isOpenAiConfigured() || params.totalInteractions === 0) {
    return { relationshipSummary, recommendedAction, recentTopics };
  }

  try {
    const subjectList = params.threads
      .slice(0, 10)
      .map(
        (t, i) =>
          `${i + 1}. [${t.direction}] ${t.subject ?? "(no subject)"} (${t.date ? new Date(t.date).toLocaleDateString() : "unknown date"})`,
      )
      .join("\n");

    const prompt = [
      `Contact: ${params.contactName} <${params.contactEmail}>`,
      `Total interactions: ${params.totalInteractions} (${params.sentCount} sent, ${params.receivedCount} received)`,
      params.lastInteractionDaysAgo !== null
        ? `Last interaction: ${params.lastInteractionDaysAgo} days ago`
        : "Last interaction: unknown",
      params.responseRate !== null
        ? `Estimated response rate: ${Math.round(params.responseRate * 100)}%`
        : "",
      "",
      "Recent email subjects:",
      subjectList,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await createChatCompletion(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { jsonObject: true, temperature: 0.4 },
    );

    const parsed = JSON.parse(raw) as {
      relationshipSummary?: string;
      recommendedAction?: string;
      recentTopics?: string[];
    };

    if (parsed.relationshipSummary) relationshipSummary = parsed.relationshipSummary;
    if (parsed.recommendedAction) recommendedAction = parsed.recommendedAction;
    if (Array.isArray(parsed.recentTopics)) recentTopics = parsed.recentTopics.slice(0, 4);
  } catch {
    // fallback to defaults
  }

  return { relationshipSummary, recommendedAction, recentTopics };
}

export async function getContactIntel(input: {
  tenantId: string;
  email: string;
  name?: string;
  userEmail?: string;
}): Promise<ContactIntelResult> {
  const contactEmail = extractEmailAddress(input.email) || input.email;
  const contactName = input.name ?? contactEmail.split("@")[0] ?? contactEmail;

  const { sentThreads, receivedThreads } = await fetchContactThreads(input.tenantId, contactEmail);
  const allThreads = mergeAndSortThreads(sentThreads, receivedThreads);

  const totalInteractions = allThreads.length;
  const lastThread = allThreads[0];
  const lastInteractionDaysAgo = lastThread?.date ? daysSince(lastThread.date) : null;
  const responseRate =
    sentThreads.length > 0 && receivedThreads.length > 0
      ? Math.min(1, receivedThreads.length / sentThreads.length)
      : null;

  const recentThreadsForResult = allThreads.slice(0, 8).map((t) => ({
    id: t.id,
    subject: t.subject ?? "(no subject)",
    date: t.date,
    direction: t.direction,
  }));

  const synthesis = await synthesizeContactIntel({
    contactName,
    contactEmail,
    totalInteractions,
    sentCount: sentThreads.length,
    receivedCount: receivedThreads.length,
    lastInteractionDaysAgo,
    responseRate,
    threads: allThreads,
  });

  return {
    email: contactEmail,
    name: contactName,
    totalInteractions,
    lastInteractionDaysAgo,
    lastInteractionDate: lastThread?.date,
    sentByUser: sentThreads.length,
    receivedFromContact: receivedThreads.length,
    responseRate,
    recentTopics: synthesis.recentTopics,
    relationshipSummary: synthesis.relationshipSummary,
    recommendedAction: synthesis.recommendedAction,
    recentThreads: recentThreadsForResult,
  };
}
