import CryptoJS from 'crypto-js';

/**
 * Method for Decrypt data using static SecretKey
 **/
export const ResEncryptData = (data, SecretKey) => {

    try {
        const encJson = CryptoJS.AES.encrypt(JSON.stringify(data), SecretKey).toString();
        const encData = CryptoJS.enc.Base64.stringify(
            CryptoJS.enc.Utf8.parse(encJson)
        );
        return encData;
    }
    catch (err) {
        console.log("EncryptData err", err);
    }

}