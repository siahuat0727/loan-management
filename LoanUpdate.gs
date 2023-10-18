const HEADER_COLOR = '#AAD1F0';
const COLOR_1 = '#F3F3F3';
const COLOR_2 = '#D9D9D9';

function monthlyLoanUpdate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  initializeSheets(ss);
  
  const transactionsData = getSortedTransactionsData(ss);
  if (transactionsData.length === 0) return;
  
  processTransactions(ss, transactionsData);
}

function initializeSheets(ss) {
  const sheets = ['Monthly Summary', 'Monthly Details'].map(name => ss.getSheetByName(name));
  sheets.forEach(sheet => sheet.clear());
  
  sheets[0].appendRow(['Year-Month', 'Total Loan Added', 'Total Repayment Made', 'Monthly Interest Amount', 'Remaining Loan Amount'])
           .getRange(1, 1, 1, 5).setBackground(HEADER_COLOR).setHorizontalAlignment('center');
  sheets[0].getRange('A:A').setHorizontalAlignment('center');

  sheets[1].appendRow(['Year-Month', 'Loan Added', 'Repayment Made', 'Monthly Interest Amount', 'Cumulative Amount', 'Notes'])
           .getRange(1, 1, 1, 6).setBackground(HEADER_COLOR).setHorizontalAlignment('center');
  sheets[1].getRange('A:A').setHorizontalAlignment('center');
}

function processTransactions(ss, transactionsData) {
  let remainingLoanAmount = 0;
  const firstTransactionDate = transactionsData[0][0];
  const currentDate = new Date();
  let transactionIndex = 0;
  let bgColor = COLOR_1;
  
  for (let d = new Date(firstTransactionDate); d <= currentDate; d.setMonth(d.getMonth() + 1)) {
    const monthYearStr = getMonthYearStr(d);
    const monthYear = new Date(d.getFullYear(), d.getMonth(), 1);
    
    const {monthlyInterestRate, monthlyInterestRateStr} = getInterestRates(ss, monthYear);
    let totalLoanAdded = 0, totalRepaymentMade = 0;
    
    while (transactionIndex < transactionsData.length && withinCurrentMonth(transactionsData[transactionIndex], monthYear)) {
      const row = transactionsData[transactionIndex++];
      const {type, amount, notes} = parseTransactionRow(row);
      
      totalLoanAdded += (type === 'Loan Added') ? amount : 0;
      totalRepaymentMade += (type === 'Repayment Made') ? amount : 0;
      
      remainingLoanAmount = adjustRemainingAmount(remainingLoanAmount, amount, type);
      appendToMonthlyDetails(ss, monthYearStr, row[0], type, amount, formatInterestAmount(type, remainingLoanAmount, monthlyInterestRate), remainingLoanAmount, notes || '', bgColor);
    }
    
    const monthlyInterestAmount = remainingLoanAmount * monthlyInterestRate;    
    remainingLoanAmount += monthlyInterestAmount;

    appendDetailsAndSummary(ss, monthYearStr, totalLoanAdded, totalRepaymentMade, remainingLoanAmount, monthlyInterestAmount, monthlyInterestRateStr, bgColor);
    
    bgColor = switchColor(bgColor);
  }
}

function withinCurrentMonth(row, monthYear) {
  const date = row[0];
  const transactionMonthYear = new Date(date.getFullYear(), date.getMonth(), 1);
  return transactionMonthYear.getTime() <= monthYear.getTime();
}

function parseTransactionRow(row) {
  return {
    type: row[1],
    amount: parseFloat(row[2].toFixed(2)),
    notes: row[3]
  };
}

function adjustRemainingAmount(remaining, amount, type) {
  return parseFloat((remaining + amount * (type === 'Loan Added' ? 1 : -1)).toFixed(2));
}

function formatInterestRate(type, rateStr) {
  return type === 'Interest Applied' ? rateStr : '';
}

function formatInterestAmount(type, remaining, rate) {
  return type === 'Interest Applied' ? formatAmount(remaining * rate) : '';
}

function applyMonthlyInterest(remaining, rate) {
  return parseFloat((remaining + remaining * rate).toFixed(2));
}

