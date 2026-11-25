import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

        region: {
            type: String,
            default:""
        },

        language: {
            type: String,
            default:""
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
    },
    { timestamps: true }
);


export default mongoose.model("Chat", ChatSchema);
