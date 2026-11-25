//Import Packages
import jwt from "jsonwebtoken";

//Import Schema
import Admin from "../Model/Admin";
//import User from '../Model/User'
import users from "../../User-service/model/UserSchema";

import Reward from "../../reward/model/rewardConfig";

import gameConfig from "../../Commonmodel/gameConfig";

import Bets from "../../Commonmodel/BetSchema";

import Level from "../../levels/model/levelSchema";

import gameSession from "../../Commonmodel/gameSession";

import Transaction from "../../Commonmodel/TransactionSChema";

import poolDetailSchema from "../../Dex/Models/poolDetail.schema";

import { Save, find, findone, FindOneAndUpdate } from "../Hooks/mongoosehelper";

//Import files
import { sendResponse } from "../lib/sendResponseFn";
import { fileUpload } from "../../../library/filesystem";
import dailycasebox from "../../levels/model/levelCasesBox";
import { boxCasesRewards } from "../../levels/model/boxCasesRewards";

import { Parser } from "json2csv";
import PDFDocument from "pdfkit";
import config from "../../../config";
import ExcelJS from "exceljs";
import faqModel from "../Model/faqModel";
import cmsModel from "../Model/cmsModel";

/**
 * Administrator Login
 * METHOD: POST
 **/
export const AdminUserLogin = async (req, res) => {
  try {
    let reqBody = req.body;
    console.log("req-------body", req.body);
    reqBody.email = reqBody.email.toLowerCase();

    let checkUser = await Admin.findOne({ email: reqBody.email });
    if (!checkUser) {
      return sendResponse(res, 400, {
        status: false,
        message: "Email not found",
      });
    }

    if (!checkUser.authenticate(reqBody.password)) {
      return sendResponse(res, 400, {
        status: false,
        message: "Password incorrect",
      });
    }

    const payloadData = {
      _id: checkUser._id,
      restriction: checkUser.restriction,
      role: checkUser.role,
      name: checkUser.name,
      email: checkUser.email,
    };
    const token = new Admin().generateJWT(payloadData);
    console.log("Admin_token", token);

    return sendResponse(res, 200, {
      status: true,
      message: "Login Successfully",
      token,
    });
  } catch (err) {
    console.log("AdminUserLogin", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

/**
 * Displaying details of user profile, including personal information, contact details
 * METHOD: POST
 **/
export const getProfile = async (req, res) => {
  try {
    const result = await Admin.findOne({ _id: req.user.id }).select({
      name: 1,
      email: 1,
    });
    if (result) {
      return sendResponse(res, 200, {
        status: true,
        message: "Listed successfully",
        data: result,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (err) {
    console.log("getProfile err", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

/**
 * Modify the content of the name field for profile editing
 * METHOD: POST
 **/
export const editProfile = async (req, res) => {
  try {
    let reqBody = req.body;
    if (!reqBody?.name) {
      return sendResponse(res, 400, {
        status: true,
        message: "Name is Required",
      });
    }
    const update = await Admin.findOneAndUpdate(
      { _id: req.user.id },
      { $set: { name: reqBody.name } },
      { new: true },
    );
    if (update) {
      return sendResponse(res, 200, {
        status: true,
        message: "Updated successfully",
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (err) {
    console.log("editProfile", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

/**
 * Retrieve the user information
 * METHOD: GET
 **/
export const getuser = async (req, res) => {
  try {
    const userData = await users.find({}).sort({ _id: -1 });
    console.log("userData---", userData);
    if (userData) {
      return sendResponse(res, 200, {
        status: true,
        message: "Listed Successfully",
        data: userData,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (err) {
    console.log("getuser err", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const getTransaction = async (req, res) => {
  try {
    const userTransactionData = await gameSession.aggregate([
      {
        $lookup: {
          from: "bets",
          let: { gameSessionId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$gameId", "$$gameSessionId"],
                },
              },
            },
            {
              $lookup: {
                from: "transactions",
                let: { betId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$referenceId", "$$betId"],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$transactionType", // group by transaction type
                      totalAmount: { $sum: "$transactionAmount" }, // sum amount
                      count: { $sum: 1 },
                    },
                  },
                ],
                as: "transactiondetails",
              },
            },
            { $unwind: "$transactiondetails" },
            {
              $group: {
                _id: "$transactiondetails._id", // group by transaction type
                totalAmount: { $sum: "$transactiondetails.totalAmount" }, // sum amount
                count: { $sum: 1 },
              },
            },
          ],
          as: "transactionSummary",
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);
    if (userTransactionData) {
      return sendResponse(res, 200, {
        status: true,
        message: "Listed Successfully",
        data: userTransactionData,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (err) {
    console.log("getuser err", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const RewardConfig = async (req, res) => {
  try {
    console.log("hiiiiiiiiiiiiiiiiiiiiiiiiii");
    const rewardData = await Reward.find({}).sort({ _id: -1 });
    console.log("rewardData---", rewardData);
    if (rewardData) {
      return sendResponse(res, 200, {
        status: true,
        message: "Listed Successfully",
        data: rewardData,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    console.log("Reward_Config_", error);
  }
};

export const RewardConfigUpdate = async (req, res) => {
  try {
    console.log("req_body_RewardConfigUpdate", req.body);

    let reqBody = req.body.token;
    const checkdata = await Reward.findOne({ _id: reqBody._id });
    if (checkdata) {
      const updatedata = {
        isEnabled: reqBody.isEnabled,
        rewardType: reqBody.rewardType,
        percentageOfWagerPool: reqBody.percentageOfWagerPool,
        maxLimit: reqBody.maxLimit,
        minXp: reqBody.minXp,
        maxTip: reqBody.maxTip,
        minTip: reqBody.minTip,
        eligibleLevel: reqBody.eligibleLevel,
        distributionInSeconds: reqBody.distributionInSeconds,
        rewardAssetSymbol: reqBody.rewardAssetSymbol,
      };
      console.log("update_reward_", updatedata);
      const data = {
        DBName: Reward,
        finData: { _id: reqBody._id },
        updata: { $set: updatedata },
        save: { new: true },
      };
      const result = await FindOneAndUpdate(data);
      if (result) {
        return sendResponse(res, 200, {
          status: true,
          message: "RewardConfig Updated Successfully",
        });
      } else {
        return sendResponse(res, 400, {
          status: false,
          message: "Error occured",
        });
      }
    }
  } catch (error) {
    console.log("RewardConfigUpdate_error", error);
  }
};

//Game

export const gameconfig = async (req, res) => {
  try {
    const rewardData = await gameConfig.find({}).sort({ _id: -1 });
    console.log("gameconfig---", rewardData);
    if (rewardData) {
      return sendResponse(res, 200, {
        status: true,
        message: " Gameconfig Listed Successfully",
        data: rewardData,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    console.log("Reward_Config_", error);
  }
};

export const gameconfigUpdate = async (req, res) => {
  try {
    console.log("gameconfigUpdate_req_body", req.body);

    let reqBody = req.body.token;

    let {
      isEnabled,
      maxBetAmount,
      minBetAmount,
      xpForWinners,
      adminFee,
      xpPerBet,
      vaultReserve,
    } = reqBody;
    // ✅ Required check
    if (minBetAmount == null || maxBetAmount == null) {
      return sendResponse(res, 400, {
        status: false,
        message: "minBetAmount and maxBetAmount are required",
      });
    }

    // ✅ Number check
    if (isNaN(minBetAmount) || isNaN(maxBetAmount)) {
      return sendResponse(res, 400, {
        status: false,
        message: "Bet amounts must be valid numbers",
      });
    }

    const minBet = Number(minBetAmount);
    const maxBet = Number(maxBetAmount);

    // ✅ Non-negative
    if (minBet < 0 || maxBet < 0) {
      return sendResponse(res, 400, {
        status: false,
        message: "Bet amounts must be non-negative",
      });
    }

    // ✅ Logical check
    if (minBet >= maxBet) {
      return sendResponse(res, 400, {
        status: false,
        message: "minBetAmount must be less than maxBetAmount",
      });
    }

    const checkdata = await gameConfig.findOne({ _id: reqBody._id });
    if (checkdata) {
      const updatedata = {
        isEnabled: isEnabled,
        maxBetAmount: maxBetAmount,
        minBetAmount: minBetAmount,
        xpForWinners: xpForWinners,
        adminFee: adminFee,
        xpPerBet: xpPerBet,
        vaultReserve: vaultReserve,
      };
      console.log("update_reward_", updatedata);
      const data = {
        DBName: gameConfig,
        finData: { _id: reqBody._id },
        updata: { $set: updatedata },
        save: { new: true },
      };
      const result = await FindOneAndUpdate(data);
      if (result) {
        return sendResponse(res, 200, {
          status: true,
          message: "GameconfigUpdate Updated Successfully",
        });
      } else {
        return sendResponse(res, 400, {
          status: false,
          message: "Error occured",
        });
      }
    }
  } catch (error) {
    console.log("gameconfigUpdate_error", error);
  }
};

export const Totalbetamount = async (req, res) => {
  try {
    const betamountData = await Bets.aggregate([
      {
        $group: {
          _id: null,
          totalBetAmount: { $sum: "$betamountUI" },
        },
      },
    ]);
    console.log("betamountData_betamountData", betamountData);
    if (betamountData) {
      return sendResponse(res, 200, {
        status: true,
        message: " betamountData Listed Successfully",
        data: betamountData,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    console.log("Reward_Config_", error);
  }
};

//level

export const LevelAdd = async (req, res) => {
  try {
    let reqBody = req.body.token;
    console.log("req-------Level", reqBody);

    const { levelNumber, minXp, maxXp } = reqBody;

    const levelExists = await Level.findOne({ levelNumber });

    if (levelExists) {
      return sendResponse(res, 400, {
        status: false,
        message: `Level ${levelNumber} already exists!`,
      });
    }

    // ---------- 2. Check for XP range overlap ----------
    const rangeExists = await Level.findOne({
      $or: [
        { minXp: { $lte: maxXp, $gte: minXp } }, // minXp within range
        { maxXp: { $lte: maxXp, $gte: minXp } }, // maxXp within range
        { minXp: { $lte: minXp }, maxXp: { $gte: maxXp } }, // existing range fully covers new
      ],
    });

    if (rangeExists) {
      return sendResponse(res, 400, {
        status: false,
        message: `XP range ${minXp}-${maxXp} overlaps with existing level ${rangeExists.levelNumber}!`,
      });
    }

    const payloadData = {
      levelNumber: reqBody.levelNumber,
      minXp: reqBody.minXp,
      maxXp: reqBody.maxXp,
    };
    const data = new Level(payloadData);
    await data.save();
    console.log("LevelAdd_final", data);

    return sendResponse(res, 200, {
      status: true,
      message: "Add Successfully",
      data,
    });
  } catch (err) {
    console.log("LevelAdd", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const Levellist = async (req, res) => {
  try {
    const levellist = await Level.find({}).sort({ _id: -1 });
    console.log("levellist---", levellist);
    if (levellist) {
      return sendResponse(res, 200, {
        status: true,
        message: " levellist Listed Successfully",
        data: levellist,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    console.log("levellist_", error);
  }
};

export const Updatelevel = async (req, res) => {
  try {
    console.log("Updatelevel_Updatelevel", req.body);
    let reqBody = req.body.token;
    let updata = {
      levelNumber: reqBody.levelNumber,
      minXp: reqBody.minXp,
      maxXp: reqBody.maxXp,
    };
    const { levelNumber, minXp, maxXp, _id } = reqBody;

    // ---------- 2. Check for XP range overlap ----------
    const rangeExists = await Level.findOne({
      _id: { $ne: _id },
      $or: [
        { minXp: { $lte: maxXp, $gte: minXp } }, // minXp within range
        { maxXp: { $lte: maxXp, $gte: minXp } }, // maxXp within range
        { minXp: { $lte: minXp }, maxXp: { $gte: maxXp } }, // existing range fully covers new
      ],
    });

    if (rangeExists) {
      return sendResponse(res, 400, {
        status: false,
        message: `XP range ${minXp}-${maxXp} overlaps with existing level ${rangeExists.levelNumber}!`,
      });
    }

    if (updata) {
      const data = {
        DBName: Level,
        finData: { _id: _id },
        updata: { $set: updata },
        save: { new: true },
      };
      const result = await FindOneAndUpdate(data);
      if (result) {
        return sendResponse(res, 200, {
          status: true,
          message: "Updated successfully.",
        });
      } else {
        return sendResponse(res, 400, {
          status: false,
          message: "Unable to update settings.",
        });
      }
    }
  } catch (err) {
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const PendingTransactions = async (req, res) => {
  try {
    let query = [
      {
        $match: {
          status: "pending",
          // transactionType: "cashout",
        },
      },
      {
        $facet: {
          allPending: [
            { $sort: { createdAt: -1 } }, // optional sorting
          ],
          groupedData: [
            {
              $group: {
                _id: "$transactionFrom",
                address: { $first: "$fromAddress" },
                totalAmount: { $sum: "$transactionAmount" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];
    let data = await Transaction.aggregate(query);

    if (data?.length > 0) {
      return sendResponse(res, 200, {
        status: true,
        message: "data fetched successfully.",
        data: data,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Unable to fetched data",
      });
    }
  } catch (err) {
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

//Box Level
export const boxLevelAdd = async (req, res) => {
  try {
    const { levelName, minXp, maxXp, minBetedAmount, minAccountBalance } =
      req.body;
    const boximage = req.files.boximage;

    if (minXp == null || maxXp == null) {
      return sendResponse(res, 400, {
        status: false,
        message: "minXp and maxXp are required",
      });
    }

    if (Number(minXp) < 0 || Number(maxXp) < 0) {
      return sendResponse(res, 400, {
        status: false,
        message: "XP values must be non-negative",
      });
    }

    if (Number(minXp) >= Number(maxXp)) {
      return sendResponse(res, 400, {
        status: false,
        message: "minXp must be less than maxXp",
      });
    }

    const overlap = await dailycasebox.findOne({
      $or: [
        {
          minXp: { $lte: Number(maxXp) },
          maxXp: { $gte: Number(minXp) },
        },
      ],
    });

    if (overlap) {
      return sendResponse(res, 400, {
        status: false,
        message: "XP range overlaps with existing level",
      });
    }

    const exist = await dailycasebox.findOne({ levelName });

    if (exist) {
      return sendResponse(res, 400, {
        status: false,
        message: "Level name already exists",
      });
    }

    const fileExt = boximage.name.split(".").pop();
    const fileName = `${levelName}_${Date.now()}.${fileExt}`;

    await fileUpload(boximage, "boxLevel", fileName);

    //Adds if the levelName doesn't exists
    const newLevel = new dailycasebox({
      levelName,
      minXp,
      maxXp,
      minBetedAmount,
      minAccountBalance,
      boximage: `/boxLevel/${fileName}`,
    });

    await newLevel.save();

    return sendResponse(res, 200, {
      status: true,
      message: "Level added successfulLy",
      data: newLevel,
    });
  } catch (error) {
    //console.error("boxLevelAdd_error : ", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const boxLevelList = async (req, res) => {
  try {
    const levelBoxList = await dailycasebox.find({}).sort({ minXp: 1 });
    //console.log("levelList---", levelBoxList);
    if (levelBoxList) {
      return sendResponse(res, 200, {
        status: true,
        message: " levelBoxlist Listed SuccessfulLy",
        data: levelBoxList,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    //console.log("levelList_", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const boxLevelUpdate = async (req, res) => {
  try {
    const { _id, levelName, minXp, maxXp, minBetedAmount, minAccountBalance } =
      req.body;
    const boximage = req.files?.boximage;

    const updateLevel = await dailycasebox.findOne({ _id });
    if (!updateLevel) {
      return sendResponse(res, 400, {
        status: false,
        message: "Level doesn't exists",
      });
    }

    // ✅ Required check
    if (minXp == null || maxXp == null) {
      return sendResponse(res, 400, {
        status: false,
        message: "minXp and maxXp are required",
      });
    }

    // ✅ Number + non-negative
    if (isNaN(minXp) || isNaN(maxXp)) {
      return sendResponse(res, 400, {
        status: false,
        message: "XP must be a valid number",
      });
    }

    if (Number(minXp) < 0 || Number(maxXp) < 0) {
      return sendResponse(res, 400, {
        status: false,
        message: "XP values must be non-negative",
      });
    }

    // ✅ Logical check
    if (Number(minXp) >= Number(maxXp)) {
      return sendResponse(res, 400, {
        status: false,
        message: "minXp must be less than maxXp",
      });
    }

    const overlap = await dailycasebox.findOne({
      _id: { $ne: _id }, // exclude current record
      minXp: { $lt: Number(maxXp) },
      maxXp: { $gt: Number(minXp) },
    });

    if (overlap) {
      return sendResponse(res, 400, {
        status: false,
        message: "XP range overlaps with existing level",
      });
    }

    const exist = await dailycasebox.findOne({ levelName, _id: { $ne: _id } });

    if (exist) {
      return sendResponse(res, 400, {
        status: false,
        message: "Level name already exists",
      });
    }
    let fileName;
    if (boximage) {
      const fileExt = boximage.name.split(".").pop();
      fileName = `${levelName}_${Date.now()}.${fileExt}`;

      await fileUpload(boximage, "boxLevel", fileName);
    }

    //Adds if the levelName doesn't exists
    updateLevel.levelName = levelName;
    updateLevel.minXp = minXp;
    updateLevel.maxXp = maxXp;
    updateLevel.minBetedAmount = minBetedAmount;
    updateLevel.minAccountBalance = minAccountBalance;
    updateLevel.boximage = boximage
      ? `/boxLevel/${fileName}`
      : updateLevel.boximage;
    await updateLevel.save();

    return sendResponse(res, 200, {
      status: true,
      message: "Level updated successfulLy",
      data: updateLevel,
    });
  } catch (error) {
    //console.error("boxLevelUpdate_error : ", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

//Box Level
export const boxCasesRewardsAdd = async (req, res) => {
  try {
    let { boxCaseId, range, assetType, assetAmount } = req.body;
    //console.log(" boxCaseId, range, assetType, assetAmount : ",{ boxCaseId, range, assetType, assetAmount });
    range = parseFloat(range);
    //console.log(" boxCaseId, range, assetType, assetAmount : ",{ boxCaseId, range, assetType, assetAmount });
    const levelBox = await dailycasebox
      .findOne({ _id: boxCaseId })
      .sort({ _id: -1 });
    const boxCasesRewardsList = await boxCasesRewards
      .findOne({ boxCaseId })
      .sort({ minProbalityPercentage: -1 });
    //console.log("boxCasesRewardsList : ", boxCasesRewardsList, boxCasesRewardsList?.maxProbalityPercentage);
    if (
      boxCasesRewardsList?.maxProbalityPercentage &&
      boxCasesRewardsList.maxProbalityPercentage + range <= 100
    ) {
      //console.log("boxCasesRewardsList.maxProbalityPercentage + range <= 100 : ", range, boxCasesRewardsList.maxProbalityPercentage, (boxCasesRewardsList.maxProbalityPercentage + range));

      const newLevelReward = new boxCasesRewards({
        boxCaseId: levelBox._id,
        minProbalityPercentage: boxCasesRewardsList.maxProbalityPercentage,
        maxProbalityPercentage:
          boxCasesRewardsList.maxProbalityPercentage + range,
        assetType,
        assetAmount,
      });
      await newLevelReward.save();

      return sendResponse(res, 200, {
        status: true,
        message: "Level Rewards added successfulLy",
        data: newLevelReward,
      });
    } else if (boxCasesRewardsList?.maxProbalityPercentage === undefined) {
      const newLevelReward = new boxCasesRewards({
        boxCaseId: levelBox._id,
        minProbalityPercentage: 0,
        maxProbalityPercentage: range,
        assetType,
        assetAmount,
      });
      await newLevelReward.save();

      return sendResponse(res, 200, {
        status: true,
        message: "Level Rewards added successfulLy",
        data: newLevelReward,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: `${boxCasesRewardsList.maxProbalityPercentage + range} exceeds Maximum Probality Percentage of 100`,
      });
    }
  } catch (error) {
    //console.error("boxCasesRewardsAdd_error : ", error);
    return sendResponse(res, 400, {
      status: false,
      message: "Error occured",
    });
  }
};

export const boxCasesRewardsList = async (req, res) => {
  try {
    const boxCaseId = req.query.boxCaseId;
    const levelBoxlistRaw = await boxCasesRewards
      .find({ boxCaseId })
      .populate("boxCaseId")
      .sort({ minProbalityPercentage: 1 })
      .lean();
    //console.log("levelList---", levelBoxlist);
    let levelBoxlist = levelBoxlistRaw.map((item) => {
      const box = item.boxCaseId;
      return {
        _id: item._id,
        boxCaseId: box._id,
        levelName: box.levelName,
        minXp: box.minXp,
        maxXp: box.maxXp,
        minBetedAmount: box.minBetedAmount,
        minAccountBalance: box.minAccountBalance,
        boximage: box.boximage,
        minProbalityPercentage: item.minProbalityPercentage,
        maxProbalityPercentage: item.maxProbalityPercentage,
        assetType: item.assetType,
        assetAmount: item.assetAmount,
        __v: item.__v,
      };
    });
    if (levelBoxlist) {
      return sendResponse(res, 200, {
        status: true,
        message: " Box Case Rewards Listed SuccessfulLy",
        data: levelBoxlist,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    //console.log("levelList_", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const allboxCasesRewardsList = async (req, res) => {
  try {
    // const boxCaseId = req.query.boxCaseId;
    // const levelBoxlist = await boxCasesRewards.find({}).populate("boxCaseId").sort({ minProbalityPercentage: 1 });
    // const levelBoxlist = await dailycasebox.aggregate([
    //   {
    //     $sort: { minXp: 1 }
    //   },
    //   {
    //     $lookup: {
    //       from: "boxrewards",
    //       localField: "_id",
    //       foreignField: "boxCaseId",
    //       as: "rewards"
    //     }
    //   },
    //   {
    //     $unwind: {
    //       path: "$rewards",
    //       preserveNullAndEmptyArrays: true
    //     }
    //   },
    //   {
    //     $sort: {
    //       "rewards.minProbalityPercentage": 1
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: "$_id",
    //       levelName: { $first: "$levelName" },
    //       minXp: { $first: "$minXp" },
    //       maxXp: { $first: "$maxXp" },
    //       minBetedAmount: { $first: "$minBetedAmount" },
    //       minAccountBalance: { $first: "$minAccountBalance" },
    //       boximage: { $first: "$boximage" },
    //       rewards: { $push: "$rewards" }
    //     }
    //   },
    //   {
    //     $sort: { minXp: 1 }
    //   }
    // ]);
    const levelBoxlistRaw = await boxCasesRewards
      .find({})
      .populate("boxCaseId")
      .sort({ minProbalityPercentage: 1 })
      .lean();

    let levelBoxlist = levelBoxlistRaw.map((item) => {
      const box = item.boxCaseId;
      return {
        _id: item._id,
        boxCaseId: box._id,
        levelName: box.levelName,
        minXp: box.minXp,
        maxXp: box.maxXp,
        minBetedAmount: box.minBetedAmount,
        minAccountBalance: box.minAccountBalance,
        boximage: box.boximage,
        minProbalityPercentage: item.minProbalityPercentage,
        maxProbalityPercentage: item.maxProbalityPercentage,
        assetType: item.assetType,
        assetAmount: item.assetAmount,
        __v: item.__v,
      };
    });
    levelBoxlist = levelBoxlist.sort((a, b) => {
      if (a.minXp !== b.minXp) {
        return a.minXp - b.minXp;
      }
      return a.minProbalityPercentage - b.minProbalityPercentage;
    });

    // console.log("levelList---", JSON.stringify(levelBoxlist, null, 2));
    if (levelBoxlist) {
      return sendResponse(res, 200, {
        status: true,
        message: " Box Case Rewards Listed SuccessfulLy",
        data: levelBoxlist,
      });
    } else {
      return sendResponse(res, 400, {
        status: false,
        message: "Error occured",
      });
    }
  } catch (error) {
    //console.log("levelList_", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const boxCasesRewardsUpdate = async (req, res) => {
  try {
    let {
      boxCaseId,
      _id,
      minProbalityPercentage,
      maxProbalityPercentage,
      assetType,
      assetAmount,
    } = req.body;
    console.log(
      "boxCaseId, _id, minProbalityPercentage, maxProbalityPercentage, assetType, assetAmount : ",
      {
        boxCaseId,
        _id,
        minProbalityPercentage,
        maxProbalityPercentage,
        assetType,
        assetAmount,
      },
    );
    minProbalityPercentage = parseFloat(minProbalityPercentage);
    maxProbalityPercentage = parseFloat(maxProbalityPercentage);
    console.log(
      "boxCaseId, _id, minProbalityPercentage, maxProbalityPercentage, assetType, assetAmount : ",
      {
        boxCaseId,
        _id,
        minProbalityPercentage,
        maxProbalityPercentage,
        assetType,
        assetAmount,
      },
    );
    const levelBox = await dailycasebox.findOne({ _id: boxCaseId });
    console.log("levelBox : ", levelBox);
    if (levelBox === null) {
      return sendResponse(res, 400, {
        status: false,
        message: "No such box case.",
      });
    }
    const levelBoxReward = await boxCasesRewards.findOne({ _id });
    console.log("levelBoxReward : ", levelBoxReward);
    if (levelBoxReward === null) {
      return sendResponse(res, 400, {
        status: false,
        message: "No such box reward.",
      });
    }
    if (levelBoxReward?.minProbalityPercentage != minProbalityPercentage) {
      const boxCasesReward_previous = await boxCasesRewards.findOne({
        maxProbalityPercentage: levelBoxReward.minProbalityPercentage,
        boxCaseId,
      });
      console.log(
        "boxCasesReward_previous : ",
        boxCasesReward_previous,
        boxCasesReward_previous?.minProbalityPercentage >=
          minProbalityPercentage,
      );
      if (!boxCasesReward_previous && minProbalityPercentage != 0) {
        return sendResponse(res, 400, {
          status: false,
          message: `The first reward of the box's Minimum Probabilty Precentage should be 0`,
        });
      }
      if (
        boxCasesReward_previous &&
        boxCasesReward_previous.minProbalityPercentage >= minProbalityPercentage
      ) {
        return sendResponse(res, 400, {
          status: false,
          message: `Please check the previous probability reward ${boxCasesReward_previous.minProbalityPercentage} - ${boxCasesReward_previous.maxProbalityPercentage} `,
        });
      }
      const boxCasesReward_next = await boxCasesRewards.findOne({
        minProbalityPercentage: levelBoxReward.maxProbalityPercentage,
        boxCaseId,
      });
      console.log(
        "boxCasesReward_next : ",
        boxCasesReward_next,
        boxCasesReward_next?.maxProbalityPercentage >= maxProbalityPercentage,
      );
      if (
        boxCasesReward_next &&
        boxCasesReward_next.maxProbalityPercentage <= maxProbalityPercentage
      ) {
        return sendResponse(res, 400, {
          status: false,
          message: `Please check the next probability reward ${boxCasesReward_next.minProbalityPercentage} - ${boxCasesReward_next.maxProbalityPercentage} `,
        });
      }
      if (boxCasesReward_next) {
        boxCasesReward_next.minProbalityPercentage = maxProbalityPercentage;
        await boxCasesReward_next.save();
      }
      levelBoxReward.maxProbalityPercentage = maxProbalityPercentage;
      boxCasesReward_previous.maxProbalityPercentage = minProbalityPercentage;
      levelBoxReward.minProbalityPercentage = minProbalityPercentage;
      await boxCasesReward_previous.save();
    }
    if (levelBoxReward.maxProbalityPercentage != maxProbalityPercentage) {
      const boxCasesReward_next = await boxCasesRewards.findOne({
        minProbalityPercentage: levelBoxReward.maxProbalityPercentage,
        boxCaseId,
      });
      console.log("boxCasesReward_next : ", boxCasesReward_next);
      if (
        boxCasesReward_next &&
        boxCasesReward_next.maxProbalityPercentage <= maxProbalityPercentage
      ) {
        return sendResponse(res, 400, {
          status: false,
          message: `Please check the next probability reward ${boxCasesReward_next.minProbalityPercentage} - ${boxCasesReward_next.maxProbalityPercentage} `,
        });
      }
      if (boxCasesReward_next) {
        boxCasesReward_next.minProbalityPercentage = maxProbalityPercentage;
        await boxCasesReward_next.save();
      }
      levelBoxReward.maxProbalityPercentage = maxProbalityPercentage;
    }

    levelBoxReward.assetType = assetType;
    levelBoxReward.assetAmount = assetAmount;
    await levelBoxReward.save();

    return sendResponse(res, 200, {
      status: true,
      message: "Box Case Rewards Updated SuccessfulLy",
      data: await boxCasesRewards
        .find({ boxCaseId })
        .sort({ minProbalityPercentage: 1 }),
    });
  } catch (error) {
    console.error("boxCasesRewardsUpdate_error", error);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const downloadFiles = async (req, res) => {
  try {
    const { fileType, name, datas } = req.body;
    console.log("downloadFiles : ", fileType, name, datas);
    let data;
    if (name === "Crash List") {
      const apiData = await gameSession.aggregate([
        {
          $lookup: {
            from: "bets",
            let: { gameSessionId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$gameId", "$$gameSessionId"],
                  },
                },
              },
              {
                $lookup: {
                  from: "transactions",
                  let: { betId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$referenceId", "$$betId"],
                        },
                      },
                    },
                    {
                      $group: {
                        _id: "$transactionType", // group by transaction type
                        totalAmount: { $sum: "$transactionAmount" }, // sum amount
                        count: { $sum: 1 },
                      },
                    },
                  ],
                  as: "transactiondetails",
                },
              },
              { $unwind: "$transactiondetails" },

              {
                $group: {
                  _id: "$transactiondetails._id", // group by transaction type
                  totalAmount: { $sum: "$transactiondetails.totalAmount" }, // sum amount
                  count: { $sum: 1 },
                },
              },
            ],
            as: "transactionSummary",
          },
        },
      ]);
      // console.log("downloadFiles_apiData : ",JSON.stringify(apiData,null,2));

      const filteredData = apiData?.filter(
        (item) =>
          (item.gameType || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.status || "").toLowerCase().includes(datas.toLowerCase()),
      );
      // console.log("downloadFiles_filteredData : ",JSON.stringify(filteredData,null,2));

      data = filteredData.map((item) => ({
        gameType: item.gameType,
        status: item.status,
        totalAmount1: item.transactionSummary?.[0]?.totalAmount ?? 0,
        totalAmount2: item.transactionSummary?.[1]?.totalAmount ?? 0,
      }));
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "Pending Transaction Details") {
      let query = [
        {
          $match: {
            status: "pending",
            transactionType: "cashout",
          },
        },
        {
          $facet: {
            allPending: [
              { $sort: { createdAt: -1 } }, // optional sorting
            ],
            // groupedData: [
            //   {
            //     $group: {
            //       _id: "$transactionFrom",
            //       address: { $first: "$fromAddress" },
            //       totalAmount: { $sum: "$transactionAmount" },
            //       count: { $sum: 1 },
            //     },
            //   },
            // ],
          },
        },
      ];
      let apiData = await Transaction.aggregate(query);
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));
      const facetResult = apiData[0] || {};
      const allPending = facetResult.allPending || [];
      // const groupedData = facetResult.groupedData || [];

      apiData = [
        ...allPending.map((tx) => ({
          type: "DETAIL",
          ...tx,
        })),
        // ...groupedData.map(g => ({
        //   type: "SUMMARY",
        //   // transactionFrom: g._id,
        //   // address: g.address,
        //   // totalAmount: g.totalAmount,
        //   // count: g.count,
        //   ...g
        // }))
      ];
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));

      const filteredData = apiData?.filter(
        (item) =>
          (item.transactionFrom || "")
            .toLowerCase()
            .includes(datas.toLowerCase()) ||
          (item.toAddress || "").toLowerCase().includes(datas.toLowerCase()),
      );
      // console.log("downloadFiles_filteredData : ",JSON.stringify(filteredData,null,2));

      data = filteredData.map(
        ({ _id, __v, createdAt, updatedAt, ...rest }) => rest,
      );
      console.log("downloadFiles_data : ", data, JSON.stringify(data, null, 2));
    } else if (name === "Game Control") {
      const apiData = await gameConfig.find({}).sort({ _id: -1 });
      // console.log("downloadFiles_apiData : ",JSON.stringify(apiData,null,2));

      const filteredData = apiData?.filter(
        (item) =>
          (item.gameType || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.minBetAmount + "")
            .toLowerCase()
            .includes(datas.toLowerCase()) ||
          (item.maxBetAmount + "").toLowerCase().includes(datas.toLowerCase()),
      );
      // console.log("downloadFiles_filteredData : ",JSON.stringify(filteredData,null,2));

      data = filteredData.map((item) => {
        const obj = item.toObject();
        const { _id, __v, ...rest } = obj;
        return rest;
      });
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "User List") {
      // let apiData = await users.find({}).sort({ _id: -1 }).populate({ path: "referredBy", select: "nickName email walletAddress referralCode" }).lean();
      let apiData = await users.find({}).sort({ _id: -1 }).lean();
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));

      apiData = await Promise.all(
        apiData.map(async (item) => {
          if (item.referredBy !== "") {
            const refer = await users.findOne({ _id: item.referredBy }).lean();
            console.log("downloadFiles_apiData_0 : ", refer, item);
            item.referredBy = refer?.nickName || "";
            console.log("downloadFiles_apiData_0_1 : ", refer, item);
            // return {
            //   ...item,
            //   referredBy: refer?.user || "",
            // };
          }
          return item;
        }),
      );

      console.log(
        "downloadFiles_apiData_1 : ",
        JSON.stringify(apiData, null, 2),
      );

      const filteredData = apiData?.filter(
        (item) =>
          (item.nickName || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.email || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.walletAddress || "")
            .toLowerCase()
            .includes(datas.toLowerCase()),
      );
      console.log(
        "downloadFiles_filteredData : ",
        JSON.stringify(filteredData, null, 2),
      );

      data = filteredData.map(({ _id, __v, createdAt, ...rest }) => rest);
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "Reward Config") {
      // let apiData = await users.find({}).sort({ _id: -1 }).populate({ path: "referredBy", select: "nickName email walletAddress referralCode" }).lean();
      let apiData = await Reward.find({}).sort({ _id: -1 }).lean();
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));

      const filteredData = apiData?.filter(
        (item) =>
          (item.rewardFor || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.rewardType || "").toLowerCase().includes(datas.toLowerCase()),
      );
      console.log(
        "downloadFiles_filteredData : ",
        JSON.stringify(filteredData, null, 2),
      );

      data = filteredData.map(
        ({ _id, __v, createdAt, updatedAt, ...rest }) => ({ ...rest }),
      );
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "User Level") {
      let apiData = await Level.find({}).sort({ _id: -1 }).lean();
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));
      // const filteredData = apiData?.filter((item) =>
      //   (item.nickName || "").toLowerCase().includes(datas.toLowerCase()) ||
      //   (item.email || "").toLowerCase().includes(datas.toLowerCase()) ||
      //   (item.walletAddress || "").toLowerCase().includes(datas.toLowerCase())
      // );
      // console.log("downloadFiles_filteredData : ",JSON.stringify(filteredData,null,2));

      data = apiData.map(({ _id, __v, ...rest }) => ({ ...rest }));
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "Box Level") {
      let apiData = await dailycasebox.find({}).sort({ minXp: 1 }).lean();
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));
      // const filteredData = apiData?.filter((item) =>
      //   (item.nickName || "").toLowerCase().includes(datas.toLowerCase()) ||
      //   (item.email || "").toLowerCase().includes(datas.toLowerCase()) ||
      //   (item.walletAddress || "").toLowerCase().includes(datas.toLowerCase())
      // );
      // console.log("downloadFiles_filteredData : ",JSON.stringify(filteredData,null,2));

      data = apiData.map(({ _id, __v, boximage, ...rest }) => ({
        ...rest,
        boximage: `${config.BACKURL.replace(/\/$/, "")}${boximage}`,
      }));
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    } else if (name === "Box Rewards") {
      let levelBoxlistRaw;
      if (datas) {
        levelBoxlistRaw = await boxCasesRewards
          .find({ boxCaseId: datas })
          .populate("boxCaseId")
          .sort({ minProbalityPercentage: 1 })
          .lean();
      } else {
        levelBoxlistRaw = await boxCasesRewards
          .find({})
          .populate("boxCaseId")
          .sort({ minProbalityPercentage: 1 })
          .lean();
      }

      let apiData = levelBoxlistRaw.map((item) => {
        const box = item.boxCaseId;
        return {
          _id: item._id,
          boxCaseId: box._id,
          levelName: box.levelName,
          minXp: box.minXp,
          maxXp: box.maxXp,
          minBetedAmount: box.minBetedAmount,
          minAccountBalance: box.minAccountBalance,
          boximage: box.boximage,
          minProbalityPercentage: item.minProbalityPercentage,
          maxProbalityPercentage: item.maxProbalityPercentage,
          assetType: item.assetType,
          assetAmount: item.assetAmount,
          __v: item.__v,
        };
      });
      apiData = apiData.sort((a, b) => {
        if (a.minXp !== b.minXp) {
          return a.minXp - b.minXp;
        }
        return a.minProbalityPercentage - b.minProbalityPercentage;
      });
      console.log("downloadFiles_apiData : ", JSON.stringify(apiData, null, 2));
      const filteredData = apiData?.filter(
        (item) =>
          (item.nickName || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.email || "").toLowerCase().includes(datas.toLowerCase()) ||
          (item.walletAddress || "")
            .toLowerCase()
            .includes(datas.toLowerCase()),
      );
      console.log(
        "downloadFiles_filteredData : ",
        JSON.stringify(filteredData, null, 2),
      );

      data = apiData.map(({ _id, __v, boximage, ...rest }) => ({
        ...rest,
        boximage: `${config.BACKURL.replace(/\/$/, "")}${boximage}`,
      }));
      console.log("downloadFiles_data : ", JSON.stringify(data, null, 2));
    }

    // const data = JSON.parse(datas)
    if (!data || data.length === 0) {
      return res.status(400).json({ message: "No data to export" });
    }

    // CSV Export
    if (fileType === "csv") {
      const fields = Object.keys(data[0]);
      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=data.csv");
      return res.status(200).send(csv);
    }

    // PDF Export
    if (fileType === "pdf") {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=data.pdf");

      doc.pipe(res);

      doc.fontSize(16).text(name, { underline: true });
      doc.moveDown(1);
      console.log("");

      data.forEach((row, idx) => {
        doc.fontSize(12).text(`${idx + 1}.`);
        Object.keys(row).forEach((field) => {
          doc.text(`${field}: ${row[field]}`);
        });
        doc.moveDown(1);
      });

      doc.end();
      return;
    }

    // EXCEL Export
    if (fileType === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(name || "Data");

      worksheet.columns = Object.keys(data[0]).map((key) => ({
        header: key,
        key,
        width: 30,
      }));

      data.forEach((row) => worksheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", "attachment; filename=data.xlsx");

      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    return res.status(400).json({ message: "Invalid fileType" });
  } catch (err) {
    console.log(err);
    return res.status(500).send("Server error");
  }
};

export const getPoolDetail = async (req, res) => {
  try {
    let resp = await poolDetailSchema.find({});
    return res
      .status(200)
      .json({ status: true, result: resp, message: "fetched Successfully" });
  } catch (err) {
    console.log("🚀 ~ getPoolDetail ~ err:", err);
    return res.status(200).json({ status: false, message: err.toString() });
  }
};

export const editPooldetails = async (req, res) => {
  try {
    const { _id, ...rest } = req.body;
    let resp = await poolDetailSchema.findOneAndUpdate(
      { _id: _id },
      { $set: { ...rest } },
    );
    return res
      .status(200)
      .json({ status: true, message: "updated Successfully", result: resp });
  } catch (err) {
    console.log("🚀 ~ editPooldetails ~ err:", err);
    return res.status(200).json({ message: err.toString() });
  }
};

export const faqAdd = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const question = reqBody.question?.trim();
    const answer = reqBody.answer?.trim();

    if (!question || !answer) {
      return sendResponse(res, 400, {
        status: false,
        message: "Question and answer are required",
      });
    }

    const faq = new faqModel({ question, answer });
    await faq.save();

    return sendResponse(res, 200, {
      status: true,
      message: "FAQ added successfully",
      data: faq,
    });
  } catch (err) {
    console.log("faqAdd_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const faqList = async (req, res) => {
  try {
    const faqData = await faqModel.find({}).sort({ _id: -1 });

    return sendResponse(res, 200, {
      status: true,
      message: "FAQ list fetched successfully",
      data: faqData,
    });
  } catch (err) {
    console.log("faqList_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const faqEdit = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const _id = reqBody._id;
    const question = reqBody.question?.trim();
    const answer = reqBody.answer?.trim();

    if (!_id) {
      return sendResponse(res, 400, {
        status: false,
        message: "FAQ ID is required",
      });
    }

    const updateData = {};
    if (question !== undefined) updateData.question = question;
    if (answer !== undefined) updateData.answer = answer;

    if (Object.keys(updateData).length === 0) {
      return sendResponse(res, 400, {
        status: false,
        message: "At least one field (question or answer) must be provided",
      });
    }

    const updatedFaq = await faqModel.findOneAndUpdate(
      { _id },
      { $set: updateData },
      { new: true },
    );

    if (!updatedFaq) {
      return sendResponse(res, 400, {
        status: false,
        message: "FAQ not found",
      });
    }

    return sendResponse(res, 200, {
      status: true,
      message: "FAQ updated successfully",
      data: updatedFaq,
    });
  } catch (err) {
    console.log("faqEdit_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const faqDelete = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const _id = reqBody._id ?? reqBody.id ?? req.query._id ?? req.query.id;

    if (!_id) {
      return sendResponse(res, 400, {
        status: false,
        message: "FAQ ID is required",
      });
    }

    const deletedFaq = await faqModel.findOneAndDelete({ _id });
    if (!deletedFaq) {
      return sendResponse(res, 400, {
        status: false,
        message: "FAQ not found",
      });
    }

    return sendResponse(res, 200, {
      status: true,
      message: "FAQ deleted successfully",
    });
  } catch (err) {
    console.log("faqDelete_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const cmsAdd = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const label = reqBody.label?.trim();
    const description = reqBody.description?.trim();

    if (!label || !description) {
      return sendResponse(res, 400, {
        status: false,
        message: "Label and description are required",
      });
    }

    const cms = new cmsModel({ label, description });
    await cms.save();

    return sendResponse(res, 200, {
      status: true,
      message: "CMS added successfully",
      data: cms,
    });
  } catch (err) {
    console.log("cmsAdd_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const cmsList = async (req, res) => {
  try {
    const cmsData = await cmsModel.find({}).sort({ _id: -1 });

    return sendResponse(res, 200, {
      status: true,
      message: "CMS list fetched successfully",
      data: cmsData,
    });
  } catch (err) {
    console.log("cmsList_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const cmsEdit = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const _id = reqBody._id;
    const label = reqBody.label?.trim();
    const description = reqBody.description?.trim();

    if (!_id) {
      return sendResponse(res, 400, {
        status: false,
        message: "CMS ID is required",
      });
    }

    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      return sendResponse(res, 400, {
        status: false,
        message: "At least one field (label or description) must be provided",
      });
    }

    const updatedCms = await cmsModel.findOneAndUpdate(
      { _id },
      { $set: updateData },
      { new: true },
    );

    if (!updatedCms) {
      return sendResponse(res, 400, {
        status: false,
        message: "CMS not found",
      });
    }

    return sendResponse(res, 200, {
      status: true,
      message: "CMS updated successfully",
      data: updatedCms,
    });
  } catch (err) {
    console.log("cmsEdit_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};

export const cmsDelete = async (req, res) => {
  try {
    const reqBody = req.body.token ?? req.body;
    const _id = reqBody._id ?? reqBody.id ?? req.query._id ?? req.query.id;

    if (!_id) {
      return sendResponse(res, 400, {
        status: false,
        message: "CMS ID is required",
      });
    }

    const deletedCms = await cmsModel.findOneAndDelete({ _id });
    if (!deletedCms) {
      return sendResponse(res, 400, {
        status: false,
        message: "CMS not found",
      });
    }

    return sendResponse(res, 200, {
      status: true,
      message: "CMS deleted successfully",
    });
  } catch (err) {
    console.log("cmsDelete_error", err);
    return sendResponse(res, 500, {
      status: false,
      message: "Something went wrong!!",
    });
  }
};
