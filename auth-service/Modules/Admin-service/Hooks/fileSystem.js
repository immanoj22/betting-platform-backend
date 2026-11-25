const fs = require('fs');
const path = require('path');

export const fileSystem = async (files, filename, paths) => {
    try {
        files?.mv(path.join(`${paths}`, filename), function (err) {
            if (err) {
                console.log("filefilefile_filefilefile", err);
            }
            else {
                console.log('Image Upload Successfully');
                return "Image Upload Successfully"
            }
        })
    } catch (err) {
        console.log(err, "fileSystem__err")
    }
} 