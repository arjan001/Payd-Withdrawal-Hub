import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paydRouter from "./payd";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paydRouter);

export default router;
