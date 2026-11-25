const dotenv = require("dotenv");

dotenv.config({ path: `./env/.env.${process.env.NODE_ENV}` });
console.log(process.env.NODE_ENV, "process.env.NODE_ENV")

const config = {
    API_PORT: process.env.API_PORT,
    MONGO_URI: process.env.MONGO_URI,
    FRONT_URL: "",
    SERVER_URL: process.env.SERVER_URL,
    WEBSITE_URL: process.env.WEBSITE_URL,
    baseURL: process.env.BASEURL,
    network: process.env.NETWORK,
    token: process.env.TOKEN,
    blockstreambaseURL: process.env.BLOCKSTREAMBASEURL,
    blockstreamnetwork: process.env.BLOCKSTRAEMNETWORK,
    tatum_Url: process.env.TATUM_URL,
    btc_network: process.env.BTC_NETWORK,
    mempoolUrl: process.env.MEMPOOLURL,
    tatum_api_key: process.env.TATUM_API_KEY,
    SMTP_CONFIG: {
        "fromMail": process.env.LOCAL_SMTP_EMAIL,
        "nodemailer": {
            "host": process.env.LOCAL_SMTP_EMAIL,
            "port": 465, "secure": true,
            "auth": {
                "user": process.env.LOCAL_SMTP_EMAIL,
                "pass": process.env.LOCAL_SMTP_PASS
            }
        }
    },
    SMS_GATEWAY: {
        TWILIO_ACCOUT_SID: process.env.TWILIO_ACCOUT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        TWILIO_SERVICE_SID: process.env.TWILIO_SERVICE_SID,
    }
}

export default config;