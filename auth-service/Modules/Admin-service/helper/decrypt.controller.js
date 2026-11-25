//Import package
import CryptoJS from 'crypto-js';

// import Files
import Config from "../../../config"
import { sendResponse } from '../lib/sendResponseFn';

export const decryptData = (req, res, next) => {
  try {
    const token = decryptObject(req.body.token)
    req.body = token;
    return next();
  } catch (err) {
    return sendResponse(res, 500, { status: false, message: 'Something went wrong!!' })
  }
}

export const decryptObject = (decryptValue) => {
  let bytes;
  try {
    const decData = CryptoJS.enc.Base64.parse(decryptValue).toString(CryptoJS.enc.Utf8);
    bytes = CryptoJS.AES.decrypt(decData, Config.ADMIN_CRYPTO).toString(CryptoJS.enc.Utf8);
    return JSON.parse(bytes)
  }
  catch (err) {
    console.log("decryptObject__err", err)
    return ''
  }
}

export const decryptAdminPubKey = (decryptValue, password) => {
  let bytes;
  try {
    const decData = CryptoJS.enc.Base64.parse(decryptValue).toString(CryptoJS.enc.Utf8);
    bytes = CryptoJS.AES.decrypt(decData, password).toString(CryptoJS.enc.Utf8);
    return JSON.parse(bytes)
  }
  catch (err) {
    console.log("decryptAdminPubKey__err", err)
    return ''
  }
}
