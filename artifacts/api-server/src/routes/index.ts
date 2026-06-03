import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paydRouter from "./payd";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import authRouter from "./auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Public routes — no auth required
router.use(healthRouter);
router.use(authRouter);

// Protected routes — must be logged in
router.use(requireAuth, paydRouter);
router.use(requireAuth, settingsRouter);

// Admin route (unprotected by login — access by URL knowledge only)
router.use(adminRouter);

export default router;
