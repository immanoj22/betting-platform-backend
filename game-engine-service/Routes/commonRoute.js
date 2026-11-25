/** Packages */
import express from "express";
import crashGameroutes from "../Modules/Game-service/crashGame/route/crashGameRoute"
import coinFlipGameroutes from "../Modules/Game-service/coinFlip/route/coinFlipGameRoute"
const router = express.Router();

router.use("/game", crashGameroutes);
router.use("/game", coinFlipGameroutes);
module.exports = router;
