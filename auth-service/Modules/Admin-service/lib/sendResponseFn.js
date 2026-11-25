//import files
import { ResEncryptData } from "../Hooks/Secure";
import Config from "../../../config"

export const sendResponse = async (res, statusCode, data, isencrypt = true) => {
    console.log("sendResponse : ",statusCode, JSON.stringify(data));
    if (isencrypt) {
        let SecretKey = Config.ADMIN_CRYPTO
        return res.status(statusCode).json(ResEncryptData(data, SecretKey));
    } else {
        return res.status(statusCode).json(data);
    }
}