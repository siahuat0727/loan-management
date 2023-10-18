function updateSheetsAndSendNotificationEmail() {
  monthlyLoanUpdate();
  sendNotificationEmail();
}

// Main function to send notification email
function sendNotificationEmail() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const { lastMonthStr, remainingLoanAmountLastMonth } = getLastMonthSummaryInfo(ss);
    const emailInfo = getEmailInfo(ss);
    const messageHtml = constructEmailMessageHtml(ss, remainingLoanAmountLastMonth, lastMonthStr);
    sendOrReplyEmail(ss, emailInfo, messageHtml);
}

// Handle email thread for sending or appending email
function sendOrReplyEmail(ss, emailInfo, messageHtml) {
    let threadId = emailInfo.threadId;
    let thread = threadId ? GmailApp.getThreadById(threadId) : null;

    if (!thread) {
        const newThread = sendNewEmail(emailInfo, messageHtml);
        saveNewThreadId(ss, newThread.getId());
    } else {
        thread.replyAll('', { htmlBody: messageHtml });
    }
}

// Send a new email and return the thread
function sendNewEmail(emailInfo, messageHtml) {
    GmailApp.sendEmail(emailInfo.borrowerEmail, emailInfo.subject, '', {
        cc: emailInfo.lenderEmail,
        htmlBody: messageHtml
    });

    // Search for the thread by the unique subject and email recipient
    const threads = GmailApp.search(`subject:${emailInfo.subject} to:${emailInfo.borrowerEmail}`);
    
    // Return the most recent thread (assuming it's the one we just sent)
    return threads.length > 0 ? threads[0] : null;
}

// Save new thread info for future reference
function saveNewThreadId(ss, newThreadId) {
    const emailAddressesSheet = ss.getSheetByName('Email Addresses');
    emailAddressesSheet.getRange('D2').setValue(newThreadId);
}

// Get email information from the 'Email Addresses' sheet
function getEmailInfo(ss) {
    const emailAddressesSheet = ss.getSheetByName('Email Addresses');
    const subject = emailAddressesSheet.getRange('C2').getValue() || `Monthly Loan Summary`;
    return {
        lenderEmail: emailAddressesSheet.getRange('A2').getValue(),
        borrowerEmail: emailAddressesSheet.getRange('B2').getValue(),
        threadId: emailAddressesSheet.getRange('D2').getValue(),
        subject: subject
    };
}

// Get information for the last month from the Monthly Summary sheet
function getLastMonthSummaryInfo(ss) {
    const monthlySummarySheet = ss.getSheetByName('Monthly Summary');
    const summaryData = monthlySummarySheet.getDataRange().getValues();
    const filteredSummaryData = filterUntilLastMonth(summaryData);
    const lastMonthData = filteredSummaryData[filteredSummaryData.length - 1];
    return {
        lastMonthStr: lastMonthData ? lastMonthData[0] : 'N/A',
        remainingLoanAmountLastMonth: lastMonthData ? lastMonthData[4] : 'N/A'
    };
}

// Construct the HTML body of the email message
function constructEmailMessageHtml(ss, remainingLoanAmountLastMonth, lastMonthStr) {
    const spreadsheetUrl = ss.getUrl() + "#gid=" + ss.getSheetByName('Monthly Details').getSheetId();
    remainingLoanAmountLastMonth = parseFloat(remainingLoanAmountLastMonth).toFixed(2);
    
    let messageHtml = `<p>Hello,</p>`;
    messageHtml += `<p>Here is your updated loan summary for ${lastMonthStr}. The Remaining Loan Amount is ${remainingLoanAmountLastMonth}.</p>`;
    messageHtml += composeMonthlyDataHtml(ss, 'Monthly Summary', 'Monthly Summary', filterUntilLastMonth);
    messageHtml += composeMonthlyDataHtml(ss, 'Monthly Details (Last three months)', 'Monthly Details', filterLastThreeMonths);
    messageHtml += `<p>For additional details, please refer to the spreadsheet <a href="${spreadsheetUrl}">here</a>.</p>`;
    return messageHtml;
}

// Compose HTML for monthly data based on a filter function
function composeMonthlyDataHtml(ss, title, sheetName, filterFunc) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return `<h2>Error: Could not find sheet with the name ${sheetName}</h2>`;
    }
    const data = sheet.getDataRange().getValues();
    const filteredData = filterFunc(data);
    return `<h2>${title}:</h2>` + constructTableHtml(filteredData);
}

// Function to construct HTML tables
function constructTableHtml(data) {
    let tableHtml = "<table border='1'>";
    data.forEach((row, index) => {
        tableHtml += "<tr>";
        row.forEach(cell => {
            // Apply special formatting for Date and floating-point numbers
            if (cell instanceof Date) {
                cell = formatDateYYMMDD(cell);
            }
            const roundedCell = (typeof cell === 'number' && !Number.isInteger(cell)) ? parseFloat(cell).toFixed(2) : cell;
            tableHtml += `<${index === 0 ? 'th' : 'td'}>${roundedCell}</${index === 0 ? 'th' : 'td'}>`;
        });
        tableHtml += "</tr>";
    });
    tableHtml += "</table><br>";
    return tableHtml;
}

function formatDate(date) {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function filterLastThreeMonths(data) {
    const currentDate = new Date();
    const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1);
    const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  
    return data.filter((row, index) => {
        if (index === 0) return true;
  
        const rowDate = new Date('20' + row[0] + '-01');
        return rowDate >= threeMonthsAgo && rowDate <= endOfLastMonth;
    });
}

function filterUntilLastMonth(data) {
    const currentDate = new Date();
    const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  
    return data.filter((row, index) => {
        if (index === 0) return true;  // Always include the header
  
        const rowDate = new Date('20' + row[0] + '-01');
        return rowDate <= endOfLastMonth;
    });
}

function getDetailsSheetUrl(ss) {
    return ss.getUrl() + "#gid=" + ss.getSheetByName('Monthly Details').getSheetId();
}
