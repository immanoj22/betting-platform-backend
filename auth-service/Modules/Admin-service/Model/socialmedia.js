const mongoose = require('mongoose');
const Schema = mongoose.Schema;
let socialmedia = new Schema({
    facebookLink: {
        type: String,
        default: ''
    },
    twitterLink: {
        type: String,
        default: ''
    },
    linkedinLink: {
        type: String,
        default: ''
    },
    telegramLink: {
        type: String,
        default: ''
    }
}, { timestamps: true });


module.exports = mongoose.model('socialmedia', socialmedia, 'socialmedia');