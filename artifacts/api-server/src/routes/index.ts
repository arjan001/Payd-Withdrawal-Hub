import { Router, type IRouter } from "express";
import healthRouter from "./health";
import paydRouter from "./payd";
import payheroRouter from "./payhero";

const router: IRouter = Router();

router.use(healthRouter);
router.use(paydRouter);
router.use(payheroRouter);

export default router;
