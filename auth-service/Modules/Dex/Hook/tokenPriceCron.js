import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import tokenPriceSchema from "../Models/tokenpirce.schema";
import liquiditySchema from "../Models/liquidity.schema";
import {
  getMintDetail,
  getPoolDataFromContract,
  getTokenPrice,
  reserveGet,
} from "../../../service/solanaTransactionService";
import userRewardSchema from "../../reward/model/userReward";

let lastUpdated = null;
let poolTVL = 0;
let UsdPrice = "";

export const getTokenPriceFromContract = async (from) => {
  const { reserve0, reserve1, price1 } = await getTokenPrice();
  let usdprice = price1 * UsdPrice;
  console.log("🚀 ~ getTokenPriceFromContract ~ usdprice:", usdprice);

  poolTVL = (reserve0 / 10 ** 9) * UsdPrice + (reserve1 / 10 ** 9) * UsdPrice;
  if (from) {
    lastUpdated = usdprice;
    return usdprice;
  }

  await tokenPriceSchema.create({
    priceSol: price1 / 10 ** 9,
    priceUsd: usdprice,
    timestamp: new Date(),
  });
};

export const getUsdPriceOfSol = async () => {
  try {
    let resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    );
    let res = await resp.json();
    console.log("🚀 ~ getUsdPriceOfSol ~ res:", res);
    console.log("🚀 ~ getUsdPriceOfSol ~ res:", res, res?.solana?.usd);
    UsdPrice = res?.solana?.usd ?? UsdPrice;
    lastUpdated = UsdPrice;
  } catch (err) {
    console.log("🚀 ~ getUsdPriceOfSol ~ err:", err);
  }
};

export const feeCalculated = async () => {
  let APY;
  const SECONDS_IN_YEAR = 3600 // 31_536_000;
  let lists = await liquiditySchema.find({ status: "active" });
  if (!lists.length == 0) return;
  let { totalLp } = await getMintDetail();
  let poolData = await getPoolDataFromContract();
  const totalSwapFee = Number(poolData.totalFee) / 10 ** 9;
  const now = Date.now();
  const poolValueUsd = Number(poolTVL);
  for (const list of lists) {
    const userLp = Number(list.lpTokens);
    if (userLp === 0 || totalLp === 0) continue;
    const lpShare = userLp / totalLp;
    const userSwapFee = totalSwapFee * lpShare;
    const lastTime = list.updatedAt ? new Date(list.updatedAt).getTime() : now;
    const timeElapsed = (now - lastTime) / 1000; // seconds
    const userLiquidityValue = poolValueUsd * lpShare;
    const apyReward =
      userLiquidityValue * (APY / SECONDS_IN_YEAR) * timeElapsed;
    const totalReward = userSwapFee + apyReward;
    let getReward = await userRewardSchema
      .find({ rewardSessionId: list._id, status: "claimed" })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    let reward;
    if (getReward) {
      reward = await userRewardSchema.create({
        rewardSessionId: list._id,
        userId: list?.userId,
        rewardType: "pool-reward",
        assetType: "TOKEN",
        rewardAmount: 0,
        status: "pending",
      });
    } else {
      await userRewardSchema.findOneAndUpdate(
        { _id: getReward?._id },
        {
          $inc: {
            rewardAmount: totalReward,
          },
        },
      );
    }

    await Liquidity.updateOne(
      { _id: list._id },
      {
        $inc: {
          feeGenerated: totalReward.toString(),
        },
      },
    );
  }
};

export const getUsdPrice = () => {
  return UsdPrice;
};

export const getPoolTVL = () => {
  return poolTVL;
};

export const getLastPrice = () => {
  return lastUpdated;
};
