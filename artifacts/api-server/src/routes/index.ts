import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import contextRouter from "./context";
import promptsRouter from "./prompts";
import transcribeRouter from "./transcribe";
import storageRouter from "./storage";
import deepgramTokenRouter from "./deepgram-token";
import transcriptsRouter from "./transcripts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(contextRouter);
router.use(promptsRouter);
router.use(transcribeRouter);
router.use(storageRouter);
router.use(deepgramTokenRouter);
router.use(transcriptsRouter);

export default router;
