import express from 'express';
import * as crashGamecontroller from '../controller/crashGamecontroller'
const router=express.Router();

//crash game route
router.route('/get_all_crashGame').get(crashGamecontroller.getallCrashGame)
router.route('/verify_Crash_game').post(crashGamecontroller.crashGameVerify)
router.route('/get_crash_full_game').get(crashGamecontroller.getCrashGamefullDetails)

//gameconfig
router.route('/is_crash_game_enabled').get(crashGamecontroller.crashGameConfigDetails)

// router.route('/update_crash_game').post(crashGamecontroller.finishCrashGame)
// router.route('/get_all_Crash_games').get(crashGamecontroller.getAllCrashGames)
export default router;