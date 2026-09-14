import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coordinationRouter from "./coordination";
import authRouter from "./auth";

const router: IRouter = Router();

// Public auth routes (no JWT required)
router.use(authRouter);

// Health check (public)
router.use(healthRouter);

// All coordination routes (JWT protected inside the router)
router.use(coordinationRouter);

export default router;
