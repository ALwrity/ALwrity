import type { NetworkSuggestionItem } from "../../../../services/linkedInGrowthApi";
import type { PymkSuggestionItem } from "../../../../services/linkedInPymkApi";
import { linkedInWriterApi } from "../../../../services/linkedInWriterApi";

export interface OutreachDraftInput {
  originalPost: string;
  comment: string;
  fallbackNote: string;
}

/** Draft a personalised connection note — LLM refines text only; identity comes from source data. */
export async function draftConnectionOutreach(
  input: OutreachDraftInput,
): Promise<string> {
  try {
    const res = await linkedInWriterApi.generateCommentResponse({
      original_post: input.originalPost,
      comment: input.comment,
      response_type: "professional",
    });
    return res.response?.trim() || input.fallbackNote;
  } catch {
    return input.fallbackNote;
  }
}

export function buildAiSuggestionOutreachInput(
  item: NetworkSuggestionItem,
): OutreachDraftInput {
  return {
    originalPost: `I want to connect with ${item.name}, ${item.title} at ${item.company}.`,
    comment: `Context: ${item.why_connect}. Their suggested note: "${item.suggested_note}"`,
    fallbackNote: item.suggested_note,
  };
}

/** PYMK people are live LinkedIn identities — LLM writes the note only. */
export function buildPymkOutreachInput(
  person: PymkSuggestionItem,
): OutreachDraftInput {
  const contextParts = [
    person.headline ? `Headline: ${person.headline}.` : "",
    person.reason ? `LinkedIn reason: ${person.reason}.` : "",
    person.mutual_connections_text ?? "",
  ].filter(Boolean);

  const fallback = person.reason
    ? `Hi ${person.first_name || person.name.split(" ")[0]}, ${person.reason} I'd love to connect.`
    : `Hi ${person.first_name || person.name.split(" ")[0]}, I'd love to connect and learn from your work on LinkedIn.`;

  return {
    originalPost: `I want to connect with ${person.name} on LinkedIn.`,
    comment: contextParts.join(" "),
    fallbackNote: fallback,
  };
}
