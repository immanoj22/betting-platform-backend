/** Packages */
import path from 'path';
import fs from 'fs'


/** File-System */

export const fileUpload = async (file, directory, fileName) => {
    try {
        
        const dirPath = path.join('assets', `/${directory}`);

        // MAKE DIRECTORY
        fs.mkdir(dirPath, { recursive: true }, err => {
            if (err) {
                console.log("Status: Directory_Created_Failed")
            } else {
                console.log("Status: Directory_Created ")
            }
        })

        // MOVE FILE
        await file.mv(path.join(`assets/${directory}`, fileName), function (err) {
            if (err) {
                console.log(err);
            }
            else {
                console.log(directory + 'Image Upload Successfully');
            }
        });
    } catch (e) {
        console.log("fileUpload_err", e);
    }
}


/** Image Validation */
export const imageValidation = async (attachment) => {
    let error = "";
    const specialCharRegex = /[!@#$%^&*":{}<>]/
    let validFile = ["png", "gif", "jpeg", "jpg", "mp4"]
    console.log("attachment", attachment);
    if (attachment.length > 1) {
        attachment.map((file) => {
            var filesize = file.size;
            var fileExtention = file.name.split(".")
            const fileType = file.name.split(".")[file.name.split(".").length - 1]
            console.log(fileType, "fileType")
            if (!validFile.some((val) => fileType.includes(val))) {
                error = "picture updated failed, please upload PNG, JPG, JPEG files";
            } else if (filesize > 3000000 || filesize < 2) {                        //3000 kb in bytes 3000000
                error = "Image Size should be less than 3000 Kb";
            } else if (fileExtention.length > 1) {
                error = "Invalid file name: Multiple extensions are not allowed (e.g., WhatsApp.34.png).";
            } else if (specialCharRegex.test(fileExtention[0])) {
                error = 'Invalid file name: Special characters (!@#$%^&*":{}<>) are not allowed.'
            } else if (attachment.name.length > 15) {
                error = "Length of Profile picture file name should be lesser than or equal to 15 characters"
            }
        })
    }
    else {
        var filesize = attachment.size;
        var fileExtention = attachment.name.split(".")
        const fileType = attachment.name.split(".")[attachment.name.split(".").length - 1]

        console.log(fileType, fileExtention.length, "fileType", validFile.some((val) => fileType.includes(val)))

        if (!validFile.some((val) => fileType.includes(val))) {
            error = "Profile picture updated failed, please upload PNG, JPG, JPEG files";
        } else if (filesize > 3000000) {
            error = "Image Size should be less than 3000 Kb";
        } else if (fileExtention.length > 2) {
            error = "Invalid file name: Multiple extensions are not allowed (e.g., WhatsApp.34.png).";
        } else if (specialCharRegex.test(fileExtention[0])) {
            error = 'Invalid file name: Special characters (!@#$%^&*":{}<>) are not allowed.'
        } else if (attachment.name.length > 15) {
            error = "Length of Profile picture file name should be lesser than or equal to 15 characters"
        }
    }
    return Object.keys(error).length > 0 ? error : true
};
