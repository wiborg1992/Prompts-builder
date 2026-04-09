import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/deepgram-token", (_req, res): void => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    res.status(500).json({ error: "DEEPGRAM_API_KEY not configured" });
    return;
  }
  res.json({ key });
});

export default router;
