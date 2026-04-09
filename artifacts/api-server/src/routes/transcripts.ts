import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, transcriptSegmentsTable } from "@workspace/db";
import {
  ListTranscriptSegmentsParams,
  AddTranscriptSegmentParams,
  AddTranscriptSegmentBody,
  ClearTranscriptSegmentsParams,
  AddTranscriptSegmentsBatchParams,
  AddTranscriptSegmentsBatchBody,
  DeleteTranscriptSegmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions/:sessionId/transcripts", async (req, res): Promise<void> => {
  const params = ListTranscriptSegmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const segments = await db
    .select()
    .from(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.sessionId, params.data.sessionId))
    .orderBy(transcriptSegmentsTable.createdAt);

  res.json(segments);
});

router.post("/sessions/:sessionId/transcripts", async (req, res): Promise<void> => {
  const params = AddTranscriptSegmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddTranscriptSegmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [segment] = await db
    .insert(transcriptSegmentsTable)
    .values({
      sessionId: params.data.sessionId,
      speaker: parsed.data.speaker,
      text: parsed.data.text,
      language: parsed.data.language ?? null,
      recordingId: parsed.data.recordingId ?? null,
    })
    .returning();

  res.status(201).json(segment);
});

router.post("/sessions/:sessionId/transcripts/batch", async (req, res): Promise<void> => {
  const params = AddTranscriptSegmentsBatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddTranscriptSegmentsBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.segments.length === 0) {
    res.status(400).json({ error: "No segments provided" });
    return;
  }

  const values = parsed.data.segments.map((seg) => ({
    sessionId: params.data.sessionId,
    speaker: seg.speaker,
    text: seg.text,
    language: seg.language ?? null,
    recordingId: seg.recordingId ?? null,
  }));

  const segments = await db
    .insert(transcriptSegmentsTable)
    .values(values)
    .returning();

  res.status(201).json(segments);
});

router.delete("/sessions/:sessionId/transcripts/:id", async (req, res): Promise<void> => {
  const params = DeleteTranscriptSegmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [segment] = await db
    .delete(transcriptSegmentsTable)
    .where(
      and(
        eq(transcriptSegmentsTable.id, params.data.id),
        eq(transcriptSegmentsTable.sessionId, params.data.sessionId)
      )
    )
    .returning();

  if (!segment) {
    res.status(404).json({ error: "Transcript segment not found" });
    return;
  }

  res.sendStatus(204);
});

router.delete("/sessions/:sessionId/transcripts", async (req, res): Promise<void> => {
  const params = ClearTranscriptSegmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(transcriptSegmentsTable)
    .where(eq(transcriptSegmentsTable.sessionId, params.data.sessionId));

  res.sendStatus(204);
});

export default router;
