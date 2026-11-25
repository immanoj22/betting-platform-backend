import { sendResponse } from "../../../service/response";
import User from "../model/UserSchema";
import TransactionModel from "../../Commonmodel/TransactionSChema";
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";
import {
  createNewUserServerSeed,
  deactivateUserSeed,
  isValidSolanaAddress,
} from "../hooks/userHooks";
import jwt from "jsonwebtoken";
import config from "../../../config";
import { fileUpload, imageValidation } from "../../../library/filesystem";
import levelConfig from "../../levels/model/levelSchema";
import {
  adminAddress,
  sendSol,
  verifyDeposit,
} from "../../../service/solanaTransactionService";
import { getUsdPrice } from "../../Dex/Hook/tokenPriceCron";
import { pipeline } from "stream";
import BetModel from "../../Commonmodel/BetSchema";
import { resolve } from "path";
import gameConfig from "../../Commonmodel/gameConfig";
import socialmedia from "../../Admin-service/Model/socialmedia";
import cmsModel from "../../Admin-service/Model/cmsModel";
import faqSchemaModel from "../../Admin-service/Model/faqModel";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;

/**
 * POST /user/user_wallet_connection
 * Body: {walletAddress }
 */
export const userWalletConnect = async (req, res) => {
  try {
    const reqBody = req.body;
    const walletAddress = reqBody?.walletAddress;
    if (!walletAddress) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "wallet address required",
      });
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "Enter a valid wallet address",
      });
    }

    const UserData = await User.findOne({ walletAddress });
    const nonce = bs58.encode(crypto.randomBytes(48));
    const payload = {
      walletAddress,
      nonce,
      status: "WALLET_CONFIRMATION_REQUIRED",
    };
    const userToken = jwt.sign(
      payload,
      process.env.JWT_SECRET || process.env.SECRET_KEY,
      { expiresIn: "7d" },
    );
    if (UserData) {
      UserData.token = userToken;
      UserData.status = "WALLET_CONFIRMATION_REQUIRED";
      UserData.save();
      return sendResponse(res, {
        status: true,
        statusCode: 200,
        message: "Wallet confirmation required",
        result: {
          token: UserData.token,
          walletStatus: "WALLET_CONFIRMATION_REQUIRED",
          nonce: nonce,
        },
      });
    } else {
      // --- new user creation ---
      const data = {
        walletAddress,
        token: userToken,
        status: "WALLET_CONFIRMATION_REQUIRED",
      };

      const newUser = await User.create(data);
      return sendResponse(res, {
        status: true,
        statusCode: 201,
        message: "WALLET_CONFIRMATION_REQUIRED",
        result: {
          token: userToken,
          walletStatus: "WALLET_CONFIRMATION_REQUIRED",
          nonce: nonce,
        },
      });
    }
  } catch (err) {
    console.log("__getUserNounce err", err.message);
    return sendResponse(res, {
      status: false,
      statusCode: 400,
      message: "something happened",
    });
  }
};

/**
 * POST /user/user_wallet_login
 * Body: {signature }
 * Header: Authorization: Bearer <nonceToken>
 */
