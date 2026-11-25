//Import Schema
import socialmedia from '../Model/socialmedia'

//Import Files
import { Save, find, findone, FindOneAndUpdate } from '../Hooks/mongoosehelper'
import { isEmpty } from '../lib/isEmpty'
import { sendResponse } from '../lib/sendResponseFn'

/**
 * Method for  Listing the socialmedia Links 
 * METHOD: GET
**/
export const FetchsocialMediaLinks = async (req, res) => {
    try {
        console.log("FetchsocialMediaLinks_FetchsocialMediaLinks");
        const dataa = { DBname: socialmedia, findata: {}, sort: { _id: -1 } }
        const result = await find(dataa);
        console.log("result_FetchsocialMediaLinks",result);

        if (result) {
            return sendResponse(res, 200, { status: true, message: "Listed successfully", data: result },false)
        } else {
            return sendResponse(res, 400, { status: false, message: 'Error Occured' })
        }
    } catch (err) {
        console.log("Fetch socialMediaLinks err", err);
        return sendResponse(res, 500, { status: false, message: 'Something went wrong!!' })
    }
}

/**
 * Method for  Add and Update  the socialmedia Links 
 * METHOD: POST
**/
export const updatesocialmedia = async (req, res) => {
    try {
        console.log("req_body_updatesocialmedia",req.body);
        let reqBody = req.body.token
        let updata = {
            'facebookLink': reqBody.facebookLink,
            'twitterLink': reqBody.twitterLink,
            'linkedinLink': reqBody.linkedinLink,
            'telegramLink': reqBody.telegramLink,
        }

        const _id = reqBody?._id;
        
        if(updata) {

            const data = { DBName: socialmedia, finData: { _id: _id }, updata: { "$set": updata }, save: { new: true } }
            const result = await FindOneAndUpdate(data)
            if (result) {
                return sendResponse(res, 200, { status: true, message: 'Social media links are updated successfully.' })
            }
            else {
                return sendResponse(res, 400, { status: false, message: 'Unable to update settings.' })
            }
        }
    } catch (err) {
        return sendResponse(res, 500, { status: false, message: 'Something went wrong!!' })
    }
}

/**
 * Method for  Delete the Particular socialmedia Links 
 * METHOD: POST
**/
export const Deletesocialmedia = async (req, res) => {
    try {
        let ReqData = req.body
        console.log("Deletesocialmedia ReqData", ReqData);

        const data = { DBName: socialmedia, finData: { _id: ReqData?.datas?._id } }
        let finddata = await findone(data)
        if (finddata) {

            if (ReqData?.linkdata == 'facebookLink') {
                finddata.facebookLink = ''
                finddata.twitterLink = ReqData?.datas?.twitterLink
                finddata.linkedinLink = ReqData?.datas?.linkedinLink
                finddata.telegramLink = ReqData?.datas?.telegramLink
                const result = await finddata.save()
                if (result) {
                    return sendResponse(res, 200, { status: true, message: 'Deleted facebookLink successfully' })
                }
                else {
                    return sendResponse(res, 400, { status: false, message: 'Error occurred' })
                }
            }
            if (ReqData?.linkdata == 'twitterLink') {
                finddata.twitterLink = ''
                finddata.facebookLink = ReqData?.datas?.facebookLink
                finddata.linkedinLink = ReqData?.datas?.linkedinLink
                finddata.telegramLink = ReqData?.datas?.telegramLink
                const result = await finddata.save()
                if (result) {
                    return sendResponse(res, 200, { status: true, message: 'Deleted twitterLink successfully' })
                }
                else {
                    return sendResponse(res, 400, { status: false, message: 'Error occurred' })
                }
            }
            if (ReqData?.linkdata == 'linkedinLink') {
                finddata.linkedinLink = ''
                finddata.facebookLink = ReqData?.datas?.facebookLink
                finddata.twitterLink = ReqData?.datas?.twitterLink
                finddata.telegramLink = ReqData?.datas?.telegramLink
                const result = await finddata.save()
                if (result) {
                    return sendResponse(res, 200, { status: true, message: 'Deleted linkedinLink successfully' })
                }
                else {
                    return sendResponse(res, 400, { status: false, message: 'Error occurred' })
                }
            }
            if (ReqData?.linkdata == 'telegramLink') {
                finddata.telegramLink = ''
                finddata.facebookLink = ReqData?.datas?.facebookLink
                finddata.twitterLink = ReqData?.datas?.twitterLink
                finddata.linkedinLink = ReqData?.datas?.linkedinLink
                const result = await finddata.save()
                if (result) {
                    return sendResponse(res, 200, { status: true, message: 'Deleted telegramLink successfully' })
                }
                else {
                    return sendResponse(res, 400, { status: false, message: 'Error occurred' })
                }
            }
        }
    } catch (err) {
        console.log("Deletesocialmedia err", err);
        return sendResponse(res, 500, { status: false, message: 'Something went wrong!!' })
    }
}