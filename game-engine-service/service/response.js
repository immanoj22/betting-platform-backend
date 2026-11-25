/** Packages */
import isEmpty from "is-empty";

/** Library */
import { decryptObject, encryptObject } from "../library/crypto"

/** Send response 
 * statusCode, message, success, result, errors
*/
export const sendResponse = (res, data, key = "") => {
    data = {
        statusCode: data?.statusCode,
        success: data?.success,
        message: data?.message,
        result: data?.result,
        errors: data?.errors
    }
    // return res.status(data.statusCode).json(encryptObject(data), key) // Handle response send with encrypting string
    return res.status(data.statusCode).json(data, key)
}

/** Handle encryption Data 
 * token , secretKey
*/
export const decryptRequest = (req, res, next) => {
    try {
        const { user: { secretKey }, body: { token } } = req
        console.log(secretKey, token, "decryptReq");
        let data = decryptObject(token, secretKey);

        if (isEmpty(data)) {
            return sendResponse(res, { status: false, message: "Authentication failed. Invalid token" }, req.user.secretKey);
        }
        req.body = data;
        return next();
    } catch (e) {
        console.log("decryptReq_err", e);
        return sendResponse(res, { status: false, message: "Error on server" }, req.user.secretKey);
    }
};

