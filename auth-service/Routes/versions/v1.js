import express from "express";
import routes from "../commonRoute";

const router = express.Router();

// Mount first
router.use("/v1", routes);


module.exports = router;