import express from "express";
import * as coinFLipGamecontroller from "../controller/coinFlipGamecontroller";
import { userAuthorization } from "../../../../middleware/Authentications/userAuthentication";
const router = express.Router();

//game route
router
  .route("/get_all_coinFlipGame")
  .get(coinFLipGamecontroller.getallcoinFlipGame);
router
  .route("/verifycoinFlipGame")
  .post(coinFLipGamecontroller.verifyCoinFlipGame);

//new game
router
  .route("/newCoinFlipGame")
  .get(userAuthorization, coinFLipGamecontroller.getnewCoinFlipGame);

//gameConfig Route
router
  .route("/is_coinflip_game_enabled")
  .get(coinFLipGamecontroller.getallcoinFlipGameConfig);

// router.route('/update_crash_game').post(crashGamecontroller.finishCrashGame)
// router.route('/get_all_Crash_games').get(crashGamecontroller.getAllCrashGames)
export default router;
