import express from "express"
import * as rewardController from "../controller/rewardController"
import { userAuthorization } from "../../../middleware/Authentications/userAuthentication";

const router=express.Router();

router.route("/get_user_reward").get(userAuthorization,rewardController.getUserRewardDetails);
router.route("/reedem_refreal_code").post(userAuthorization,rewardController.redeemRefrealBonus)
router.route("/reffral_Details").get(userAuthorization,rewardController.getReffralDetails)

//reward config
router.route("/get_reward_config").get(rewardController.getRewardConfig)
router.route("/spin_daily_case").get(userAuthorization,rewardController.spinDailyCase)
router.route("/retire_server_seed").get(userAuthorization,rewardController.retireServerSeed)

//USER REWARD SEED MANAGEMENT
router.route("/get_user_server_seed").get(userAuthorization,rewardController.getUserServerSeed)
router.route("/claim_user_reward").get(userAuthorization,rewardController.claimUserReward)
router.route("/user_daily_case").get(userAuthorization,rewardController.userDailycaseBoxDetails)
router.route("/get_all_daily_box").get(userAuthorization,rewardController.getAllDailyCaseBox)
export default router