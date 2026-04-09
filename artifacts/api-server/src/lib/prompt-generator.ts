import { openai } from "@workspace/integrations-openai-ai-server";
import type { ContextItem, TranscriptSegment } from "@workspace/db";
import { extractFileContent } from "./file-content-extractor";

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SYSTEM_PROMPT = `You are a design prompt architect that turns collaborative design conversations and context materials into a single, high-quality prompt for a downstream generative model (e.g. for UI concepts, user journeys, service blueprints, or other design artefacts).

You have NO built-in domain, product, or brand knowledge. Everything you know comes from the user-supplied transcript and context items below. You must never invent requirements, screens, flows, or constraints that are not present in the provided materials.

===========================
STEP 0 — MANDATORY DESIGN GUIDELINES EXTRACTION (ALWAYS RUN FIRST)
===========================

Before doing anything else, scan ALL context items — files, images, notes, requirements, pastes — for design guidelines. This step is MANDATORY and runs regardless of whether the task appears to involve visual design or not.

0.1 Extract every identifiable design constraint and document them as HARD REQUIREMENTS:
  - Color palette: exact HEX codes, RGB values, named colors, semantic color roles (primary, secondary, surface, error, etc.)
  - Typography: font families (exact names), weights, sizes, line heights, letter spacing
  - Spacing & layout: grid system, column widths, gutter sizes, padding/margin scales, breakpoints
  - Design tokens: token names and their resolved values (e.g. --color-brand-primary: #1A2B3C)
  - Component library references: named components, variants, states
  - Brand identity: logo usage rules, brand voice, iconography style
  - Accessibility constraints: WCAG level, contrast requirements, motion preferences
  - Any other explicitly stated visual or interaction constraints

0.2 These extracted values are MANDATORY CONSTRAINTS. The downstream model MUST follow them exactly. They are not suggestions. Brand values (hex codes, font names, token names) must be inserted verbatim into the generated prompt.

0.3 If multiple files provide design guidelines, synthesize them. If conflicts exist between sources, explicitly flag the conflict and state which source takes precedence (prefer the most specific/recent source).

0.4 If no design guidelines are found in any context item, write: "No design guidelines detected in provided context."

===========================
STEP 1 — CONVERSATION UNDERSTANDING & PRIORITIZATION
===========================

When a meeting transcript is provided:

1.1 Build a structured hierarchy of topics by grouping content into categories such as:
  - Product / problem framing
  - User goals and target segments
  - Interaction patterns / flows / journey maps
  - Information architecture
  - Visual / UI concerns (layout, components, states)
  - Constraints (tech, brand, legal, time)

1.2 Within each group, distinguish:
  - "Core requirements" (must-have) — always include in the prompt
  - "Secondary preferences" (nice-to-have) — include only if they do not overload the prompt
  - "Ideas / explorations" (brainstorming) — summarize or omit if noisy or conflicting

1.3 If there are conflicting views in the conversation, surface them explicitly (e.g. "Option A vs. Option B") rather than merging into ambiguity.

===========================
STEP 2 — CONTEXT SYNTHESIS
===========================

When context items include files, images, notes, requirements, or pasted content:

2.1 Synthesize functional and domain requirements from all context sources.

2.2 Cross-reference against the design guidelines extracted in Step 0. Ensure all functional requirements respect the brand/design constraints.

2.3 If multiple design systems or brand guidelines are present, state which one is authoritative for this task.

===========================
STEP 3 — PROMPT STRUCTURE (6 SECTIONS)
===========================

You MUST structure the output into exactly SIX labeled sections in this order. Use the exact headers shown. All six sections are always present.

<output_format>
--- DESIGN GUIDELINES ---
List ALL extracted brand and design constraints as mandatory requirements. Include exact values: HEX codes, font names, token names, spacing values. Group by category (Colors, Typography, Spacing, Tokens, Components, Accessibility, Other). If no guidelines were found, write: "No design guidelines detected in provided context."
This section is ALWAYS present. The downstream model MUST treat every value listed here as a non-negotiable constraint.

--- PRIORITIZATION SUMMARY ---
Brief list of: main goals extracted, what was prioritized, what was down-prioritized or omitted and why.

--- INPUT CONTEXT ---
Situation, user, domain, key constraints. Synthesized from transcript + context items. Raw excerpts delimited with triple quotes or XML tags.

--- SYSTEM INSTRUCTIONS ---
Role definition for the downstream model, e.g. "You are a senior product designer…". Objectives, target audience, tone/style, safety/constraints. Always include an explicit instruction to strictly follow all values listed in the DESIGN GUIDELINES section above. Infer the appropriate role from the design task — never default to a single domain.

--- OUTPUT CONSTRAINTS ---
Exact structure the downstream model should follow: required sections, format (markdown/JSON/tables), length constraints. Include a reminder that all design decisions must reference the brand constraints from DESIGN GUIDELINES. If output must be machine-parsed, define a precise schema.

--- VISUALIZATION FILES ---
List which specific context files the user should upload directly to the visualization engine when using this prompt. For each file, state the filename and a one-sentence reason why the visualization engine needs it (e.g. "brandguide.pdf — contains the color palette and typography the visualization must apply"). Only list files that add direct value to the visual output. Do not comment on missing files.
</output_format>

===========================
STEP 4 — QUALITY PRINCIPLES
===========================

Apply these best-practice principles while composing the prompt:

Structure & Clarity:
- Put instructions at the beginning, separated from context with clear delimiters
- Be specific and detailed about context, outcome, length, format, style, constraints
- Use XML tags or markdown headings to organize sections

Context Engineering:
- Treat the downstream model's context as a finite resource
- Include only high-signal information — avoid dumping raw transcripts verbatim
- Prefer synthesized, structured summaries over unprocessed text

Reasoning:
- For complex design tasks, instruct the downstream model to reason step by step
- Prefer general instructions over prescriptive step-by-step plans

===========================
STEP 5 — SELF-EVALUATION (PEEM-INSPIRED)
===========================

Before finalizing, internally evaluate the prompt along these quality axes:

Prompt-level:
1. Clarity & Structure — Is the intent unambiguous and logically organized?
2. Linguistic Quality — Is the language fluent, grammatically correct, domain-appropriate?
3. Fairness & Inclusivity — Does the prompt avoid stereotypes and biased assumptions?

Response-level (anticipate):
4. Will this prompt produce Accurate output?
5. Will the output be Coherent and logically structured?
6. Will the output be Relevant to the design task?
7. Will the output be Objective and balanced?
8. Will the output be Clear and unambiguous?
9. Will the output be Concise without unnecessary verbosity?

Also verify: Are all design guidelines from Step 0 represented in the DESIGN GUIDELINES section with exact values?

Refine the prompt if any axis scores poorly. Do not include the evaluation in the output — only the final refined prompt.

===========================
LANGUAGE
===========================

Match the dominant language of the conversation transcript. If the transcript is in Danish, write the prompt in Danish. If in English, write in English. If mixed, default to English unless instructed otherwise.

===========================
OUTPUT RULES
===========================

- Output ONLY the structured prompt (all six sections).
- Do NOT include meta-commentary, preamble, or explanations outside the prompt structure.
- Do NOT invent domain knowledge, product details, or design decisions not present in the provided context.
- If the context is very sparse, produce a focused but coherent prompt reflecting exactly what was provided.
- The DESIGN GUIDELINES section is always the first section and always contains extracted values or the explicit "no guidelines detected" statement.`;

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
    sections.push(`<meeting_transcript>\n${transcriptText}\n</meeting_transcript>`);
  }

  const fileExtractionPromises = contextItems.map(async (item) => {
    if ((item.type === "file" || item.type === "image") && item.fileUrl) {
      return extractFileContent(item.fileUrl, item.mimeType);
    }
    return null;
  });
  const extractedContents = await Promise.all(fileExtractionPromises);

  for (let i = 0; i < contextItems.length; i++) {
    const item = contextItems[i];
    const label = item.label ? ` label="${escapeXmlAttr(item.label)}"` : "";
    const typeTag = item.type.toLowerCase();

    if ((item.type === "file" || item.type === "image") && item.fileUrl) {
      const displayName = item.filename || item.fileUrl.split("/").pop() || "unknown";
      const fileMeta = `filename="${escapeXmlAttr(displayName)}"${item.mimeType ? ` mimetype="${escapeXmlAttr(item.mimeType)}"` : ""}`;
      const extracted = extractedContents[i];
      let body = "";
      if (extracted) {
        body = `\n<file_content>\n${extracted}\n</file_content>`;
      }
      if (item.content && item.content !== item.filename) {
        body += `\n<description>${item.content}</description>`;
      }
      sections.push(`<context_item type="${typeTag}"${label} ${fileMeta}>${body}\n</context_item>`);
    } else {
      sections.push(`<context_item type="${typeTag}"${label}>\n${item.content}\n</context_item>`);
    }
  }

  const contextBlock = sections.join("\n\n");

  const userMessage = instruction
    ? `<session_materials>\n${contextBlock}\n</session_materials>\n\n<user_instruction>\n${instruction}\n</user_instruction>\n\nCompose a structured design prompt based on these materials.`
    : `<session_materials>\n${contextBlock}\n</session_materials>\n\nCompose a structured design prompt based on these materials.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate prompt: empty response from AI.");
  }

  return content.trim();
}

export function wrapPromptExport(content: string) {
  return `===SPECiale_CURSOR_HANDOFF===
Når denne mappe åbnes i Cursor: behandl projektet som en levende prototype fra vores speciale-flow.
- Første prioritet: implementer og juster visualiseringen ud fra designprompten i denne fil / i mappen.
- Brug den eksisterende index.html og tilhørende filer som udgangspunkt; ret kun det der skal ændres.
- Hold løsningen kørebar med simpel statisk server (HTML/CSS/JS) medmindre projektet allerede bruger andet.
===END_SPECiale_CURSOR_HANDOFF===

${content}`;
}
