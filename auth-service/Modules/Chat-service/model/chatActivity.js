import mongoose from "mongoose";

const ChatActivity = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "GameSession", required: true },
        lastMessageAt: { type: Date, default: null },
        messageCount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

const ChatActivitySchema = mongoose.model("ChatActivity", ChatActivity);
export default ChatActivitySchema;

