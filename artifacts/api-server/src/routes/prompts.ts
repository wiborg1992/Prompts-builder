import { Router, type IRouter } from "express";
import { eq, and, desc, ne } from "drizzle-orm";
import { db, contextItemsTable, generatedPromptsTable, transcriptSegmentsTable } from "@workspace/db";
import {
  ListPromptsParams,
  GeneratePromptParams,
  GeneratePromptBody,
  UpdatePromptParams,
  UpdatePromptBody,
  DeletePromptParams,
} from "@workspace/api-zod";
import { generateDesignPrompt } from "../lib/prompt-generator";

const router: IRouter = Router();

router.get("/sessions/:sessionId/prompts", async (req, res): Promise<void> => {
  const params = ListPromptsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const prompts = await db
    .select()
    .from(generatedPromptsTable)
    .where(eq(generatedPromptsTable.sessionId, params.data.sessionId))
    .orderBy(desc(generatedPromptsTable.createdAt));

  res.json(prompts);
});

router.post("/sessions/:sessionId/prompts", async (req, res): Promise<void> => {
  const params = GeneratePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GeneratePromptBody.safeParse(req.body ?? {});
  const instruction = body.success ? body.data.instruction : null;

  const contextItems = await db
    .select()
    .from(contextItemsTable)
    .where(and(
      eq(contextItemsTable.sessionId, params.data.sessionId),
      ne(contextItemsTable.type, "transcript")
    ))
    .orderBy(contextItemsTable.createdAt);

  const transcriptSegments = await db
    .select()
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.sessionId, params.data.sessionId))
    .orderBy(transcriptSegmentsTable.createdAt);

  if (contextItems.length === 0 && transcriptSegments.length === 0) {
    res.status(400).json({ error: "No context or transcript in this session. Record a meeting or add context before generating a prompt." });
    return;
  }

  const existingVersions = await db
    .select({ version: generatedPromptsTable.version })
    .from(generatedPromptsTable)
    .where(eq(generatedPromptsTable.sessionId, params.data.sessionId))
    .orderBy(desc(generatedPromptsTable.version))
    .limit(1);

  const nextVersion = existingVersions.length > 0
    ? (existingVersions[0]?.version ?? 0) + 1
    : 1;

  const content = await generateDesignPrompt(contextItems, transcriptSegments, instruction ?? null);

  const [prompt] = await db
    .insert(generatedPromptsTable)
    .values({
      sessionId: params.data.sessionId,
      content,
      instruction: instruction ?? null,
      version: nextVersion,
    })
    .returning();

  res.status(201).json(prompt);
});

router.patch("/sessions/:sessionId/prompts/:id", async (req, res): Promise<void> => {
  const params = UpdatePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [prompt] = await db
    .update(generatedPromptsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(generatedPromptsTable.id, params.data.id),
        eq(generatedPromptsTable.sessionId, params.data.sessionId)
      )
    )
    .returning();

  if (!prompt) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }

  res.json(prompt);
});

router.delete("/sessions/:sessionId/prompts/:id", async (req, res): Promise<void> => {
  const params = DeletePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prompt] = await db
    .delete(generatedPromptsTable)
    .where(
      and(
        eq(generatedPromptsTable.id, params.data.id),
        eq(generatedPromptsTable.sessionId, params.data.sessionId)
      )
    )
    .returning();

  if (!prompt) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
