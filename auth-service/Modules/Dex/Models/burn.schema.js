import { model , Schema }  from "mongoose";

const burnTransactionSchma = new Schema({
    amount : {
         type : String ,
          default : "0"
        },
    value : { 
        type : String ,
        default : "0"
    },
    totalCirculateSupply : { 
        type : Number ,
         default : "0"
        },

    totalBets: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalWins: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    netGamingRevenue: {
      type: Number,
      required: true,
      default: 0,
    },

    burnPercentage: {
      type: Number,
      required: true,
      default: 0, // e.g. 20 = 20%
      min: 0,
      max: 100,
    },

    solUsed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    tokensBurned: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    txHash: {
      type: String,
      required: true,
      index: true,
    },
},{timestamps : true})

export default model("burntransaction",burnTransactionSchma,"burntransaction");


