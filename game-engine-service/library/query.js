// Package
import isEmpty from 'is-empty';


export const paginationQuery = (query = {}) => {
    let pagination = { skip: 0, limit: 10, page: 1 };

    try {
        const page = Number(query.page);
        const limit = Number(query.limit);

        if (!isNaN(page) && page > 0) {
            pagination.page = page;
        }

        if (!isNaN(limit) && limit > 0) {
            pagination.limit = limit;
        }

        pagination.skip = (pagination.page - 1) * pagination.limit;

        return pagination;
    } catch (e) {
        console.log("paginationQuery_err", e);
        return pagination;
    }
};


export const filterSearchQuery = async (query = {}, fields = []) => {
    let filterQuery = {}
    try {
        console.log(query, 'filterSearchQuery')
        if (!isEmpty(query) && !isEmpty(query.search)) {
            let filterArray = []
            for (const key of fields) {
                let filter = {};
                filter[key] = new RegExp(query.search, 'i');
                filterArray.push(filter)
            }
            console.log(filterArray, 'filterArray')
            filterQuery = { "$or": filterArray };
        }
        // console.log(filterQuery, 'filterQuery')
        return filterQuery
    } catch (e) {
        console.log("filterSearchQuery_err", e);
        return filterQuery
    }
}


export const dateQuery = (startDate, endDate) => {
    try {
        let query = {}
        let date = new Date()
        let night = new Date()
        if (startDate != 0 && endDate != 0 && !isEmpty(startDate) && !isEmpty(endDate)) {
            date = new Date(parseFloat(startDate));
            night = new Date(parseFloat(endDate));
        } else if (!isEmpty(startDate) && startDate != 0 && endDate == 0) {
            date = new Date(parseFloat(startDate));
        } else if (startDate == 0 && !isEmpty(endDate) && endDate != 0) {
            night = new Date(parseFloat(endDate));
        } else {
            return query
        }

        date.setSeconds(0);
        date.setMinutes(0);
        date.setHours(0);

        // night.setHours(23);
        // night.setMinutes(59);
        // night.setSeconds(59);

        query = { createdAt: { $gte: date, $lte: night } };
        console.log("query_data", query);
        return query
    } catch (e) {
        console.log("dateQuery_err", e);
        return {}
    }
}