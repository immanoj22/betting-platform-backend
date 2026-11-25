export const downloadDataCSV = async (data, user) => {
    try {
        const { type } = data
        let csvRow = []
        let filter = {};
        const { startDate, endDate, search } = data;
        console.log("typetypevv", type, startDate, endDate, search, type === "users")
        if (Number(startDate) || Number(endDate)) {
            let dateQueryFilter = dateQuery(startDate, endDate);
            filter.createdAt = dateQueryFilter.createdAt;
        }

        if (type === "users") {

            if (data?.status?.length > 0 && data?.status != "all") {
                filter['status'] = data?.status;
            }
            if (Number(startDate) || Number(endDate)) {
                let dateQueryFilter = dateQuery(startDate, endDate);
                if (dateQueryFilter.createdAt) {
                    filter['createdAt'] = dateQueryFilter.createdAt;
                }
            }

            csvRow.push(["Date", "Email", "Name", "Phone Number", "Status"]);
            let result = await usersForAdmin(data, filter)
            console.log("resDepositresDeposiresDepositt", result)
            result = result?.result?.data
            for (let i = 0; i < result?.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.email,
                    result[i]?.userName,
                    result[i]?.countryCode + " " + result[i]?.mobileNumber,
                    result[i]?.status
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "passbookhistory") {
            csvRow.push(["Date", "Symbol", "Before Balance", "After Balance", "Type", "Amount", "(Trade / Transfer) Type"]);
            let result = await getPassbookHistory(data)
            result = result.result
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.currencySymbol,
                    result[i]?.beforeBalance,
                    result[i]?.afterBalance,
                    result[i]?.amount,
                    result[i]?.type,
                    result[i]?.transferType
                )
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type == "kyc") {
            csvRow.push(["Date", "Email", "KYC Status"]);
            let result = await getPendingKyc(data)
            console.log('resuresultlt', result)
            result = result?.pendingUsers
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.email,
                    result[i]?.kycStatus,
                )
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "feefortraders") {
            csvRow.push(["Date", "Email", "AccountId", "Trade Type", "Total Earned"]);
            let result = await getFeeHistory(data)
            result = result?.data
            console.log('resuresultlt', result)
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i]?.createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.userId.email,
                    result[i]?.accountId || '',
                    result[i]?.transcationType || '',
                    result[i]?.fee || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "deposit") {
            csvRow.push(["Date", "Modified Date", "Email", "Currency", , "Requested Amount", "Transfer Amount", "Status"]);
            console.log("ffffilter", filter);
            let result = await getDepositList(data)
            result = result?.result
            console.log("result", result);
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i].updatedAt ? result[i].updatedAt : '',
                    result[i]?.userId.email || '',
                    result[i]?.currencySymbol?.toUpperCase() || '',
                    result[i]?.transactionAmount || '',
                    result[i]?.amount || '',
                    result[i]?.status || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "withdraw") {
            csvRow.push(["Date", "Email", "Coin", , "Requested Amount", "Status"]);
            let result = await getWithdrawLists(data)
            result = result?.result
            console.log("result", result);
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userId.email || '',
                    result[i]?.currencyId?.currencySymbol || '',
                    result[i]?.transactionAmount || '',
                    result[i]?.status || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "futureorders") {
            csvRow.push(["Date", "Order Id", "Contracts", "Email", "Quantity", , "Filled / Remaining", "Exec Price", "Order Price", "Buy or Sell", "Order Value", "Fees", "Type", "Status", "Reduce Only"]);
            let result = await getHistoryHook(data)
            result = result?.result
            console.log("result", result);
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?._id || '',
                    result[i]?.pairName?.toUpperCase() || '',
                    result[i]?.email || '',
                    result[i]?.quantity || '',
                    result[i]?.filledQuantity ? result[i]?.filledQuantity + "/" + result[i]?.remaining : "" || '',
                    result[i]?.e_price || '',
                    result[i]?.price || '',
                    result[i]?.buyorsell || '',
                    result[i]?.orderValue || '',
                    result[i]?.fees || '',
                    result[i]?.orderType || '',
                    result[i]?.status || '',
                    result[i]?.position_status || '',
                    result[i]?.reduce_only ? "True" : "False" || '',
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }
        else if (type === "futurecloseorder") {
            csvRow.push(["Date", "Email", "Accound ID", "Gross PnL", "Contracts", "Closing Direction", "Close quantity", "Entry price", "Closing price", "Order Value"]);
            let result = await closeHistoryHook(data)
            result = result?.data
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userEmail || '',
                    result[i]?.accountId || '',
                    result[i]?.grossPandL || '',
                    result[i]?.pairName || '',
                    result[i]?.closing_direction || '',
                    result[i]?.quantity || '',
                    result[i]?.entryPrice || '',
                    result[i]?.closePrice || '',
                    result[i]?.orderValue || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type === "recentTransaction") {
            csvRow.push(["Date", "Email", "Type", "From", "To", "Status", "Amount"]);
            let result = await recentTransaction(data)
            result = result?.result
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userId?.email || '',
                    result[i]?.transferType || '',
                    result[i]?.from || '',
                    result[i]?.to || '',
                    result[i]?.status || '',
                    result[i]?.currencySymbol || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow }
        }

        else if (type == 'adminorderhistory') {
            csvRow.push(["Date", "Email", "PairName", "Price", "Size", "OrderValue"]);
            let result = await forceLiquidationOrders(user, data);
            result = result.result;
            console.log('resullllt', result)
            for (let i = 0; i < result.length; i++) {
                let csvData = []
                csvData.push(
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.email || '',
                    result[i]?.pairName || '',
                    result[i]?.price || '',
                    result[i]?.quantity || '',
                    result[i]?.orderValue || ''
                );
                csvRow.push(csvData);
            }
            return { status: true, csvRow };
        }
    } catch (e) {
        console.log("downloadDataCSV_err", e);
        return { status: false, csvRow: [] }
    }
}

