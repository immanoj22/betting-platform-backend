// import package
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
var crypto = require('crypto');
import key from '../../../config'
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
    name: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        default: ""
    },
    hash: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin'],  // super admin access all, admin - restricted
    },
    restriction: [],
    otp: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    otpTime: {
        type: Date,
    },
}, { timestamps: true });


// /**
//  * Pre-save hook
//  */
// AdminSchema.pre('save', function (next) {
//     if (!this.isNew) return next();

//     // if (!validatePresenceOf(this.hash))
//     //   next(new Error('Invalid password'));
//     // else
//     next();
// });


/**
 * Virtuals
 */
AdminSchema
    .virtual('password')
    .set(function (password) {
        this._password = password;
        this.salt = this.makeSalt();
        this.hash = this.encryptPassword(password);
    })
    .get(function () {
        return this._password;
    });

AdminSchema.methods = {
    /**
     * Authenticate - check if the passwords are the same
     *
     * @param {String} plainText
     * @return {Boolean}
     * @api public
     */
    authenticate: function (plainText) {
        console.log("plainText", plainText);
        // console.log(plainText, "this.encryptPassword(plainText) === this.hash", this.encryptPassword(plainText) === this.hash)
        return this.encryptPassword(plainText) === this.hash;
    },

    /**
     * Make salt
     *
     * @return {String}
     * @api public
     */
    makeSalt: function () {
        return crypto.randomBytes(16).toString('base64');
    },

    /**
     * Encrypt password
     *
     * @param {String} password
     * @return {String}
     * @api public
     */
    encryptPassword: function (password) {
        // console.log("password", password);
        if (!password || !this.salt) return '';
        var salt = Buffer.from(this.salt, 'base64');
        return crypto.pbkdf2Sync(password, salt, 100000, 128, 'sha512').toString('base64');
    }
};


AdminSchema.methods.generateJWT = function (payload) {
    var token = jwt.sign(payload, key.ADMIN_CRYPTO, { expiresIn: '24h' }); // exptime 24Hour 
    return `Bearer ${token}`;
};

AdminSchema.methods.decodejwt = function (payload) {
    var decode = jwt.verify(payload, key.ADMIN_CRYPTO);
    return decode;
};
const Admin = mongoose.model("Admin", AdminSchema, "Admin");

export default Admin;