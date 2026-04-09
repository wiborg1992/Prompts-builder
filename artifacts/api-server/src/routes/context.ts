import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, contextItemsTable } from "@workspace/db";
import {
  ListContextItemsParams,
  AddContextItemParams,
  AddContextItemBody,
  UpdateContextItemParams,
  UpdateContextItemBody,
  DeleteContextItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions/:sessionId/context", async (req, res): Promise<void> => {
  const params = ListContextItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db
    .select()
    .from(contextItemsTable)
    .where(eq(contextItemsTable.sessionId, params.data.sessionId))
    .orderBy(contextItemsTable.createdAt);

  res.json(items);
});

router.post("/sessions/:sessionId/context", async (req, res): Promise<void> => {
  const params = AddContextItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddContextItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fileUrl, filename, mimeType, ...rest } = parsed.data;
  const [item] = await db
    .insert(contextItemsTable)
    .values({
      sessionId: params.data.sessionId,
      ...rest,
      fileUrl: fileUrl ?? null,
      filename: filename ?? null,
      mimeType: mimeType ?? null,
    })
    .returning();

  res.status(201).json(item);
});

router.patch("/sessions/:sessionId/context/:id", async (req, res): Promise<void> => {
  const params = UpdateContextItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContextItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .update(contextItemsTable)
    .set(parsed.data)
    .where(
      and(
        eq(contextItemsTable.id, params.data.id),
        eq(contextItemsTable.sessionId, params.data.sessionId)
      )
    )
    .returning();

  if (!item) {
    res.status(404).json({ error: "Context item not found" });
    return;
  }

  res.json(item);
});

router.delete("/sessions/:sessionId/context/:id", async (req, res): Promise<void> => {
  const params = DeleteContextItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .delete(contextItemsTable)
    .where(
      and(
        eq(contextItemsTable.id, params.data.id),
        eq(contextItemsTable.sessionId, params.data.sessionId)
      )
    )
    .returning();

  if (!item) {
    res.status(404).json({ error: "Context item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
