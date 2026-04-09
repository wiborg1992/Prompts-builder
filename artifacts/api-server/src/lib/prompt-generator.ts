import { openai } from "@workspace/integrations-openai-ai-server";
import type { ContextItem, TranscriptSegment } from "@workspace/db";

export async function generateDesignPrompt(
  contextItems: ContextItem[],
  transcriptSegments: TranscriptSegment[],
  instruction: string | null | undefined
): Promise<string> {
  if (contextItems.length === 0 && transcriptSegments.length === 0) {
    throw new Error("No context or transcript available to generate a prompt from.");
  }

  const sections: string[] = [];

  if (transcriptSegments.length > 0) {
    const transcriptText = transcriptSegments
      .map((s) => `[${s.speaker}] ${s.text}`)
      .join("\n");
    sections.push(`[MEETING TRANSCRIPT]\n${transcriptText}`);
  }

  for (const item of contextItems) {
    const label = item.label ? ` (${item.label})` : "";

    if ((item.type === "file" || item.type === "image") && item.filename) {
      const fileMeta = `File: ${item.filename}${item.mimeType ? ` [${item.mimeType}]` : ""}`;
      const description = item.content ? `\nDescription: ${item.content}` : "";
      sections.push(`[${item.type.toUpperCase()}${label}]\n${fileMeta}${description}`);
    } else {
      sections.push(`[${item.type.toUpperCase()}${label}]\n${item.content}`);
    }
  }

  const contextBlock = sections.join("\n\n---\n\n");

  const systemPrompt = `You are a design prompt architect. Your job is to compose a clear, structured, and actionable design prompt based on the user-supplied context.

Rules:
- Base the prompt entirely on the provided context. Do not add domain assumptions, company-specific knowledge, or product knowledge that isn't in the context.
- Structure the prompt to help a designer or AI understand what to build.
- Be specific about what is known from context. Be explicit about what is not specified.
- Keep the output focused and practical.
- Do not invent requirements, screens, flows, or user roles that the context doesn't mention.
- If the context is sparse, produce a generic but coherent prompt that reflects exactly what was provided.
- Context may include uploaded files and images described by filename and type. Treat these as reference materials.
- Context may include meeting transcripts with speaker labels. Extract key requirements and decisions from conversations.
- Output only the prompt text — no meta-commentary, no headers, no preamble.`;

  const userMessage = instruction
    ? `Here is the context:\n\n${contextBlock}\n\n---\n\nAdditional instruction: ${instruction}\n\nCompose a design prompt based on this context.`
    : `Here is the context:\n\n${contextBlock}\n\n---\n\nCompose a design prompt based on this context.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate prompt: empty response from AI.");
  }

  return content.trim();
}
