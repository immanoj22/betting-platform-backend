import mongoose from "mongoose";

const rewardConfigAdminSchema = new mongoose.Schema(
    {
        // What type of reward system this config applies to
        rewardFor: {
            type: String,
            enum: ["airDrop", "xp", "welcome", "referral","referedBy"],
            required: true,
            default: "airDrop"
        },

        // What currency or asset is rewarded
        rewardType: {
            type: String,
            enum: ["Token", "xp", "sol"],
            required: true,
            default: "sol",
        },

        // % of wager pool going into airdrop pool
        percentageOfWagerPool: {
            type: Number,
            required: true,
            default: 0,
        },

        // Maximum reward for each distribution run
        maxLimit: {
            type: Number,
            required: true,
            default: 0,
        },

        // Minimum XP required to participate
        minXp: {
            type: Number,
            required: true,
            default: 0,
        },

        // Minimum level required to participate
        eligibleLevel: {
            type: Number,
            required: true,
            default: 0,
        },
        fixedReward:{
            type: Number,
            default: 0,
        },

        // How often reward runs (in seconds)
        distributionInSeconds: {
            type: Number,
            required: true,
            default: 3600,
        },

        // Symbol of reward asset (SOL, XP, CUSTOM TOKEN)
        rewardAssetSymbol: {
            type: String,
            required: true,
            default: "SOL",
        },

        // Timestamp of last distribution
        lastRun: {
            type: Date,
            default: null,
        },

        // Timestamp of next scheduled distribution
        nextRun: {
            type: Date,
            default: null,
        },

        // Enable/Disable this reward config
        isEnabled: {
            type: Boolean,
            default: true,
        },
        minTip: {
            type: Number,
            default: 0.1,
        },
        maxTip: {
            type: Number,
            default: 2,
        },
    },
    { timestamps: true }
);

// FINAL FIX: Set correct collection name
const RewardConfig = mongoose.model("rewardconfig", rewardConfigAdminSchema);
export default RewardConfig;
