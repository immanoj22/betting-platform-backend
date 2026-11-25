import { sendResponse } from "../../../service/response";
import { verifySolanaTx } from "../../../service/solanaTransactionService";
import userRewardSchema from "../../reward/model/userReward";
import {
  feeCalculated,
  getLastPrice,
  getPoolTVL,
  getTokenPriceFromContract,
  getUsdPrice,
} from "../Hook/tokenPriceCron";
import burnSchema from "../Models/burn.schema";
import liquiditySchema from "../Models/liquidity.schema";
import poolDetailSchema from "../Models/poolDetail.schema";
import TradeSchema from "../Models/trade.schema";

export const trade = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.walletAddress || !user.user) {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Unauthorized user",
      });
    }

    let { type, txHash, amount,receiveAmount } = req.body;
    console.log("🚀 ~ trade ~ req.body:", req.body)
    
    let verifyData = await verifySolanaTx(txHash,user.walletAddress,type,amount,receiveAmount);
    if(!verifyData.status){
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "TransactionHash MisMatched",
      });
    }
    receiveAmount =  verifyData.recieved / 10 ** 9

    let getLastprice = await getLastPrice();
    console.log("🚀 ~ trade ~ getLastprice:", getLastprice);
    let usdprice = await getUsdPrice();
    console.log("🚀 ~ trade ~ usdprice:", usdprice);
    let value = amount * usdprice;
    console.log("🚀 ~ trade ~ value:", value);
    let avgPrice = value / amount;
    console.log("🚀 ~ trade ~ avgPrice:", avgPrice);

    let txData = await TradeSchema.create({
      userId: user._id,
      type,
      txHash,
      amount,
      receiveAmount,
      avgPrice: avgPrice,
      lastPrice: getLastprice,
      value,
    });

    if (txData) {
      let data = await TradeSchema.find({}).sort({ createdAt: -1 }).limit(10);
      feeCalculated();
      return sendResponse(res, {
        status: true,
        statusCode: 200,
        message: "order Placed Successfully",
        result: { data, txData },
      });
    } else {
      return sendResponse(res, {
        status: false,
        statusCode: 200,
        message: "Order not Placed/ please try again",
      });
    }
  } catch (err) {
    console.log("🚀 ~ trade ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const getTrades = async (req, res) => {
  try {
    const user = req.user;
    console.log("🚀 ~ getTrades ~ user:", user)
    const { type } = req.query;
    console.log("🚀 ~ getTrades ~ type:", type)
    let data = await TradeSchema.find({
      ...(type == "all"
        ? {}
        : type == "user"
          ? { userId: user._id }
          : { type: "burn" }),
    })
      .sort({ createdAt: -1 })
      .limit(10);
    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Orders Fetched Successfully",
      result: { data },
    });
  } catch (err) {
    console.log("🚀 ~ getTrades ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const getTokenPrice = async (req, res) => {
  let price = await getTokenPriceFromContract("user");
  console.log("🚀 ~ getTokenPrice ~ price:", price);
  return sendResponse(res, {
    status: true,
    statusCode: 200,
    message: "Fetched Sucecessfully",
    result: price,
  });
};

export const getPoolDetails = async (req, res) => {
  try {
    let data = await poolDetailSchema.findOne({}).lean();
    let burnToken =await burnSchema.aggregate([
      {
        $group : {
          _id : null,
          totalburn : { $sum : "$tokensBurned"}
        }
      }
    ])
    console.log("🚀 ~ getPoolDetails ~ burnToken:", burnToken)
    let poolTVL = getPoolTVL();
    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Fetched Sucecessfully",
      result: { ...data, poolTVL: poolTVL,burnedToken : burnToken[0]?.totalburn ?? 0 },
    });
  } catch (err) {
    console.log("🚀 ~ getPoolDetails ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const positionSave = async (req, res) => {
  try {
    const user = req.user;
    console.log("🚀 ~ positionSave ~ user:", user)
    const { amount0, amount1, lpMint, txHash } = req.body;
    console.log("🚀 ~ positionSave ~ req.body:", req.body)
    let usdprice = getUsdPrice();
    let value = amount0 * usdprice + amount1 * usdprice;
    let poolDetail = await poolDetailSchema.findOne({});
    let resp = await liquiditySchema.create({
      userId: user?._id,
      amount0,
      amount1,
      apy: poolDetail.rewardRate,
      value,
      lpTokens: lpMint,
      txHash,
    });

    let reward = await userRewardSchema.create({
      rewardSessionId: resp._id,
      userId: user?._id,
      rewardType: "pool-reward",
      assetType: "TOKEN",
      rewardAmount: 0,
      status: "pending",
    });

    await liquiditySchema.findOneAndUpdate(
      {
        _id: resp?._id,
      },
      {
        $set: {
          rewardId: reward?._id,
        },
      },
    );

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Position Added Successfully",
      result: resp,
    });
  } catch (err) {
    console.log("🚀 ~ positionSave ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const removeLiquidity = async (req,res) =>{
   try{
      let { _id } = req.body;
     let resp =  await liquiditySchema.findOneAndUpdate(
      {
        _id: _id,
      },
      {
        $set: {
          status: "withdrawn",
        },
      },
    );

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Liquidity Removed Successfully",
      result: resp,
    });
   }catch(err){
    console.log("🚀 ~ removeLiquidity ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
   }
}

export const getPositionDetails = async (req, res) => {
  try {
    const user = req.user;

    let resp = await liquiditySchema.find({ userId: user?._id });

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Position Added Successfully",
      result: resp,
    });
  } catch (err) {
    console.log("🚀 ~ getPositionDetails ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const burnDash = async (req, res) => {
  try{
    let data = await poolDetailSchema.findOne({}).lean();

  let totalBurn = await burnSchema.aggregate([
    {
      $group: {
        _id: null,
        totalBurned: { $sum: "$tokensBurned" },
      },
    },
  ]);

  totalBurn = totalBurn?.[0]?.totalBurn || 0;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const result = await burnSchema.aggregate([
    {
      $match: {
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        totalBurned: { $sum: "$tokensBurned" },
      },
    },
  ]);

  const totalCirculateSupply = data?.currentSupply;

  const todayBurned = result[0]?.totalBurned || 0;

  return sendResponse(res, {
    status: true,
    statusCode: 200,
    message: "Position Added Successfully",
    result: {totalCirculateSupply,todayBurned,totalBurn},
  });
}
catch(err){
  console.log("🚀 ~ burnDash ~ err:", err)
  return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
}
};

export const getBurnList = async (req,res) => {
  try{
   let list = await burnSchema.find({}).sort({createdAt : -1}).limit(10);
   return sendResponse(res, {
    status: true,
    statusCode: 200,
    message: "Position Added Successfully",
    result: list,
  });
  }catch(err){
    console.log("🚀 ~ getBurnList ~ err:", err)
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
}

