import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/analyze-image", async (req, res): Promise<void> => {
  const { imageUrl, context } = req.body ?? {};

  if (!imageUrl || typeof imageUrl !== "string") {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }

  const fullUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${req.protocol}://${req.get("host")}${imageUrl}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are a design research assistant analyzing images uploaded to a design prompt workshop tool.
Your job is to:
1. Write a concise 1-2 sentence description of what the image shows (e.g. "A wireframe of a mobile onboarding flow with 3 screens" or "A brand guideline document showing color palette and typography").
2. Generate exactly 2-3 short, specific follow-up questions that would help clarify how this image should influence the design prompt being created.

The questions should be practical and context-driven — e.g. "Er dette den aktuelle version, eller et tidligere udkast?" or "Hvilke skærme/flows er mest relevante for det vi arbejder på?"

Respond with valid JSON in this exact shape:
{
  "description": "...",
  "questions": ["...", "...", "..."]
}

Do NOT include any text outside the JSON object.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: fullUrl, detail: "low" },
            },
            ...(context
              ? [
                  {
                    type: "text" as const,
                    text: `Session context: ${context}`,
                  },
                ]
              : []),
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: { description?: string; questions?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { description: raw, questions: [] };
    }

    res.json({
      description: parsed.description ?? "",
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Analysis failed" });
  }
});

export default router;
