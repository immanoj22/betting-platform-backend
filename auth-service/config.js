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
// BS-INFRA-001 fix: JWT signing, wallet-key AES encryption, and the session
// secret must be three independent secrets, not one shared value. Each falls
// back to SECRET_KEY only for backward compatibility with existing deploys —
// set JWT_SECRET / WALLET_ENCRYPTION_KEY / SESSION_SECRET to distinct values.
SECRET_KEY.JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY
SECRET_KEY.WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || process.env.SECRET_KEY
SECRET_KEY.SESSION_SECRET = process.env.SESSION_SECRET || process.env.SECRET_KEY
// BS-FE-003 support: set to a shared parent domain (e.g. ".yourdomain.com")
// in any deployment where auth-service and game-engine-service live on
// different subdomains, so the httpOnly authToken cookie reaches both.
// Left unset (undefined -> host-only cookie) until an ops decision is made.
SECRET_KEY.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
SECRET_KEY.SITE_NAME = process.env.SITE_NAME
SECRET_KEY.ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY
SECRET_KEY.ADMIN_CRYPTO = process.env.ADMIN_CRYPTO_KEY
SECRET_KEY.TELEGRAM_BOT_ID=process.env.TELEGRAM_BOT_ID
SECRET_KEY.TELEGRAM_GROUP_ID=process.env.TELEGRAM_GROUP_ID
SECRET_KEY.FRONTEND_URL=process.env.FRONTEND_URL
SECRET_KEY.GOOGLE_CLIENT_ID= process.env.GOOGLE_CLIENT_ID
SECRET_KEY.GOOGLE_CLIENT_SECRET= process.env.GOOGLE_CLIENT_SECRET
SECRET_KEY.GOOGLE_CALLBACK_URL= process.env.GOOGLE_CALLBACK_URL
SECRET_KEY.API_URL=process.env.API_URL
SECRET_KEY.TWITTER_CLIENT_ID=process.env.TWITTER_CLIENT_ID
SECRET_KEY.TWITTER_CLIENT_SECRET=process.env.TWITTER_CLIENT_SECRET
SECRET_KEY.TELEGRAM_BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN
SECRET_KEY.INSTA_ACCOUNT_KEY = process.env.INSTA_ACCOUNT_PRIVATE_KEY
SECRET_KEY.INSTA_KEY = process.env.INSTA_ACCOUNT
SECRET_KEY.ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY
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