function appendDetailsAndSummary(ss, monthYearStr, totalLoanAdded, totalRepaymentMade, remainingLoanAmount, monthlyInterestAmount, monthlyInterestRateStr, bgColor) {
  appendToMonthlyDetails(ss, monthYearStr, '', 'Interest Applied', '', monthlyInterestAmount, remainingLoanAmount, monthlyInterestRateStr, bgColor);
  appendToMonthlySummary(ss, monthYearStr, totalLoanAdded, totalRepaymentMade, monthlyInterestAmount, remainingLoanAmount, bgColor);
}

function switchColor(color) {
  return color === COLOR_1 ? COLOR_2 : COLOR_1;
}

function getInterestRates(ss, monthYear) {
  const interestRateSheet = ss.getSheetByName('Interest Rate Changes');
  let lastInterestRate = 0;
  const interestRateData = interestRateSheet.getRange(2, 1, interestRateSheet.getLastRow() - 1, 2).getValues();
  interestRateData.forEach(function(row) {
    const changeDate = row[0];
    const interestRate = row[1];
    if (changeDate && changeDate <= monthYear) lastInterestRate = interestRate;
  });
  const monthlyInterestRate = Math.pow((1 + lastInterestRate / 100), 1 / 12) - 1;
  const monthlyInterestRateStr = `Yearly ${lastInterestRate.toFixed(2)}% = Monthly ${(monthlyInterestRate * 100).toFixed(4)}%`;
  return { monthlyInterestRate, monthlyInterestRateStr };
}

function getSortedTransactionsData(ss) {
  const transactionsSheet = ss.getSheetByName('Transactions');
  const transactionsData = transactionsSheet.getRange(2, 2, transactionsSheet.getLastRow() - 1, 5).getValues();
  transactionsData.sort(function(a, b) { return a[0] - b[0]; });
  return transactionsData;
}

function formatAmount(amount) {
  return amount.toFixed(2);
}

function getMonthYearStr(d) {
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2); // Last two digits of the year
  return `${year}-${month}`;
}

function appendToMonthlySummary(ss, monthYearStr, totalLoanAdded, totalRepaymentMade, monthlyInterestAmount, remainingLoanAmount, bgColor) {
  var monthlySummarySheet = ss.getSheetByName('Monthly Summary');
  var lastRow = monthlySummarySheet.getLastRow() + 1;
  monthlySummarySheet.appendRow([monthYearStr, totalLoanAdded, totalRepaymentMade, monthlyInterestAmount, remainingLoanAmount]);
  monthlySummarySheet.getRange(lastRow, 2, 1, 4).setNumberFormat('0.00');
  monthlySummarySheet.getRange(lastRow, 1, 1, 5).setBackground(bgColor);
}

function appendToMonthlyDetails(ss, monthYearStr, date, transactionType, amount, monthlyInterestAmount, remainingLoanAmount, notes, bgColor) {
  const monthlyDetailsSheet = ss.getSheetByName('Monthly Details');
  const lastRow = monthlyDetailsSheet.getLastRow() + 1;
  
  const loanAddedAmount = (transactionType === 'Loan Added') ? amount : '';
  const repaymentMadeAmount = (transactionType === 'Repayment Made') ? amount : '';
  
  let formattedDate = '';
  if (date) {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    formattedDate = `${year}-${month}-${day}`;
  }
  
  let mergedNotes = `${transactionType}${formattedDate ? ` at ${formattedDate}` : ''}`;
  if (notes) {
    mergedNotes += `: ${notes}`;
  }
  
  monthlyDetailsSheet.appendRow([monthYearStr, loanAddedAmount, repaymentMadeAmount, monthlyInterestAmount, remainingLoanAmount, mergedNotes]);
  monthlyDetailsSheet.getRange(lastRow, 2, 1, 4).setNumberFormat('0.00');
  monthlyDetailsSheet.getRange(lastRow, 1, 1, 6).setBackground(bgColor);
  monthlyDetailsSheet.getRange(lastRow, 6, 1, 1).setFontColor('#808080');
}
