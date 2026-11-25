/** Packages */
import express from "express";
import userRoutes from "../Modules/User-service/router/userRouter.js"
import rewardrouter from "../Modules/reward/route/rewardRoute.js"
import levelRouter from "../Modules/levels/router/levelRouter.js";
import oauthRouter from "../Modules/Oauth/router/router.js"
import dexRouter from "../Modules/Dex/Router/index.js"
const router = express.Router();

router.use("/oauth",oauthRouter)
router.use("/user",userRoutes);
router.use("/reward",rewardrouter)
router.use("/level",levelRouter)
router.use('/dex',dexRouter)

module.exports = router;
