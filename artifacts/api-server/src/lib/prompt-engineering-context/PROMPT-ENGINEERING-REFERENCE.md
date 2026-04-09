# Prompt Engineering Reference for Prompt Studio

This document synthesizes best-practice principles from five sources that guide how Prompt Studio's AI generates design prompts. It serves as the authoritative reference for maintaining and evolving the prompt generator system prompt.

## Sources

1. **System Prompt Specification** — The user-provided 4-part prompt structure and conversation-prioritization rules
2. **PEEM (Prompt Engineering Evaluation Metrics)** — Academic framework for joint prompt–response evaluation across 9 quality axes
3. **Anthropic: Effective Context Engineering for AI Agents** — Principles for curating high-signal context within finite attention budgets
4. **OpenAI: Best Practices for Prompt Engineering** — Practical guidance on structuring, delimiting, and iterating prompts
5. **Claude API Docs: Prompting Best Practices** — Guidance on clarity, examples, XML structure, and role assignment

---

## 1. Mandatory 4-Part Prompt Structure

Every generated design prompt MUST contain these four labeled sections:

### 1.1 INPUT CONTEXT
- Situation, user, domain, and key constraints
- Synthesized from both conversation transcript and context items
- Raw excerpts delimited with `"""` or XML-style tags
- Includes mined design constraints (colors, typography, tokens, spacing, accessibility)

### 1.2 SYSTEM INSTRUCTIONS / ROLE
- Defines the downstream model's role (e.g., "You are a senior product designer…")
- Specifies: objectives, target audience, tone/style, safety/constraints
- Role is inferred from the design task type — never hardcoded to a single domain

### 1.3 OUTPUT CONSTRAINTS & FORMAT
- Exact structure the downstream model should follow
- Required sections, format (markdown/JSON/tables), length constraints
- If output is machine-parseable, defines a precise schema

### 1.4 FEW-SHOT EXAMPLES
- 1–3 realistic input→output examples when the context supports it
- Uses clearly separated blocks with XML-style tags
- Examples drawn from the session's own context, not from hardcoded templates

---

## 2. Conversation Understanding & Prioritization

When processing meeting transcripts:

### 2.1 Topic Hierarchy
Group content into categories:
- Product / problem framing
- User goals and target segments
- Interaction patterns / flows / journey maps
- Information architecture
- Visual/UI concerns (layout, components, states)
- Constraints (tech, brand, legal, time)

### 2.2 Priority Levels
Within each group, distinguish:
- **Core requirements** (must-have) → always included
- **Secondary preferences** (nice-to-have) → included if they don't overload
- **Ideas / explorations** (brainstorming) → summarized or omitted if noisy

### 2.3 Conflict Surfacing
If the conversation contains conflicting views, surface them explicitly (e.g., "Option A vs. Option B") rather than merging into ambiguity.

### 2.4 Transparent Prioritization
Before the final prompt, briefly list:
- Main goals extracted
- What was prioritized
- What was down-prioritized or omitted (and why)

---

## 3. Context File Mining

When context items include files, images, or structured data:

- Extract relevant design constraints (color palettes, typography, spacing, tokens, accessibility)
- Refer to these constraints explicitly in the prompt — don't ask the user to restate them
- Insert exact values (HEX codes, font names, token names) so the downstream model has precise guidance
- If multiple design systems are present, state which is authoritative
- Recommend which files should be passed to visualization systems, with reasons

---

## 4. Best-Practice Principles (OpenAI + Anthropic + Claude)

### Structure & Clarity
- Put instructions at the beginning, separate from context with clear delimiters (`###`, `---`, XML tags)
- Be specific and detailed about context, outcome, length, format, style, constraints
- Use role/system prompts to set expertise, tone, and behavioral rules

### Context Engineering (Anthropic)
- Treat context as a precious, finite resource
- Find the smallest set of high-signal tokens that maximize likelihood of desired outcome
- Prefer structured, labeled sections over free-form text
- Use progressive disclosure — start with essential info, add detail where needed

### Examples & Format
- Show desired output format through examples
- Start zero-shot, add few-shot examples when task complexity warrants it
- Use XML tags to clearly separate structural sections
- Constrain output structure tightly when it must be parsed by other systems

### Reasoning
- For complex design tasks, allow the model to reason step by step
- Prefer general instructions ("think thoroughly") over prescriptive step-by-step plans
- Ask the model to self-check against requirements before finalizing

---

## 5. PEEM Evaluation Axes

### Prompt-Level (3 axes)
1. **Clarity & Structure** — Is the intent unambiguous and logically organized?
2. **Linguistic Quality** — Is the language fluent, grammatically correct, domain-appropriate?
3. **Fairness & Inclusivity** — Does the prompt avoid stereotypes and biased assumptions?

### Response-Level (6 axes)
4. **Accuracy** — Factual correctness and logical validity
5. **Coherence** — Logical structure and consistent flow
6. **Relevance** — Addresses the specific question/task without off-topic content
7. **Objectivity** — Unbiased, balanced perspectives
8. **Clarity** — Easy to understand, free from ambiguity
9. **Conciseness** — No unnecessary verbosity

### Application in Prompt Studio
The prompt generator uses these axes internally to self-evaluate the generated prompt before returning it. The system prompt instructs the model to reason about these quality dimensions while composing the prompt, ensuring structured and high-quality output.

---

## 6. Key Design Principles for This System

- **No hardcoded domain knowledge**: The system has no built-in product, brand, or design-system knowledge. Everything comes from user-supplied context.
- **Context-driven**: Prompts are composed entirely from transcript + context items. The system extracts, prioritizes, and structures — it never invents.
- **Transparent reasoning**: Prioritization decisions are made visible to the user.
- **Iterative by nature**: Prompts can be regenerated with refined instructions or additional context.
- **Language-aware**: Transcripts may be in English or Danish. The prompt should match the dominant language of the conversation unless instructed otherwise.
