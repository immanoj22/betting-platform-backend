import express from 'express';
import * as levelController from "../controller/levelController"
const router=express.Router()
router.route("/get_level_details").get(levelController.getLevels);
export default router;