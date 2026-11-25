import mongoose from 'mongoose';

const newGameSchema = new mongoose.Schema({
    gamesession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "gamesession",
        required: true
    },
    gameId: {
        type: String,
        default: "",
    },
    serverSeed: {
        type: String,
        default: "",
    },
    publicSeed: {
        type: String,
        default: ""
    },
    hashedServerSeed: {
        type: String,
        default: ""
    },
    startGameHash: {
        type: String,
        default: "",
    }
}, {
    timestamps: true,
})

const NewGameModel = mongoose.model("newgames", newGameSchema);
export default NewGameModel;