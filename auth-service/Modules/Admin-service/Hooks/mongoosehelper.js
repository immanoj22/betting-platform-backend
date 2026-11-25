//save
export const Save = async (data) => {
    const { DBName, Data } = data;
    try {
        let saveData = new DBName(Data);
        let FinOnUData = await saveData.save();
        return FinOnUData;

    } catch (e) {
        console.log("mongoose save err", e);
        return null
    }
};


//find

export const find = async (data) => {
    const { DBname, findata, sort, limit, populate, populate2, count, projectdata, skip } = data;
    try {
        if (sort && projectdata && populate && limit) {
            var FinOnData = await DBname.find(findata, projectdata)
                .sort(sort)
                .populate(populate)
                .limit(limit);
        }
        else if (projectdata && populate && limit) {
            var FinOnData = await DBname.find(findata, projectdata)
                .populate(populate)
                .limit(limit);
        }
        else if (projectdata && sort && populate) {
            var FinOnData = await DBname.find(findata, projectdata)
                .sort(sort)
                .populate(populate)
            // .populate(populate2)
        }
        else if (projectdata && limit && skip) {
            var FinOnData = await DBname.find(findata, projectdata)
                .limit(limit)
                .skip(skip)

        }
        else if (sort && populate) {
            var FinOnData = await DBname.find(findata)
                .sort(sort)
                .populate(populate)
        }
        else if (sort && limit) {
            var FinOnData = await DBname.find(findata)
                .sort(sort)
                .limit(limit);
        }
        else if (projectdata && sort) {
            var FinOnData = await DBname.find(findata, projectdata)
                .sort(sort)
        }
        else if (projectdata) {
            var FinOnData = await DBname.find(findata, projectdata)

        }
        else if (limit) {
            var FinOnData = await DBname.find(findata)
                .skip(skip)
                .limit(limit);
        }
        else if (sort) {
            var FinOnData = await DBname.find(findata)
                .sort(sort)
        }
        else if (count) {
            var FinOnData = await DBname.countDocuments(findata)

        }
        else {
            var FinOnData = await DBname.find(findata)
        }
        if (FinOnData) {
            return { success: 'success', msg: "Find Successfully", data: FinOnData };
        }
        else {
            return { success: 'error', msg: "Error occured", data: FinOnData };
        }

    } catch (e) {
        console.log("mongoose find err", e);
        return { success: 'error', msg: "Error occured", data: FinOnData };
    }
};

//findone

export const findone = async (data) => {

    const { DBName, finData, selData, projectdata, populate } = data;
    try {
        if (projectdata && populate) {
            var FinOnData = await DBName.findOne(finData, projectdata)
                .populate(populate)
        }
        else {
            var FinOnData = await DBName.findOne(finData, projectdata)
        }
        return FinOnData;
    } catch (e) {
        console.log("mongoose findone err", e);
        return null
    }
};
//findoneandupdate

export const FindOneAndUpdate = async (data) => {
    const { DBName, finData, updata, save } = data;

    try {
        let FinOnUData = await DBName.findOneAndUpdate(finData, updata, save);
        return FinOnUData

    } catch (e) {
        console.log("mongoose update err", e);
        return null

    }
};
export const FindOneAndRemove = async (data) => {
    const { DBName, FinData } = data;
    try {
        var record = await DBName.findOneAndDelete(FinData);
        return record
    } catch (e) {
        console.log("mongoose delete err", e);
        return null;
    }
};