export const userWalletSignIn = async (req, res) => {
  try {
    const signature = req.body?.signature;

    if (!signature) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "Missing signature",
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Authorization header missing",
      });
    }

    const userToken = authHeader.split(" ")[1];
    if (!userToken) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Invalid authorization token",
      });
    }

    // Decode the token to get the nonce or challenge string
    const decoded = User.decodeJWT(`Bearer ${userToken}`);
    const { nonce, walletAddress } = decoded;
    if (!nonce) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "Nonce missing in token",
      });
    }

    let user = await User.findOne({ walletAddress });
    if (!user) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "user not found",
      });
    }

    // BS-AUTH-011 fix: the challenge token must still be the one currently
    // issued for this wallet. Since a successful login immediately
    // overwrites user.token with a new session JWT (below), a captured
    // (nonceToken, signature) pair can only ever be used once — replaying it
    // after that no longer matches user.token and is rejected here.
    if (user.token?.replace(/^Bearer\s*/, "") !== userToken) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Login challenge already used or expired",
      });
    }

    // Verify signature
    const messagecontent = `Sign in to SolGameZ\nAddress: ${walletAddress}\nNonce: ${nonce}`;
    const message = new TextEncoder().encode(messagecontent);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);

    const isValid = nacl.sign.detached.verify(
      message,
      signatureBytes,
      publicKeyBytes,
    );
    if (!isValid) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Invalid wallet signature",
      });
    }

    // Update user status
    user.status = "Logged_In";
    const token = user.generateJWT();

    await user.save();
    await createNewUserServerSeed(user._id);

    // BS-FE-003 hardening: also issue the session token as an httpOnly
    // cookie, in addition to the response body. The frontend still reads
    // the token from the body today (see FIXES-SUMMARY / report for why the
    // JS-readable copy can't be dropped yet without a shared COOKIE_DOMAIN
    // across auth-service and game-engine-service) — this cookie is
    // additive, not yet load-bearing, so nothing breaks if it's absent.
    res.cookie("authToken", `Bearer ${token}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "local",
      sameSite: process.env.NODE_ENV !== "local" ? "none" : "lax",
      domain: config.COOKIE_DOMAIN,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Wallet verified successfully",
      result: {
        user: user,
        token,
      },
    });
  } catch (err) {
    console.error("__userWalletSignIn err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 400,
      message: err.message || "Something went wrong during wallet sign-in",
    });
  }
};

/**
 * POST /user/user_setting_update
 * Body: {signature }
 * Header: Authorization: Bearer <nonceToken>
 */
export const userWalletSettingsUpdate = async (req, res) => {
  try {
    const user = req.user;
    console.log("🚀 ~ userWalletSettingsUpdate ~ user:", user);

    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    const { nickname, email, clientSeed, overallVolume } = req.body;

    if (nickname && nickname !== user.nickName) {
      const existingNick = await User.findOne({ nickName: nickname });

      if (existingNick && user.walletAddress != existingNick?.walletAddress) {
        return sendResponse(res, {
          status: false,
          statusCode: 400,
          message: "Nickname already taken",
        });
      }
      user.nickName = nickname;
    }

    if (email && email !== user.email) {
      const existingemail = await User.findOne({ email: email });
      console.log(
        "🚀 ~ userWalletSettingsUpdate ~ existingemail:",
        existingemail,
      );
      if (existingemail && user.walletAddress != existingemail?.walletAddress) {
        return sendResponse(res, {
          status: false,
          statusCode: 400,
          message: "email already in use",
        });
      }
      user.email = email;
    }

    if (clientSeed && clientSeed !== user.clientSeed) {
      const existingSeed = await User.findOne({ clientSeed });
      if (existingSeed && user.walletAddress != existingSeed?.walletAddress) {
        return sendResponse(res, {
          status: false,
          statusCode: 400,
          message: "Client seed already exists",
        }); 
      }
      user.clientSeed = clientSeed;
    }

    if (overallVolume > 0) {
      user.overAllVolume = overallVolume;
    }

    if (req.files && req.files.profileImage) {
      const attachment = req.files.profileImage;
      console.log("🚀 ~ userWalletSettingsUpdate ~ attachment:", attachment);
      const validation = await imageValidation(attachment);
      if (validation !== true) {
        return sendResponse(res, {
          status: false,
          statusCode: 400,
          message: validation,
        });
      }

      const fileExt = attachment.name.split(".").pop();
      const fileName = `${user._id}_${Date.now()}.${fileExt}`;

      await fileUpload(attachment, "profile", fileName);

      user.profileImage = `/profile/${fileName}`; // Save path to DB
    }

    await user.save();

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Wallet settings updated successfully",
      result: { user },
    });
  } catch (err) {
    console.error("__userWalletSettingsUpdate err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 400,
      message:
        err.message || "Something went wrong while updating wallet settings",
    });
  }
};

/**
 * patch /user/user_wallet_disconnect
 * Header: Authorization: Bearer <nonceToken>
 */
export const userWalletDiscount = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    user.status = "Logged_Out";
    user.token = "";

    await user.save();

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Wallet disconnected successfully",
    });
  } catch (err) {
    console.error("___userWalletDiscount err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 400,
      message: err.message || "Something went wrong while disconnecting wallet",
    });
  }
};

/**
 * get /user/user_details
 * Header: Authorization: Bearer <nonceToken>
 */
export const userDetails = async (req, res) => {
  try {
    console.log("hii");

    const user = req.user;
    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    const userDetails = await User.findOne({
      walletAddress: user.walletAddress,
    });

    const userLevel = await levelConfig.findOne({
      $and: [
        { minXp: { $lte: userDetails.xpMarker } },
        { maxXp: { $gte: userDetails.xpMarker } },
      ],
    });
    console.log("🚀 ~ userDetails ~ userLevel:", userLevel);
    if (!userDetails) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "no user exits",
      });
    }
    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "userDetails fetched succesfully",
      result: {
        user: userDetails,
        level: userLevel ? userLevel?.levelNumber : 0,
      },
    });
  } catch (err) {
    console.error("__userWalletSettingsUpdate err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 400,
      message:
        err.message || "Something went wrong while updating wallet settings",
    });
  }
};

export const deactivateUserServerSeed = async (req, res) => {
  try {
    const user = req.user;
    const { seedID } = req.body;

    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    if (!seedID) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "seedID is required",
      });
    }

    const result = await deactivateUserSeed(user.user._id, seedID);

    if (!result.status) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: result.message,
      });
    }

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: result.message,
    });
  } catch (err) {
    console.error("___deactivateUserServerSeed err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while deactivating server seed",
    });
  }
};

export const rewardUserLinkedAccounts = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    const userDetails = await User.findOne({ _id: user._id });

    if (!userDetails) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "User not found",
      });
    }

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "user Linked accounts fetched successfully",
      result: {
        userLinkedAccounts: userDetails.oAuthLinkedAccounts,
        isreferredByExists: userDetails.referredBy ? true : false,
      },
    });
  } catch (err) {
    console.error("___rewardUserLinkedAccounts err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while rewarding linked accounts",
    });
  }
};

export const userRefererCode = async (req, res) => {
  try {
    const user = req.user;
    const { refferCode } = req.body;

    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    if (!refferCode) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "refferCode is required",
      });
    }

    const refererUser = await User.findOne({ referralCode: refferCode });
    console.log("🚀 ~ userRefererCode ~ refererUser:", refererUser, refferCode);
    if (!refererUser) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Invalid referer code",
      });
    }

    if (refererUser._id.toString() === user._id.toString()) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "You cannot use your own referer code",
      });
    }
    const currentUser = await User.findOne({ _id: user._id });

    if (currentUser.referredBy) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Referer code already applied",
      });
    }

    currentUser.referredBy = refererUser._id;
    await currentUser.save();

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Referer code applied successfully",
    });
  } catch (err) {
    console.error("___userRefererCode err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while applying referer code",
    });
  }
};

// Max transfer bound + decimal-precision guard (fixes BS-AUTH-006).
const MAX_TRANSFER_AMOUNT_SOL = 1000;

export const transferAmount = async (req, res) => {
  try {
    const { amount, from, txhash } = req.body;
    const user = req.user;
    const numericAmount = Number(amount);

    if (
      !amount ||
      isNaN(numericAmount) ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > MAX_TRANSFER_AMOUNT_SOL
    ) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Invalid Amount",
      });
    }

    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 401,
        message: "Unauthorized user",
      });
    }

    const userDetails = await User.findOne({ _id: user._id });
    if (!userDetails) {
      return sendResponse(res, {
        status: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    if (from == "primary") {
      // Deposit: verify the on-chain transaction before crediting the ledger.
      const verify = await verifyDeposit(
        txhash,
        user.walletAddress,
        numericAmount,
      );
      if (!verify) {
        return sendResponse(res, {
          status: false,
          statusCode: 200,
          message: "Transaction Hash Was Incorrect",
        });
      }

      await TransactionModel.create({
        userId: userDetails._id,
        fromAddress: user.walletAddress,
        toAddress: process.env.INSTA_ACCOUNT,
        transactionFrom: "wallet",
        transactionType: "internalTransfer",
        transactionAsset: "SOL",
        transactionAmount: numericAmount,
        transactionHash: txhash,
        status: "completed",
      });

      const updatedData = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { instawalletbalance: numericAmount } },
        { new: true },
      );

      return sendResponse(res, {
        status: true,
        statusCode: 200,
        message: "user Linked accounts fetched successfully",
        result: updatedData,
      });
    }

    // Withdraw: debit the ledger atomically (fixes BS-AUTH-007 — no SOL is
    // sent from the shared hot wallet until the caller's balance is proven
    // sufficient), THEN attempt the on-chain send.
    const debited = await User.findOneAndUpdate(
      { _id: user._id, instawalletbalance: { $gte: numericAmount } },
      { $inc: { instawalletbalance: -numericAmount } },
      { new: true },
    );

    if (!debited) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Insufficient balance",
      });
    }

    const tx = await sendSol(user.walletAddress, numericAmount);

    if (!tx || !tx.status) {
      // On-chain send failed — refund the debit so the honest customer is
      // never charged for SOL they never received (fixes BS-AUTH-012).
      await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { instawalletbalance: numericAmount } },
      );

      await TransactionModel.create({
        userId: userDetails._id,
        fromAddress: process.env.INSTA_ACCOUNT,
        toAddress: user.walletAddress,
        transactionFrom: "instawallet",
        transactionType: "internalTransfer",
        transactionAsset: "SOL",
        transactionAmount: numericAmount,
        transactionHash: tx?.tx || "",
        status: "failed",
      });

      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Withdrawal failed, please try again",
      });
    }

    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: process.env.INSTA_ACCOUNT,
      toAddress: user.walletAddress,
      transactionFrom: "instawallet",
      transactionType: "internalTransfer",
      transactionAsset: "SOL",
      transactionAmount: numericAmount,
      transactionHash: tx.tx,
      status: "completed",
    });

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "user Linked accounts fetched successfully",
      result: debited,
    });
  } catch (err) {
    console.log("🚀 ~ transferAmount ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while rewarding linked accounts",
    });
  }
};

export const enable_disable_wallet = async (req, res) => {
  try {
    const user = req.user;
    const { enable } = req.body;
    console.log("🚀 ~ enable_disable_wallet ~ user:", user);

    let update = await User.findOneAndUpdate(
      { _id: user?._id },
      { $set: { instawalletEnable: enable } },
    ).lean();

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message:
        "Insta wallet" +
        (update.instawalletEnable ? "Disabled" : "Enabled") +
        "successfully",
      result: update,
    });
  } catch (err) {
    console.log("err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while rewarding linked accounts",
    });
  }
};

export const getFaqList = async (req, res) => {
  try {
    const faqData = await faqSchemaModel.find({}).sort({ _id: -1 });

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "FAQ list fetched successfully",
      result: faqData,
    });
  } catch (err) {
    console.log("getFaqList_err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  }
};

export const getCmsByLabel = async (req, res) => {
  try {
    const label = req.query?.label?.trim();
    console.log("🚀 ~ getCmsByLabel ~ label:", label);

    if (!label) {
      return sendResponse(res, {
        status: false,
        statusCode: 400,
        message: "CMS label is required",
      });
    }

    const cmsData = await cmsModel.findOne({
      label: { $regex: `^${label}$`, $options: "i" },
    });
    console.log("🚀 ~ getCmsByLabel ~ cmsData:", cmsData);

    if (!cmsData) {
      return sendResponse(res, {
        status: false,
        statusCode: 404,
        message: "CMS not found",
      });
    }

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "CMS fetched successfully",
      result: cmsData,
    });
  } catch (err) {
    console.log("getCmsByLabel_err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  }
};

export const getSocialLinks = async (req, res) => {
  try {
    const socialData = await socialmedia.find({});

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "SocialLink fetched successfully",
      result: socialData,
    });
  } catch (err) {
    console.log("getCmsByLabel_err", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message: "Something went wrong",
    });
  }
};

export const getUsdvalue = async (req, res) => {
  let price = getUsdPrice();
  return sendResponse(res, {
    status: true,
    statusCode: 200,
    message: "Fetched Sucecessfully",
    result: price,
  });
};

export const getTrasnactions = async (req, res) => {
  try {
    const user = req.user;
    const { type, page, limit } = req.query;
    const skip = (page - 1) * limit;
    let query = [];
    let data;
    if (type == "internalTransfer") {
      query = [
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$transactionType", "internalTransfer"] }],
            },
          },
        },
        {
          $project: {
            type: {
              $cond: {
                if: { $eq: ["$transactionFrom", "instawallet"] },
                then: "receive",
                else: "send",
              },
            },
            amount: "$transactionAmount",
            txhash: "$transactionHash",
            time: "$createdAt",
          },
        },
        { $sort: { time: -1 } }, // ✅ important for pagination
        { $skip: Number(0) },
        { $limit: Number(10) },
      ];

      data = await TransactionModel.aggregate(query);
      console.log("🚀 ~ getTrasnactions ~ data:", data);
    }

    if (type == "crash" || type == "coinFlip") {
      query = [
        {
          $match: {
            $expr: {
              $and: {
                $eq: ["$userId", { $toObjectId: user._id }],
              },
            },
          },
        },
        {
          $lookup: {
            from: "newgames",
            let: { gameid: "$gameId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: {
                      $eq: ["$gamesession", "$$gameid"],
                    },
                  },
                },
              },
            ],
            as: "gamedetail",
          },
        },
        { $unwind: "$gamedetail" },
        {
          $lookup: {
            from: "gamesessions",
            let: { gameid: "$gameId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$gameid"] },
                      { $eq: ["$gameType", type] },
                    ],
                  },
                },
              },
            ],
            as: "gamesession",
          },
        },
        { $unwind: "$gamesession" },
        {
          $lookup: {
            from: "transactions",
            let: { gameid: "$gameId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$gameId", "$$gameid"] },
                      { $eq: ["$userId", { $toObjectId: user._id }] },
                    ],
                  },
                },
              },
            ],
            as: "transaction",
          },
        },
        {
          $addFields: {
            totalBetAmount: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$transaction",
                      as: "tx",
                      cond: {
                        $eq: [
                          "$$tx.transactionType",
                          type == "crash"
                            ? "bet"
                            : type == "coinFlip"
                              ? "coinFlip-bet"
                              : "",
                        ],
                      },
                    },
                  },
                  as: "betTx",
                  in: "$$betTx.transactionAmount",
                },
              },
            },
            totalCashoutAmount: {
              $ifNull: [
                {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$transaction",
                          as: "tx",
                          cond: {
                            $in: [
                              "$$tx.transactionType",
                              ["cashout", "partialCashout"],
                            ],
                          },
                        },
                      },
                      as: "cashTx",
                      in: "$$cashTx.transactionAmount",
                    },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            profitLoss: {
              $subtract: ["$totalCashoutAmount", "$totalBetAmount"],
            },
          },
        },
        {
          $project: {
            _id: 0,
            roundId: "$gamedetail.gameId",
            time: "$gamesession.startTime",
            final_multiplier: type == "crash" ? "$gamesession.result" : "$side",
            betAmount: "$totalBetAmount",
            payout: "$totalCashoutAmount",
            profitLoss: 1,
          },
        },
        { $sort: { time: -1 } }, // ✅ important for pagination
        { $skip: Number(skip) },
        { $limit: Number(limit) },
      ];
      data = await BetModel.aggregate(query);
    }

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "transaction Fetched Successfully",
      result: data,
    });
  } catch (err) {
    console.log("err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while rewarding linked accounts",
    });
  }
};

export const getPandL = async (req, res) => {
  try {
    const user = req.user;
    console.log("🚀 ~ getPandL ~ user:", user);

    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);

    const pnl = await TransactionModel.aggregate([
      {
        $match: {
          userId: new ObjectId(user._id),
          status: "completed",
          createdAt: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
          transactionAsset: "SOL",
        },
      },
      {
        $addFields: {
          amountIn: {
            $cond: [
              {
                $in: ["$transactionType", ["cashout", "partialCashout"]],
              },
              "$transactionAmount",
              0,
            ],
          },
          amountOut: {
            $cond: [
              {
                $in: ["$transactionType", ["bet", "coinFlip-bet"]],
              },
              "$transactionAmount",
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalIn: { $sum: "$amountIn" },
          totalOut: { $sum: "$amountOut" },
        },
      },
      {
        $project: {
          _id: 0,
          totalIn: 1,
          totalOut: 1,
          pnl: { $subtract: ["$totalIn", "$totalOut"] },
        },
      },
    ]);
    console.log("🚀 ~ getPandL ~ pnl:", pnl,JSON.stringify([
      {
        $match: {
          userId: user._id,
          status: "completed",
          createdAt: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
          transactionAsset: "SOL",
        },
      },
      {
        $addFields: {
          amountIn: {
            $cond: [
              {
                $in: ["$transactionType", ["cashout", "partialCashout"]],
              },
              "$transactionAmount",
              0,
            ],
          },
          amountOut: {
            $cond: [
              {
                $in: ["$transactionType", ["bet", "coinFlip-bet"]],
              },
              "$transactionAmount",
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalIn: { $sum: "$amountIn" },
          totalOut: { $sum: "$amountOut" },
        },
      },
      {
        $project: {
          _id: 0,
          totalIn: 1,
          totalOut: 1,
          pnl: { $subtract: ["$totalIn", "$totalOut"] },
        },
      },
    ],null,2));

    console.log(pnl);

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Fetched Sucecessfully",
      result: pnl?.[0] ?? {},
    });
  } catch (err) {
    console.log("🚀 ~ getPandL ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 500,
      message:
        err.message || "Something went wrong while rewarding linked accounts",
    });
  }
};

export const getConfig = async (req, res) => {
  try {
    let type = req.query.type;
    let data = await gameConfig.find({ gameType: type });
    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Fetched Sucecessfully",
      result: data,
    });
  } catch (error) {
    // BS-AUTH-013 fix: catch bound `error`, but the handler referenced the
    // undefined `err`, turning any failure here into an unhandled
    // ReferenceError instead of the intended JSON response.
    console.log("🚀 ~ getConfig ~ error:", error);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message:
        error.message || "Something went wrong while fetching config",
    });
  }
};
