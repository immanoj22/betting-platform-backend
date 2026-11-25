import { sendResponse } from "../../../service/response.js";
import burnSchema from "../Models/burn.schema.js";
import TokenPrice from "../Models/tokenpirce.schema.js";
import tradeSchema from "../Models/trade.schema.js";

const getOHLC = async ({ bucketSize, from }) => {
  return TokenPrice.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date(from),
        },
      },
    },
    // create bucket timestamp
    {
      $addFields: {
        bucket: {
          $toDate: {
            $subtract: [
              { $toLong: "$timestamp" },
              { $mod: [{ $toLong: "$timestamp" }, bucketSize] },
            ],
          },
        },
      },
    },

    { $sort: { timestamp: 1 } },

    {
      $group: {
        _id: "$bucket",
        open: { $first: "$priceUsd" },
        high: { $max: "$priceUsd" },
        low: { $min: "$priceUsd" },
        close: { $last: "$priceUsd" },
        volume: { $sum: "$priceUsd" }, // placeholder
      },
    },

    { $sort: { _id: 1 } },

    {
      $project: {
        _id: 0,
        x: "$_id",
        y: ["$open", "$high", "$low", "$close"],
      },
    },
  ]);
};

const getTokenPriceChart = async ({ bucketSize, from }) => {
  return await TokenPrice.aggregate([
    {
      $match: {
        timestamp: { $gte: from },
      },
    },

    // Create time bucket
    {
      $addFields: {
        bucket: {
          $toDate: {
            $subtract: [
              { $toLong: "$timestamp" },
              { $mod: [{ $toLong: "$timestamp" }, bucketSize] },
            ],
          },
        },
      },
    },

    { $sort: { timestamp: 1 } },

    // One price per bucket
    {
      $group: {
        _id: "$bucket",
        price: { $last: "$priceUsd" },
      },
    },

    { $sort: { _id: 1 } },

    // Final shape
    {
      $project: {
        _id: 1,
        pair: [
          {
            $dateToString: {
              format: "%Y-%m-%d %H:%M",
              date: "$_id",
            },
          },
          "$price",
        ],
      },
    },
    {
      $group: {
        _id: null,
        data: { $push: "$pair" },
      },
    },

    { $project: { _id: 0, data: 1 } },
  ]);
};

function getRangeAndBucket(type) {
  const now = Date.now();

  switch (type) {
    case "1H":
      return {
        fromDate: new Date(now - 1 * 60 * 60 * 1000),
        bucketSize: 1 * 60 * 1000, // 1 minute buckets
      };

    case "24H":
      return {
        fromDate: new Date(now - 24 * 60 * 60 * 1000),
        bucketSize: 15 * 60 * 1000, // 15 min
      };

    case "7D":
      return {
        fromDate: new Date(now - 7 * 24 * 60 * 60 * 1000),
        bucketSize: 60 * 60 * 1000, // 1 hour
      };

    case "1M":
      return {
        fromDate: new Date(now - 30 * 24 * 60 * 60 * 1000),
        bucketSize: 4 * 60 * 60 * 1000, // 4 hours
      };

    case "ALL":
      return {
        fromDate: new Date(0),
        bucketSize: 24 * 60 * 60 * 1000, // 1 day
      };
  }
}

export const getTokenPriceCandle = async (req, res) => {
  try {
    const { interval, type } = req.query;
    console.log("🚀 ~ getTokenPriceCandle ~ interval, type:", interval, type);

    let candles = [];

    const { bucketSize, fromDate } = getRangeAndBucket(interval);
    console.log(
      "🚀 ~ getTokenPriceCandle ~ bucketSize,fromDate:",
      bucketSize,
      fromDate,
    );

    if (type == "ohlc") {
      candles = await getOHLC({
        bucketSize,
        from: fromDate,
      });
    }

    if (type == "chart") {
      candles = await getTokenPriceChart({
        bucketSize,
        from: fromDate,
      });

      candles = candles?.[0]?.data;
    }

    console.log("candles-->", candles);

    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Fetched Sunncessfully",
      result: candles,
    });
  } catch (err) {
    console.log("🚀 ~ getTokenPriceCandle ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    let data = await tradeSchema.getDashboardStats();
    console.log("🚀 ~ getDashboardStats ~ data:", data);
    return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "Fetched Sunncessfully",
      result: data,
    });
  } catch (err) {
    console.log("🚀 ~ getDashboardStats ~ err:", err);
    return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
  }
};

export const getBurnChartData = async (req, res) => {
  try{
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const data = await burnSchema.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        tokensBurned: { $sum: "$tokensBurned" },
        totalCirculateSupply: { $last: "$totalCirculateSupply" },
      },
    },
    {
      $sort: { "_id.day": 1 },
    },
  ]);

  const dateMap = {};
  data.forEach((d) => {
    dateMap[d._id.day] = d;
  });

  const labels = [];
  const supplyData = [];
  const burnedData = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const key = date.toISOString().slice(0, 10);
    labels.push(key);

    supplyData.push(dateMap[key]?.totalCirculateSupply || 0);

    burnedData.push(dateMap[key]?.tokensBurned || 0);
  }

  const series = [
    {
      name: "Circulating Supply",
      data: supplyData,
    },
    {
      name: "Tokens Burned",
      data: burnedData,
    },
  ];

  let totalBurned = burnedData.reduce(
  (sum, val) => sum + Number(val),
  0
);

   return sendResponse(res, {
      status: true,
      statusCode: 200,
      message: "successfully Fetched",
      result : {
    labels,
    series,
    totalBurned,
  }
    });

}catch(err){
  console.log("🚀 ~ getBurnChartData ~ err:", err)
   return sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "something happened",
    });
}
};
