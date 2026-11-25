import mongoose from "mongoose";

const { Schema, model } = mongoose;

const tradeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["buy", "sell","burn"],
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    txHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      // min: 0,
    },

    avgPrice: {
      type: Number,
      required: true,
      // min: 0,
    },

    receiveAmount : {
      type : Number,
      // min : 0
    },

    lastPrice: {
      type: Number,
      required: true,
      // min: 0,
    },

    value: {
      type: Number,
      required: true,
      // min: 0
    },
  },
  {
    timestamps: true,
  }
);

tradeSchema.index({ userId: 1, createdAt: -1 });

tradeSchema.statics.getVolumeAndTVL = async function () {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h

  const result = await this.aggregate([
    {
      $facet: {
        last24hVolume: [
          { $match: { createdAt: { $gte: from } } },
          { $group: { _id: null, volume: { $sum: "$value" } } },
        ],
        tvl: [
          { $group: { _id: null, tvl: { $sum: { $multiply: ["$amount", "$lastPrice"] } } } },
        ],
      },
    },
  ]);

  return {
    last24hVolume: result[0].last24hVolume[0]?.volume || 0,
    tvl: result[0].tvl[0]?.tvl || 0,
  };
};

tradeSchema.statics.get24hPriceChange = async function () {
  const now = new Date();
  const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get latest price
  const latestTrade = await this.findOne().sort({ createdAt: -1 }).lean();
  const latestPrice = latestTrade?.lastPrice || 0;

  // Get price 24h ago (closest trade before 24h ago)
  const pastTrade = await this.findOne({ createdAt: { $lte: from24h } })
    .sort({ createdAt: -1 })
    .lean();
  const pastPrice = pastTrade?.lastPrice || latestPrice; // fallback to latest if none

  const change = ((latestPrice - pastPrice) / pastPrice) * 100;

  return {
    latestPrice,
    pastPrice,
    change: change, // e.g., "1.56"
  };
};

tradeSchema.statics.getDashboardStats = async function () {
  const volumeAndTVL = await this.getVolumeAndTVL();
  const priceChange = await this.get24hPriceChange();

  return {
    ...volumeAndTVL,
    ...priceChange,
  };
};


export default model("Trade", tradeSchema,"Trade");
