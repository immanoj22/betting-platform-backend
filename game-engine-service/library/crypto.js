/** Packages */
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import isEmpty from 'is-empty';

/**CONFIG*/
import config from '../config'

/** Encrypt the object with crypto AES */
export const encryptObject = (encryptValue, secretKey = "") => {
    try {
        secretKey = isEmpty(secretKey) ? config.WALLET_ENCRYPTION_KEY : secretKey
        encryptValue = JSON.stringify(encryptValue)
        let ciphertext = CryptoJS.AES.encrypt(encryptValue, secretKey).toString();
        console.log(ciphertext, 'encryptObject')
        return ciphertext
    }
    catch (err) {
        console.log("encryptObject_err", err)
        return ''
    }
}

/** Decrypt the object with crypto AES */
export const decryptObject = (decryptValue, secretKey = "") => {
    try {
        secretKey = isEmpty(secretKey) ? config.WALLET_ENCRYPTION_KEY : secretKey
        let bytes = CryptoJS.AES.decrypt(decryptValue, secretKey);
        let decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData
    }
    catch (err) {
        console.log(err, 'decryptObject__err')
        return ''
    }
}


/** Specified for the handle symbols in excrypt and decrypt string */
export const replaceSpecialCharacter = (value, type) => {
    try {
        console.log("encryptString", value, type);
        let textValue = value;
        if (!isEmpty(textValue)) {
            if (type == 'encrypt') {
                // textValue = textValue.toString().replace('+', 'xMl3Jk').replace('/', 'Por21Ld').replace('=', 'Ml32');
                textValue = textValue.toString().replace(/\+/g, 'xMl3Jk').replace(/\//g, 'Por21Ld').replace(/\=/g, 'Ml32');
            } else if (type == 'decrypt') {
                // textValue = textValue.replace('xMl3Jk', '+').replace('Por21Ld', '/').replace('Ml32', '=');
                textValue = textValue.replace(/\xMl3Jk/g, '+').replace(/\Por21Ld/g, '/').replace(/\Ml32/g, "=");
            }
        }
        return textValue
    } catch (err) {
        console.log("replaceSpecialCharacter_err", err);
        return ''
    }
}

export const encryptString = (encryptValue, isSpecialCharacters = false) => {
    try {
        encryptValue = encryptValue.toString()
        let ciphertext = CryptoJS.AES.encrypt(encryptValue, config.WALLET_ENCRYPTION_KEY).toString();
        if (isSpecialCharacters) {
            return replaceSpecialCharacter(ciphertext, 'encrypt')
        }
        console.log(ciphertext, 'encryptString')
        return ciphertext
    }
    catch (err) {
        console.log("encryptString_err", err);
        return ''
    }
}
export const decryptString = (decryptValue, isSpecialCharacters = false) => {
    try {
        if (isSpecialCharacters) {
            decryptValue = replaceSpecialCharacter(decryptValue, 'decrypt')
        }
        decryptValue = decryptValue.toString()

        let bytes = CryptoJS.AES.decrypt(decryptValue, config.WALLET_ENCRYPTION_KEY);
        let originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText
    }
    catch (err) {
        console.log("------err", err)
        return ''
    }
}

export const generateSignature = (value, secretKey) => {
    try {
        let hashValue = CryptoJS.HmacSHA256(value, secretKey);
        let hash = CryptoJS.enc.Hex.stringify(hashValue);
        return hash
    } catch (err) {
        console.log(err, 'generateSignature__err')
        return ''
    }
}

export const randomByte = (byte) => {
    try {
        return crypto.randomBytes(byte).toString('hex');
    } catch (err) {
        return ''
    }
}