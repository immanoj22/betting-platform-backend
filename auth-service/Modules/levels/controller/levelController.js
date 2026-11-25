import { sendResponse } from "../../../service/response";
import levelConfig from "../model/levelSchema"

export const getLevels = async (req, res) => {
    try {
        const levels = await levelConfig.find({});
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "levels fetched successfully",
            result: {
                data: levels
            },
        });
    } catch (err) {
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "err happened",
            errors: err.message
        });
    }
}