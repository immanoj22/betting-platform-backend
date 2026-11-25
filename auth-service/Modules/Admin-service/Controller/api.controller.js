//import files
import AdminModel from "../Model/Admin";

//import packages
import mongoose from "mongoose";

import { sendResponse } from "../lib/sendResponseFn";

const ObjectId = mongoose.Types.ObjectId;
export const verifyToken = (skip = false) => {
  return async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.split("Bearer ")?.join("");
      console.log("🚀 ~ verifyToken ~ token:", token);
      const decodingData = new AdminModel().decodejwt(token);
      const userDoc = await AdminModel.findOne({
        _id: new ObjectId(decodingData._id),
      });
      const data = {
        id: userDoc?._id,
        email: userDoc?.email,
      };
      req.user = data;
      if (skip) {
        return sendResponse(res, 200, {
          status: true,
          message: "Token Verified.",
        });
      }
      return next();
    } catch (err) {
      console.log("verifyToken-error", err);
      if (err.name === "TokenExpiredError") {
        return sendResponse(res, 401, {
          status: false,
          message: "Session expired. Please login again.",
        });
      }
      return sendResponse(res, 400, {
        status: false,
        message: "Invalid Token",
      });
    }
  };
};
