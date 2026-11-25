import express from "express"
import { getBurnChartData, getDashboardStats, getTokenPriceCandle } from "../Controller/chart.controller";
const router=express.Router();
router.route("/getchart").get(getTokenPriceCandle);
router.route("/getdashstats").get(getDashboardStats)
router.route("/burnchart").get(getBurnChartData)
export default router
