import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    fromAddress: {
      type: String,
      required: true,
      default: "",
    },
    toAddress: {
      type: String,
      required: true,
      default: "",
    },
    transactionFrom: {
      type: String,
      required: true,
      default: "",
    },
    result:{
      type: String,
      default: "",
    },
    transactionType: {
      type: String,
      required: true,
      default: "",
    },
    transactionAsset: {
      type: String,
      required: true,
      default: "",
    },
    transactionAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    transactionHash: {
      type: String,
      default :"",
    },
    // BS-INFRA-012 fix: was String here vs Number in BetSchema for the same
    // value — aligned to Number across both collections.
    progressCashOutPercentage : {
      type : Number ,
      default : 100
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    gameId : {
      type : mongoose.Schema.Types.ObjectId,
      required : false
    },
    isFromInstaWallet : {
      type : Boolean,
      default : false
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    failureReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// BS-INFRA-011 fix: DB-level idempotency guard against a replayed deposit
// hash. Partial (excludes the common "" placeholder used for pending/failed
// rows) so it only enforces uniqueness once a real on-chain hash is present.
TransactionSchema.index(
  { transactionHash: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionHash: { $type: "string", $ne: "" },
    },
  },
);

const TransactionModel = mongoose.model("transactions", TransactionSchema);
export default TransactionModel;
