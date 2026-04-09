import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import contextRouter from "./context";
import promptsRouter from "./prompts";
import transcribeRouter from "./transcribe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(contextRouter);
router.use(promptsRouter);
router.use(transcribeRouter);

export default router;
