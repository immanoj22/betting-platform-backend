import { Schema, model } from "mongoose";

const tokenPriceSchema = new Schema(
  {
    priceSol: {
      type: Number,
      required: true
    },

    priceUsd: {
      type: Number,
      required: true
    },

    interval: {
      type: String,
      enum: ["1m", "5m", "15m", "1h", "1d"],
      index: true,
      default : "1m"
    },

    timestamp: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: false }
);
tokenPriceSchema.index({ interval: 1, timestamp: 1 });


export default model("TokenPrice", tokenPriceSchema, "token_prices");
