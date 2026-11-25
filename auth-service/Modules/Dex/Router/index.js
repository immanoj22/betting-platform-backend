import express from "express";

import chartRouter from "./chart.route";
import tradeRouter from "./trade.ruter";

const router=express.Router();
router.use("/chart",chartRouter);
router.use('/trade',tradeRouter);

export default router