export const downloadDataPDF = async (data, user) => {
    try {
        console.log("downloadDataPDF__Det", data)
        let pdfRow = []
        let filter = {};
        const { startDate, endDate, search, type } = data;
        if (Number(startDate) || Number(endDate)) {
            let dateQueryFilter = dateQuery(startDate, endDate);
            filter.createdAt = dateQueryFilter.createdAt;
        }

        if (type === "users") {
            pdfRow.push(["Date", "Email", "Name", "Phone Number", "Status"]);
            let pdfData = [];

            if (data?.status?.length > 0 && data?.status != "all") {
                filter['status'] = data?.status;
            }
            if (Number(startDate) || Number(endDate)) {
                let dateQueryFilter = dateQuery(startDate, endDate);
                if (dateQueryFilter.createdAt) {
                    filter['createdAt'] = dateQueryFilter.createdAt;
                }
            }

            let result = await usersForAdmin(data, filter)
            console.log("aaaaaaaa1232123", result.result.data)
            result = result.result.data
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.email,
                    result[i]?.userName,
                    result[i]?.countryCode + " " + result[i]?.mobileNumber,
                    result[i]?.status
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

        else if (type === "passbookhistory") {
            pdfRow.push(["Date", "Symbol", "Before Balance", "After Balance", "Amount", "Type", "(Trade / Transfer) Type"]);
            let pdfData = [];
            let result = await getPassbookHistory(data)
            result = result.result
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.currencySymbol,
                    result[i]?.beforeBalance,
                    result[i]?.afterBalance,
                    result[i]?.amount,
                    result[i]?.type,
                    result[i]?.transferType
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }


        else if (type == "kyc") {
            pdfRow.push(["Date", "Email", "KYC Status"]);
            let pdfData = []
            let result = await getPendingKyc(data)
            result = result?.pendingUsers
            console.log("resuresultltresult", result)
            for (let i = 0; i < result.length; i++) {
                pdfData.push(
                    [
                        result[i].createdAt ? momentFormat(result[i].createdAt) : '',
                        result[i]?.email,
                        result[i]?.kycStatus,
                    ]
                )
            }
            return { status: true, pdfRow, pdfData }
        }


        else if (type == 'feefortraders') {
            pdfRow.push(["Date", "Email", "AccountId", "Trade Type", "Total Earned"]);
            let pdfData = []
            let result = await getFeeHistory(data)
            console.log('resultresult123123', result)
            result = result?.data
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i]?.createdAt ? momentFormat(result[i].createdAt) : '',
                    result[i]?.userId.email,
                    result[i]?.accountId || '',
                    result[i]?.transcationType || '',
                    result[i]?.fee || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

        else if (type == 'deposit') {
            pdfRow.push(["Date", "Modified Date", "Email", "Currency", , "Requested Amount", "Transfer Amount", "Status"]);
            let pdfData = []
            let result = await getDepositList(data)
            result = result?.result
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i].updatedAt ? result[i].updatedAt : '',
                    result[i]?.userId.email || '',
                    result[i]?.currencySymbol?.toUpperCase() || '',
                    result[i]?.transactionAmount || '',
                    result[i]?.amount || '',
                    result[i]?.status || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

        else if (type == 'withdraw') {
            pdfRow.push(["Date", "Email", "Coin", , "Requested Amount", "Status"]);
            let pdfData = []
            let result = await getWithdrawLists(data)
            result = result?.result
            console.log("resultresultresult", result)
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userId.email || '',
                    result[i]?.currencyId?.currencySymbol || '',
                    result[i]?.transactionAmount || '',
                    result[i]?.status || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }


        else if (type == 'futureorders') {
            pdfRow.push(["Date", "Order Id", "Contracts", "Email", "Quantity", , "Filled / Remaining", "Exec Price", "Order Price", "Buy or Sell", "Order Value", "Fees", "Type", "Status", "Position Status", "Reduce Only"]);
            let pdfData = []
            let result = await getHistoryHook(data)
            result = result?.result
            console.log("qqqqqqqq", result)
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?._id || '',
                    result[i]?.pairName?.toUpperCase() || '',
                    result[i]?.email || '',
                    result[i]?.quantity || '',
                    result[i]?.filledQuantity ? result[i]?.filledQuantity + "/" + result[i]?.remaining : "" || '',
                    result[i]?.e_price || '',
                    result[i]?.price || '',
                    result[i]?.buyorsell || '',
                    result[i]?.orderValue || '',
                    result[i]?.fees || '',
                    result[i]?.orderType || '',
                    result[i]?.status || '',
                    result[i]?.position_status || '',
                    result[i]?.reduce_only ? "True" : "False" || '',
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

        else if (type == 'futurecloseorder') {
            pdfRow.push(["Date", "Email", "Accound ID", "Gross PnL", "Contracts", "Closing Direction", "Close quantity", "Entry price", "Closing price", "Order Value"]);
            let pdfData = []
            let result = await closeHistoryHook(data)
            result = result?.data
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userEmail || '',
                    result[i]?.accountId || '',
                    result[i]?.grossPandL || '',
                    result[i]?.pairName || '',
                    result[i]?.closing_direction || '',
                    result[i]?.quantity || '',
                    result[i]?.entryPrice || '',
                    result[i]?.closePrice || '',
                    result[i]?.orderValue || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

        else if (type == 'recentTransaction') {
            pdfRow.push(["Date", "Email", "Type", "From", "To", "Status", "Amount"]);
            let pdfData = []
            console.log("recentTransaction", user, query)
            let result = await recentTransaction(data, user, query)
            result = result?.result
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.userId?.email || '',
                    result[i]?.transferType || '',
                    result[i]?.from || '',
                    result[i]?.to || '',
                    result[i]?.status || '',
                    result[i]?.currencySymbol || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }
        else if (type == 'adminorderhistory') {
            pdfRow.push(["Date", "Email", "PairName", "Price", "Size", "OrderValue"]);
            let pdfData = []
            let result = await forceLiquidationOrders(user, data);
            result = result.result;
            console.log('resullllt', result)
            for (let i = 0; i < result.length; i++) {
                pdfData.push([
                    result[i].createdAt ? momentFormat(result[i].createdAt) : "",
                    result[i]?.email || '',
                    result[i]?.pairName || '',
                    result[i]?.price || '',
                    result[i]?.quantity || '',
                    result[i]?.orderValue || ''
                ]);
            }
            return { status: true, pdfRow, pdfData };
        }

    } catch (e) {
        console.log("downloadDataPDF_err", e);
        return { status: false, pdfRow: [], pdfData: [] }
    }
}