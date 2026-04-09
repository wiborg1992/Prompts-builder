import { Router, type IRouter } from "express";
import { eq, desc, ne, and } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  CreateSessionBody,
  UpdateSessionBody,
  GetSessionParams,
  UpdateSessionParams,
  DeleteSessionParams,
  GetSessionSummaryParams,
} from "@workspace/api-zod";
import { contextItemsTable, generatedPromptsTable, transcriptSegmentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.updatedAt));
  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(session);
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .update(sessionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/sessions/:sessionId/summary", async (req, res): Promise<void> => {
  const params = GetSessionSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { sessionId } = params.data;

  const contextItems = await db
    .select()
    .from(contextItemsTable)
    .where(and(
      eq(contextItemsTable.sessionId, sessionId),
      ne(contextItemsTable.type, "transcript")
    ));

  const transcriptSegments = await db
    .select({ id: transcriptSegmentsTable.id })
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.sessionId, sessionId));

  const prompts = await db
    .select()
    .from(generatedPromptsTable)
    .where(eq(generatedPromptsTable.sessionId, sessionId))
    .orderBy(desc(generatedPromptsTable.createdAt))
    .limit(1);

  const contextByType: Record<string, number> = {};
  for (const item of contextItems) {
    contextByType[item.type] = (contextByType[item.type] ?? 0) + 1;
  }

  const latestPrompt = prompts[0];
  const latestPromptPreview = latestPrompt
    ? latestPrompt.content.slice(0, 200)
    : null;

  const allPrompts = await db
    .select({ id: generatedPromptsTable.id })
    .from(generatedPromptsTable)
    .where(eq(generatedPromptsTable.sessionId, sessionId));

  res.json({
    sessionId,
    contextCount: contextItems.length,
    transcriptSegmentCount: transcriptSegments.length,
    promptCount: allPrompts.length,
    contextByType,
    latestPromptPreview,
  });
});

export default router;
