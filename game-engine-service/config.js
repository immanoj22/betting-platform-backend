require('dotenv').config({ path: `./Environment/.env.${process.env.NODE_ENV}` })

console.log("path", `./Environment/.env.${process.env.NODE_ENV}`);


var SECRET_KEY = {}

SECRET_KEY.PORT = process.env.PORT
SECRET_KEY.MONGOURI = process.env.MONGOURI
SECRET_KEY.FRONTURL = process.env.FRONT_URL
SECRET_KEY.ADMIN_URL = process.env.ADMIN_URL
SECRET_KEY.APIURL = process.env.API_URL
SECRET_KEY.BACKURL = process.env.BACK_URL
SECRET_KEY.IMAGEURL = process.env.IMAGE_URL
SECRET_KEY.SECRET_KEY = process.env.SECRET_KEY
// BS-INFRA-001 fix: keep JWT verification and wallet-key AES decryption on
// independent secrets, matching the split made in auth-service's config.js.
SECRET_KEY.JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY
SECRET_KEY.WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || process.env.SECRET_KEY
SECRET_KEY.SITE_NAME = process.env.SITE_NAME
SECRET_KEY.ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY
SECRET_KEY.INSTA_KEY = process.env.INSTA_ACCOUNT_PRIVATE_KEY

/** SMTP-CONFIG */
SECRET_KEY.SMTP = {
    fromName: process.env.FROM_MAIL_NAME,
    fromMail: process.env.FROM_MAIL,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
}

SECRET_KEY.SMS_GATEWAY = {
    TWILIO_ACCOUT_SID: process.env.TWILIO_ACCOUT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SERVICE_SID: process.env.TWILIO_SERVICE_SID
}

module.exports = SECRET_KEY;
