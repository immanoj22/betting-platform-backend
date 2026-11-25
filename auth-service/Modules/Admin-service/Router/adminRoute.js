import express from "express";
import * as AdminController from "../Controller/Admin.controller";
import * as apiController from "../Controller/api.controller";

import * as decrypt from "../helper/decrypt.controller";

import * as SocialMediaController from "../Controller/SocialMediaController";
import * as boxLevelValidations from "../Validations/boxLevelValidations";

const router = express();

// Routes for Admin panel Login
router
  .route("/AdminUserLogin")
  .post(decrypt.decryptData, AdminController.AdminUserLogin);
router.route("/isAdmin").get(apiController.verifyToken(true));
router
  .route("/getuser")
  .get(apiController.verifyToken(), AdminController.getuser);
router
  .route("/gettransactiondetails")
  .get(apiController.verifyToken(), AdminController.getTransaction);
router
  .route("/pendingtranaction")
  .get(apiController.verifyToken(), AdminController.PendingTransactions);

//SocialMedia Links Module
// BS-AUTH-001 fix: require admin auth like every sibling admin route.
router
  .route("/fetch_socialMediaLinks")
  .get(apiController.verifyToken(), SocialMediaController.FetchsocialMediaLinks);
router
  .route("/update_socialmedia")
  .post(apiController.verifyToken(), SocialMediaController.updatesocialmedia);
router
  .route("/delete_socialmedia")
  .post(
    apiController.verifyToken(),
    decrypt.decryptData,
    SocialMediaController.Deletesocialmedia,
  );

//Reward

router
  .route("/reward_Config")
  .get(apiController.verifyToken(), AdminController.RewardConfig);
router
  .route("/reward_Config_update")
  .post(apiController.verifyToken(), AdminController.RewardConfigUpdate);

//gameconfig

router
  .route("/game_config")
  .get(apiController.verifyToken(), AdminController.gameconfig);
router
  .route("/gameConfig_Update")
  .post(apiController.verifyToken(), AdminController.gameconfigUpdate);

//userdetails

router
  .route("/user_totalbet")
  .get(apiController.verifyToken(), AdminController.Totalbetamount);

//Level

router
  .route("/level_add")
  .post(apiController.verifyToken(), AdminController.LevelAdd);
router
  .route("/Level_list")
  .get(apiController.verifyToken(), AdminController.Levellist);
router
  .route("/Level_Update")
  .post(apiController.verifyToken(), AdminController.Updatelevel);

//Box Levels
router
  .route("/boxlevel_add")
  .post(
    apiController.verifyToken(),
    boxLevelValidations.boxLevelValidations,
    AdminController.boxLevelAdd,
  );
router
  .route("/boxlevel_list")
  .get(apiController.verifyToken(), AdminController.boxLevelList);
router
  .route("/boxlevel_Update")
  .put(
    apiController.verifyToken(),
    boxLevelValidations.boxLevelUpdateValidations,
    AdminController.boxLevelUpdate,
  );
router
  .route("/boxCasesRewards_add")
  .post(
    apiController.verifyToken(),
    boxLevelValidations.boxCasesRewardsAddValidation,
    AdminController.boxCasesRewardsAdd,
  );
router
  .route("/boxCasesRewards_list")
  .get(apiController.verifyToken(), AdminController.boxCasesRewardsList);
// BS-AUTH-001 fix: require admin auth like every sibling admin route.
router
  .route("/boxCasesRewards_allBoxRewardList")
  .get(apiController.verifyToken(), AdminController.allboxCasesRewardsList);
router
  .route("/boxCasesRewards_Update")
  .put(
    apiController.verifyToken(),
    boxLevelValidations.boxCasesRewardsUpadteValidation,
    AdminController.boxCasesRewardsUpdate,
  );

//Export
router
  .route("/download")
  .post(apiController.verifyToken(), AdminController.downloadFiles);

router
  .route("/editpool")
  .post(apiController.verifyToken(), AdminController.editPooldetails);
// BS-AUTH-001 fix: require admin auth like every sibling admin route.
router.route("/getpool").get(apiController.verifyToken(), AdminController.getPoolDetail);
router
  .route("/faqlist")
  .get(apiController.verifyToken(), AdminController.faqList);
router
  .route("/faqAdd")
  .post(apiController.verifyToken(), AdminController.faqAdd);
router
  .route("/faqedit")
  .post(apiController.verifyToken(), AdminController.faqEdit);
router
  .route("/faqdelete")
  .post(apiController.verifyToken(), AdminController.faqDelete);

router
  .route("/cmslist")
  .get(apiController.verifyToken(), AdminController.cmsList);
router
  .route("/cmsAdd")
  .post(apiController.verifyToken(), AdminController.cmsAdd);
router
  .route("/cmsedit")
  .post(apiController.verifyToken(), AdminController.cmsEdit);
router
  .route("/cmsdelete")
  .post(apiController.verifyToken(), AdminController.cmsDelete);
module.exports = router;
