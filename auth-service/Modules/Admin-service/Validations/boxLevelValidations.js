import isEmpty from "is-empty";
import { imageValidation } from "../../../library/filesystem";
import { sendResponse } from "../lib/sendResponseFn";
import dailycasebox from "../../levels/model/levelCasesBox";

export const boxLevelValidations = async (req, res, next) => {
    try {
        let { levelName, minXp, maxXp, minBetedAmount, minAccountBalance } = req.body;
        console.log("boxLevelValidations : ", { levelName, minXp, maxXp, minBetedAmount, minAccountBalance }, req.files);
        let boximage = req.files.boximage;
        console.log("boxLevelValidations : ", boximage);
        let error = {}
        if (isEmpty(levelName)) {
            error['levelName'] = "Level name is required"
        }
        if (isEmpty(minXp)) {
            error['minXp'] = "Minium XP is required"
        }
        if (isEmpty(maxXp)) {
            error['maxXp'] = "Maximum XP is required"
        }
        if (isEmpty(minBetedAmount)) {
            error['minBetedAmount'] = "Minimum beted amount is required"
        }
        if (isEmpty(minAccountBalance)) {
            error['minAccountBalance'] = "Minimum account balance is required"
        }
        if (isEmpty(boximage)) {
            error['boximage'] = "Image is required"
        } else {
            const attachmentsValidation = await imageValidation(boximage);
            if (attachmentsValidation !== true) {
                error['boximage'] = attachmentsValidation;
            }
        }
        if (!isEmpty(error)) {
            console.error("boxLevelAddValidation__error : ", error);
            return sendResponse(res, 400, {
                status: false,
                errors: error
            });
        }
        next()
    } catch (err) {
        console.log(err, "boxLevelAddValidation__err");
        return sendResponse(res, 500, {
            status: false,
            message: "Something went wrong!!",
        });
    }
}

export const boxLevelUpdateValidations = async (req, res, next) => {
    try {
        let { _id, levelName, minXp, maxXp, minBetedAmount, minAccountBalance } = req.body;
        console.log("boxLevelValidations : ", { levelName, minXp, maxXp, minBetedAmount, minAccountBalance }, req.files);
        let boximage = req.files?.boximage;
        console.log("boxLevelValidations : ", boximage);
        let error = {}
        if (isEmpty(_id)) {
            error['_id'] = "ID is required"
        }
        if (isEmpty(levelName)) {
            error['levelName'] = "Level name is required"
        }
        if (isEmpty(minXp)) {
            error['minXp'] = "Minium XP is required"
        }
        if (isEmpty(maxXp)) {
            error['maxXp'] = "Maximum XP is required"
        }
        if (isEmpty(minBetedAmount)) {
            error['minBetedAmount'] = "Minimum beted amount is required"
        }
        if (isEmpty(minAccountBalance)) {
            error['minAccountBalance'] = "Minimum account balance is required"
        }
        if (!isEmpty(boximage)) {
            const attachmentsValidation = await imageValidation(boximage);
            if (attachmentsValidation !== true) {
                error['boximage'] = attachmentsValidation;
            }
        }
        if (!isEmpty(error)) {
            console.error("boxLevelAddValidation__error : ", error);
            return sendResponse(res, 400, {
                status: false,
                errors: error
            });
        }
        next()
    } catch (err) {
        console.log(err, "boxLevelAddValidation__err");
        return sendResponse(res, 500, {
            status: false,
            message: "Something went wrong!!",
        });
    }
}

export const boxCasesRewardsAddValidation = async (req, res, next) => {
    try {
        let { boxCaseId, range, assetType, assetAmount } = req.body;
        range = parseFloat(range);
        let error = {}
        if (isEmpty(boxCaseId)) {
            error['boxCaseId'] = "Box Level is required"
        }
        if (isEmpty(range)) {
            error['range'] = "Range of Probability Percentage is required"
        } else if (range < 0 || range >= 100) {
            error['range'] = "Range of Probability Percentage must be greater than 0 and less than or equal to 100"
        }
        if (isEmpty(assetType)) {
            error['assetType'] = "Asset Type is required"
        }
        if (isEmpty(assetAmount)) {
            error['assetAmount'] = "Asset Amount is required"
        }
        if (!isEmpty(error)) {
            console.error("boxCasesRewardsAddValidation__error : ", error);
            return sendResponse(res, 400, {
                status: false,
                errors: error
            });
        }
        next()
    } catch (err) {
        console.log(err, "boxCasesRewardsAddValidation__err");
        return sendResponse(res, 500, {
            status: false,
            message: "Something went wrong!!",
        });
    }
}

export const boxCasesRewardsUpadteValidation = async (req, res, next) => {
    try {
        let { boxCaseId, _id, minProbalityPercentage, maxProbalityPercentage, assetType, assetAmount } = req.body;
        console.log({boxCaseId, _id, minProbalityPercentage, maxProbalityPercentage, assetType, assetAmount});
        minProbalityPercentage = parseFloat(minProbalityPercentage);
        maxProbalityPercentage = parseFloat(maxProbalityPercentage);
        let error = {}
        if (isEmpty(_id)) {
            error['_id'] = "ID is required"
        }
        if (isEmpty(boxCaseId)) {
            error['boxCaseId'] = "Box Level is required"
        }
        if (isEmpty(minProbalityPercentage) && minProbalityPercentage != 0) {
            error['minProbalityPercentage'] = "Minimum Probability Percentage is required"
        } else if (minProbalityPercentage < 0 || minProbalityPercentage >= 100) {
            error['minProbalityPercentage'] = "Minimum Probability Percentage must be greater than or equal to 0 and less than 100"
        }
        if (isEmpty(maxProbalityPercentage)) {
            error['maxProbalityPercentage'] = "Maximum Probability Percentage is required"
        } else if (maxProbalityPercentage <= 0 || maxProbalityPercentage > 100) {
            error['maxProbalityPercentage'] = "Maximum  Probability Percentage must be greater than 0 and less than or equal to 100"
        } else if (minProbalityPercentage === maxProbalityPercentage) {
            error['maxProbalityPercentage'] = "Maximum  Probability Percentage must be greater than Minimum  Probability Percentage"
        }
        if (isEmpty(assetType)) {
            error['assetType'] = "Asset Type is required"
        }
        if (isEmpty(assetAmount)) {
            error['assetAmount'] = "Asset Amount is required"
        }
        if (!isEmpty(error)) {
            console.error("boxCasesRewardsAddValidation__error : ", error);
            return sendResponse(res, 400, {
                status: false,
                errors: error
            });
        }
        next()
    } catch (error) {
        console.error(error, "boxCasesRewardsUpadteValidation__err");
        return sendResponse(res, 500, {
            status: false,
            message: "Something went wrong!!",
        });
    }
}
