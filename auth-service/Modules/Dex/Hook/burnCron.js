import {
  burnToken,
  getMinimumAmountOut,
  swap,
} from "../../../service/ammService";
import TransactionModel from "../../Commonmodel/TransactionSChema";
import userRewardSchema from "../../reward/model/userReward";
import burnSchema from "../Models/burn.schema";
import poolDetailSchema from "../Models/poolDetail.schema";
import { getLastPrice, getUsdPrice } from "./tokenPriceCron";

export const buyAndBurn = async () => {
  let poolDetail = await poolDetailSchema.findOne({});

  let {
    tokensToBuy,
    netGamingRevenue,
    buyAndBurnAmount,
    totalBets,
    totalWins,
    usdprice,
  } = await getNetGamingRevenue();

  if (netGamingRevenue > 0) {
    let estimate = await getMinimumAmountOut({
      amountIn: tokensToBuy * 10 ** 9,
      direction: "sell",
    });

    console.log("🚀 ~ buyAndBurn ~ estimate:", estimate);

    let tx = await swap("buy", estimate.expectedAmountOut);

    let burnTx;
    if (tx?.status) {
      burnTx = await burnToken(tokensToBuy * 10 ** 9);
      if (burnTx?.status) {
        let saveData = {
          amount: tokensToBuy,
          value: tokensToBuy * usdprice,
          totalCirculateSupply: poolDetail.currentSupply - tokensToBuy,
          totalBets,
          totalWins: totalWins,
          netGamingRevenue,
          burnPercentage: poolDetail.burnpercentage,
          solUsed: estimate.expectedAmountOut,
          tokensBurned: tokensToBuy,
          txHash: burnTx.txHash,
        };

        await burnSchema.create(saveData);
      }
    }
  }
};

const getNetGamingRevenue = async () => {
  let lastTransaction = await burnSchema
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

  let fromDate = lastTransaction.length
    ? new Date(lastTransaction[0].createdAt)
    : new Date();

  console.log("🚀 ~ getNetGamingRevenue ~ lastTransaction:", lastTransaction);

  console.log("🚀 ~ getNetGamingRevenue ~ fromDate:", fromDate);

  // Bug fix (BS-AMM-005): `toDate` was reassigned to the return value of
  // `setDate()`, which is a numeric timestamp, not a Date — and the actual
  // date-window filter below was commented out entirely, so this summed
  // ALL-TIME revenue on every run instead of the incremental delta since
  // the last burn. Fixed both: keep toDate as a Date, and apply the window.
  let toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 1);
  console.log("🚀 ~ getNetGamingRevenue ~ toDate:", toDate);

  const dailyNGR = await TransactionModel.aggregate([
    {
      $match: {
        status: "completed",
        createdAt: {
          $gte: fromDate,
          $lte: toDate,
        },
      },
    },
    {
      $group: {
        _id: "$transactionType",
        totalAmount: {
          $sum: "$transactionAmount",
        },
      },
    },
  ]);
  console.log("🚀 ~ getNetGamingRevenue ~ dailyNGR:", dailyNGR);

  let rewards = await userRewardSchema.aggregate([
    {
      $match: {
        status: "claimed",
        createdAt: {
          $gte: fromDate,
          $lte: toDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: {
          $sum: "$rewardAmount",
        },
      },
    },
  ]);
  console.log("🚀 ~ getNetGamingRevenue ~ rewards:", rewards);

  let totalBets = 0;
  let totalWins = 0;
  let totalReward = rewards?.[0]?.totalAmount;
  console.log("🚀 ~ getNetGamingRevenue ~ totalReward:", totalReward);

  for (const row of dailyNGR) {
    if (["bet", "coinFlip-bet"].includes(row._id)) {
      totalBets += row.totalAmount;
    }

    if (["cashout", "partialCashout"].includes(row._id)) {
      totalWins += row.totalAmount;
    }
  }

  console.log("🚀 ~ getNetGamingRevenue ~ totalBets:", totalBets);
  console.log("🚀 ~ getNetGamingRevenue ~ totalWins:", totalWins);

  const usdprice = getUsdPrice();
  console.log("🚀 ~ getNetGamingRevenue ~ usdprice:", usdprice);
  const netGamingRevenue = totalBets - (totalWins + totalReward);
  console.log("🚀 ~ getNetGamingRevenue ~ netGamingRevenue:", netGamingRevenue);

  const buyAndBurnAmount = netGamingRevenue * 0.2;
  console.log("🚀 ~ getNetGamingRevenue ~ buyAndBurnAmount:", buyAndBurnAmount);

  const tokensToBuy = buyAndBurnAmount;
  console.log("🚀 ~ getNetGamingRevenue ~ tokensToBuy:", tokensToBuy);

  return {
    tokensToBuy,
    netGamingRevenue,
    buyAndBurnAmount,
    totalBets,
    totalWins: totalWins + totalReward,
    usdprice,
  };
};
