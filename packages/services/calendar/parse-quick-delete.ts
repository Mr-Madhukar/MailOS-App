import { monthIndex, resolveDayMonth, stripOnce } from "./parse-utils";

export type ParsedQuickDelete = {
  intent: "delete";
  query?: string;
  onDate?: Date;
  /** When true, delete every event on `onDate` (no title filter). */
  deleteAllOnDate: boolean;
};

function parseDate(text: string, refDate: Date): { date: Date; rest: string } | null {
  if (/\btoday\b/i.test(text)) {
    return {
      date: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()),
      rest: stripOnce(text, /\btoday\b/i),
    };
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 1);
    return { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), rest: stripOnce(text, /\btomorrow\b/i) };
  }

  for (const match of text.matchAll(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/gi)) {
    const day = Number.parseInt(match[1] ?? "", 10);
    const month = monthIndex(match[2] ?? "");
    if (month !== null && day >= 1 && day <= 31) {
      return { date: resolveDayMonth(day, month, refDate), rest: stripOnce(text, match[0]) };
    }
  }

  for (const match of text.matchAll(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const month = monthIndex(match[1] ?? "");
    const day = Number.parseInt(match[2] ?? "", 10);
    if (month !== null && day >= 1 && day <= 31) {
      return { date: resolveDayMonth(day, month, refDate), rest: stripOnce(text, match[0]) };
    }
  }

  for (const match of text.matchAll(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?!\s*(?:am|pm|:|\d))\b/gi)) {
    const day = Number.parseInt(match[1] ?? "", 10);
    if (day >= 1 && day <= 31) {
      return {
        date: resolveDayMonth(day, refDate.getMonth(), refDate),
        rest: stripOnce(text, match[0]),
      };
    }
  }

  return null;
}

function extractDeleteQuery(rest: string): string | undefined {
  const q = rest
    .replace(/\b(two|three|four|all|both|those|these|every)\b/gi, " ")
    .replace(/\b(which|is|are|there|here|that|this)\b/gi, " ")
    .replace(/\b(the|a|an|my|please|on|for|from|to)\b/gi, " ")
    .replace(/\b(meetings?|events?|calls?|invites?|calendar|appointment|appointments)\b/gi, " ")
    .replace(/\b(with|named|called|titled|about|regarding|named)\b/gi, " ")
    .replace(/["']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (q.length < 2) return undefined;
  return q;
}

/** True when natural-language text is asking to remove/cancel calendar events. */
export function isQuickDeleteIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(please\s+)?(delete|remove|cancel|drop)\b/i.test(trimmed)) return true;
  return /\b(delete|remove|cancel)\s+(the\s+)?(meeting|meetings|event|events|call|calls|invite|invites)\b/i.test(
    trimmed,
  );
}

/** Parse delete/cancel quick-add text into search criteria — never creates an event title from this. */
export function parseQuickDeleteText(text: string, refDate = new Date()): ParsedQuickDelete {
  let remaining = text.trim();

  remaining = remaining
    .replace(/^(please\s+)?(delete|remove|cancel|drop)\s+/i, "")
    .replace(/^(the\s+)?(meeting|meetings|event|events|call|calls|invite|invites)\s+/i, "")
    .trim();

  const parsedDate = parseDate(remaining, refDate);
  if (parsedDate) remaining = parsedDate.rest;

  const query = extractDeleteQuery(remaining);
  const deleteAllOnDate =
    Boolean(parsedDate?.date) &&
    !query &&
    /\b(meetings|events|calls|both|all|those|these|two|three|four|every)\b/i.test(text);

  return {
    intent: "delete",
    query,
    onDate: parsedDate?.date,
    deleteAllOnDate,
  };
}

export function demoEventMatchesDelete(
  summary: string,
  start: string,
  parsed: ParsedQuickDelete,
): boolean {
  const dayFromStart = start.slice(0, 10);
  if (parsed.onDate) {
    const target = `${parsed.onDate.getFullYear()}-${String(parsed.onDate.getMonth() + 1).padStart(2, "0")}-${String(parsed.onDate.getDate()).padStart(2, "0")}`;
    if (!dayFromStart.startsWith(target)) return false;
  }
  if (parsed.deleteAllOnDate) return true;
  if (parsed.query) return summary.toLowerCase().includes(parsed.query.toLowerCase());
  return Boolean(parsed.onDate);
}
