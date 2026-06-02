import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paydRouter from "./payd";
import settingsRouter from "./settings";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paydRouter);
router.use(settingsRouter);
router.use(adminRouter);

export default router;
