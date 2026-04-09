import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import contextRouter from "./context";
import promptsRouter from "./prompts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(contextRouter);
router.use(promptsRouter);

export default router;
