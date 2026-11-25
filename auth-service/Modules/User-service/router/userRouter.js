import express from "express";
import * as userController from "../controller/userController";
import { userAuthorization } from "../../../middleware/Authentications/userAuthentication";
import { strictLimiter } from "../../../service/rateLimit";

const router = express.Router();
router
  .route("/user_wallet_connection")
  .post(strictLimiter, userController.userWalletConnect);
router
  .route("/user_wallet_login")
  .post(strictLimiter, userController.userWalletSignIn);
router
  .route("/user_setting_update")
  .post(userAuthorization, userController.userWalletSettingsUpdate);
router
  .route("/user_wallet_disconnect")
  .patch(userAuthorization, userController.userWalletDiscount);
router
  .route("/user_details")
  .get(userAuthorization, userController.userDetails);
router
  .route("/user_apply_reffral_code")
  .post(userAuthorization, userController.userRefererCode);
//rewards user server seed
router
  .route("/deactivate_user_server_seed")
  .post(userAuthorization, userController.deactivateUserServerSeed);

//reward social media linked accounts
router
  .route("/reward_user_linked_accounts")
  .post(userAuthorization, userController.rewardUserLinkedAccounts);
router
  .route("/transferFund")
  .post(strictLimiter, userAuthorization, userController.transferAmount);
router
  .route("/enable_disable_wallet")
  .post(userAuthorization, userController.enable_disable_wallet);

router.route("/faqs").get(userController.getFaqList);
router.route("/cms").get(userController.getCmsByLabel);
router.route("/sociallink").get(userController.getSocialLinks);

router.route("/getUsdvalue").get(userController.getUsdvalue);
router
  .route("/gettransaction")
  .get(userAuthorization, userController.getTrasnactions);
router.route("/getPandL").get(userAuthorization, userController.getPandL);
router.route("/getconfig").get(userController.getConfig);
export default router;
