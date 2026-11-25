import express from "express"
import { burnDash, getBurnList, getPoolDetails, getPositionDetails, getTokenPrice, getTrades, positionSave, removeLiquidity, trade } from "../Controller/trade.controller";
import { userAuthorization } from "../../../middleware/Authentications/userAuthentication";
const router=express.Router();
router.route("/tradesave").post(userAuthorization,trade)
router.route("/gettrades").get(userAuthorization,getTrades)
router.route("/gettokenprice").get(getTokenPrice)
router.route("/positionsave").post(userAuthorization,positionSave)
router.route("/removeliquidity").post(userAuthorization,removeLiquidity)
router.route("/getpooldetail").get(getPoolDetails)
router.route("/getpositiondetail").get(userAuthorization,getPositionDetails)
router.route("/getburnlist").get(getBurnList)
router.route("/getburndashdata").get(burnDash)
// router.route("/dashboardData").get()
export default router