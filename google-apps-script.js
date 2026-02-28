// Google Apps Script - Monthly sheets with batched endpoint, delete/update via GET
// Categories: H3:H11 (Food, Travel, Shopping, Bills, Fun, Health, Groceries, Saving, Other)
// Budget: H12/I12/J12

/**
 * Get or create a sheet for a specific month
 * @param {Date} date - The date to get the sheet for
 * @returns {Sheet} The sheet for that month
 */
function getOrCreateMonthSheet(date) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = getMonthSheetName(date);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = createMonthSheet(ss, sheetName);
  }

  return sheet;
}

/**
 * Generate sheet name from date (e.g., "February 2026")
 * @param {Date} date
 * @returns {string} Sheet name
 */
function getMonthSheetName(date) {
  // Validate date parameter
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date parameter passed to getMonthSheetName: ' + date);
  }

  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
  var month = monthNames[date.getMonth()];
  var year = date.getFullYear();
  return month + ' ' + year;
}

/**
 * Create a new monthly sheet with proper formatting and formulas
 * @param {Spreadsheet} ss - The spreadsheet
 * @param {string} sheetName - Name for the new sheet
 * @returns {Sheet} The newly created sheet
 */
function createMonthSheet(ss, sheetName) {
  // Create the sheet
  var sheet = ss.insertSheet(sheetName);

  // Set up headers (Row 1)
  sheet.getRange('A1:K1').setValues([[
    'Timestamp', 'VND', 'EUR', 'USD', 'Category', 'Note', '', 'SUMMARY', '', ''
  ]]);

  // Format headers
  sheet.getRange('A1:K1')
    .setFontWeight('bold')
    .setBackground('#f3f3f3');

  // Set up TOTALS row (Row 2)
  sheet.getRange('A2').setValue('TOTALS');
  sheet.getRange('B2').setFormula('=SUM(B3:B)');
  sheet.getRange('C2').setFormula('=SUM(C3:C)');
  sheet.getRange('D2').setFormula('=SUM(D3:D)');

  // Format totals row
  sheet.getRange('A2:D2').setFontWeight('bold');

  // Set up Summary block headers (H2:J2)
  sheet.getRange('H2:J2').setValues([['Category', 'EUR', '%']]);
  sheet.getRange('H2:J2').setFontWeight('bold');

  // Set up category labels (H3:H11)
  var categories = [
    ['Food'], ['Travel'], ['Shopping'], ['Bills'],
    ['Fun'], ['Health'], ['Groceries'], ['Saving'], ['Other']
  ];
  sheet.getRange('H3:H11').setValues(categories);

  // Set up category sum formulas (I3:I11)
  for (var row = 3; row <= 11; row++) {
    sheet.getRange('I' + row).setFormula('=SUMIF($E$3:$E,H' + row + ',$C$3:$C)');
  }

  // Set up category percentage formulas (J3:J11)
  for (var row = 3; row <= 11; row++) {
    sheet.getRange('J' + row).setFormula('=IF($C$2=0,0,I' + row + '/$C$2)');
    sheet.getRange('J' + row).setNumberFormat('0%');
  }

  // Set up Budget row (H12:J12)
  sheet.getRange('H12').setValue('Budget');
  sheet.getRange('I12').setValue(1600); // Default budget amount in EUR
  sheet.getRange('J12').setFormula('=1-C2/I12');
  sheet.getRange('J12').setNumberFormat('0%');

  // Freeze top 2 rows
  sheet.setFrozenRows(2);

  // Set column widths for better visibility
  sheet.setColumnWidth(1, 150); // Timestamp
  sheet.setColumnWidth(2, 100); // VND
  sheet.setColumnWidth(3, 80);  // EUR
  sheet.setColumnWidth(4, 80);  // USD
  sheet.setColumnWidth(5, 100); // Category
  sheet.setColumnWidth(6, 200); // Note
  sheet.setColumnWidth(8, 100); // SUMMARY Category
  sheet.setColumnWidth(9, 80);  // EUR
  sheet.setColumnWidth(10, 60); // %

  return sheet;
}

/**
 * Get the current viewing month's sheet name
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {string} Sheet name
 */
function getSheetNameFromParams(year, month) {
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[month - 1] + ' ' + year;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Parse the timestamp to determine which month sheet to use
    var timestamp = new Date(data.timestamp);
    // Handle dd/mm/yyyy format
    var postParts = data.timestamp.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (postParts) {
      timestamp = new Date(parseInt(postParts[3]), parseInt(postParts[2]) - 1, parseInt(postParts[1]),
                           parseInt(postParts[4]), parseInt(postParts[5]), parseInt(postParts[6]));
    }
    var sheet = getOrCreateMonthSheet(timestamp);

    // Append the transaction to the appropriate monthly sheet
    sheet.appendRow([
      data.timestamp,
      data.vnd || 0,
      data.eur || 0,
      data.usd || 0,
      data.category || '',
      data.note || ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Added to ' + sheet.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e.parameter.action || 'default';

  // Get year and month parameters for month-specific requests
  var year = e.parameter.year ? parseInt(e.parameter.year) : new Date().getFullYear();
  var month = e.parameter.month ? parseInt(e.parameter.month) : new Date().getMonth() + 1;
  var sheetName = getSheetNameFromParams(year, month);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  // If sheet doesn't exist for requested month, return empty data
  if (!sheet && (action === 'getAllData' || action === 'getTransactions' || action === 'getStats')) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      totalVND: 0,
      totalEUR: 0,
      totalUSD: 0,
      transactions: [],
      stats: {},
      budget: { amount: 0, percent: 0 }
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'delete') {
    // For delete, need to find which sheet the row is on
    var row = parseInt(e.parameter.row);
    var sheetNameForRow = e.parameter.sheetName; // Must pass sheet name for delete

    if (!row || row < 3 || !sheetNameForRow) {
      return err('Invalid parameters for delete');
    }

    var targetSheet = ss.getSheetByName(sheetNameForRow);
    if (!targetSheet) return err('Sheet not found: ' + sheetNameForRow);

    try {
      targetSheet.deleteRow(row);
      return ok('Deleted row ' + row + ' from ' + sheetNameForRow);
    } catch (er) {
      return err('Delete failed: ' + er.toString());
    }
  }

  if (action === 'update') {
    var uRow = parseInt(e.parameter.row);
    var sheetNameForUpdate = e.parameter.sheetName; // Must pass sheet name for update

    if (!uRow || uRow < 3 || !sheetNameForUpdate) {
      return err('Invalid parameters for update');
    }

    var targetSheet = ss.getSheetByName(sheetNameForUpdate);
    if (!targetSheet) return err('Sheet not found: ' + sheetNameForUpdate);

    try {
      // Parse new timestamp to see if it needs to move to a different month
      var newTimestamp = e.parameter.timestamp;
      var newDate = new Date(newTimestamp);
      // Handle dd/mm/yyyy format
      var tsParts = newTimestamp.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (tsParts) {
        newDate = new Date(parseInt(tsParts[3]), parseInt(tsParts[2]) - 1, parseInt(tsParts[1]),
                           parseInt(tsParts[4]), parseInt(tsParts[5]), parseInt(tsParts[6]));
      }
      var newSheetName = getMonthSheetName(newDate);

      // If timestamp changes to different month, move the transaction
      if (newSheetName !== sheetNameForUpdate) {
        var newSheet = getOrCreateMonthSheet(newDate);

        // Add to new sheet
        newSheet.appendRow([
          newTimestamp,
          parseFloat(e.parameter.vnd) || 0,
          parseFloat(e.parameter.eur) || 0,
          parseFloat(e.parameter.usd) || 0,
          e.parameter.category || '',
          e.parameter.note || ''
        ]);

        // Delete from old sheet
        targetSheet.deleteRow(uRow);

        return ok('Moved from ' + sheetNameForUpdate + ' to ' + newSheetName);
      } else {
        // Update in place
        targetSheet.getRange(uRow, 1, 1, 6).setValues([[
          newTimestamp,
          parseFloat(e.parameter.vnd) || 0,
          parseFloat(e.parameter.eur) || 0,
          parseFloat(e.parameter.usd) || 0,
          e.parameter.category || '',
          e.parameter.note || ''
        ]]);
        return ok('Updated row ' + uRow);
      }
    } catch (er) {
      return err('Update failed: ' + er.toString());
    }
  }

  if (action === 'addEntry') {
    try {
      var ts = e.parameter.timestamp;
      var entryDate = new Date(ts);
      // Handle dd/mm/yyyy format
      var parts = ts.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (parts) {
        entryDate = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]),
                             parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6]));
      }
      var targetSheet = getOrCreateMonthSheet(entryDate);
      targetSheet.appendRow([
        ts,
        parseFloat(e.parameter.vnd) || 0,
        parseFloat(e.parameter.eur) || 0,
        parseFloat(e.parameter.usd) || 0,
        e.parameter.category || '',
        e.parameter.note || ''
      ]);
      return ok('Added to ' + targetSheet.getName());
    } catch (er) {
      return err('Add failed: ' + er.toString());
    }
  }

  if (action === 'updateBudget') {
    var budgetAmount = parseFloat(e.parameter.budget);

    if (!budgetAmount || budgetAmount <= 0) {
      return err('Invalid budget amount');
    }

    // Validate year and month parameters
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return err('Invalid year or month parameters: year=' + year + ', month=' + month);
    }

    if (!sheet) {
      // Create the sheet if it doesn't exist yet
      var date = new Date(year, month - 1, 1);

      // Validate the date object
      if (isNaN(date.getTime())) {
        return err('Invalid date created from year=' + year + ', month=' + month);
      }

      sheet = getOrCreateMonthSheet(date);
    }

    try {
      sheet.getRange('I12').setValue(budgetAmount);
      return ok('Budget updated to ' + budgetAmount);
    } catch (er) {
      return err('Budget update failed: ' + er.toString());
    }
  }

  // BATCHED: Return everything for the requested month
  if (action === 'getAllData') {
    return getAllData(sheet);
  }

  if (action === 'getTransactions') return getTransactionHistory(sheet);
  if (action === 'getStats') return getStatsData(sheet);
  return getMonthlyTotals(sheet);
}

function ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success', message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}
function err(msg) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error', message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

// === BATCHED ENDPOINT - returns totals + transactions + stats in ONE call ===
function getAllData(sheet) {
  var values = sheet.getDataRange().getValues();

  // Totals from row 2
  var vndTotal = sheet.getRange('B2').getValue() || 0;
  var eurTotal = sheet.getRange('C2').getValue() || 0;
  var usdTotal = sheet.getRange('D2').getValue() || 0;

  // Transactions (reverse order, skip header + totals)
  var transactions = [];
  for (var i = values.length - 1; i >= 2; i--) {
    var row = values[i];
    if (!row[0]) continue;
    transactions.push({
      row: i + 1,
      sheetName: sheet.getName(),
      timestamp: toISO(row[0]),
      vnd: Number(row[1]) || 0,
      eur: Number(row[2]) || 0,
      usd: Number(row[3]) || 0,
      category: row[4] || '',
      note: row[5] || ''
    });
  }

  // Stats from summary block H3:J11
  var categories = sheet.getRange('H3:H11').getValues();
  var amounts = sheet.getRange('I3:I11').getValues();
  var percentages = sheet.getRange('J3:J11').getValues();
  var budgetAmount = sheet.getRange('I12').getValue() || 0;
  var budgetPercent = sheet.getRange('J12').getValue() || 0;

  var stats = {};
  for (var j = 0; j < categories.length; j++) {
    var cat = categories[j][0];
    if (!cat || cat === '') continue;
    stats[cat] = {
      amount: Number(amounts[j][0]) || 0,
      percent: parsePct(percentages[j][0])
    };
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    totalVND: vndTotal,
    totalEUR: eurTotal,
    totalUSD: usdTotal,
    transactions: transactions,
    stats: stats,
    budget: {
      amount: Number(budgetAmount) || 0,
      percent: parsePct(budgetPercent)
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

function getMonthlyTotals(sheet) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    totalVND: sheet.getRange('B2').getValue() || 0,
    totalEUR: sheet.getRange('C2').getValue() || 0,
    totalUSD: sheet.getRange('D2').getValue() || 0
  })).setMimeType(ContentService.MimeType.JSON);
}

function getTransactionHistory(sheet) {
  var values = sheet.getDataRange().getValues();
  var transactions = [];
  for (var i = values.length - 1; i >= 2; i--) {
    var row = values[i];
    if (!row[0]) continue;
    transactions.push({
      row: i + 1,
      sheetName: sheet.getName(),
      timestamp: toISO(row[0]),
      vnd: Number(row[1]) || 0,
      eur: Number(row[2]) || 0,
      usd: Number(row[3]) || 0,
      category: row[4] || '',
      note: row[5] || ''
    });
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success', transactions: transactions
  })).setMimeType(ContentService.MimeType.JSON);
}

function getStatsData(sheet) {
  var categories = sheet.getRange('H3:H11').getValues();
  var amounts = sheet.getRange('I3:I11').getValues();
  var percentages = sheet.getRange('J3:J11').getValues();
  var budgetAmount = sheet.getRange('I12').getValue() || 0;
  var budgetPercent = sheet.getRange('J12').getValue() || 0;

  var stats = {};
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i][0];
    if (!cat || cat === '') continue;
    stats[cat] = {
      amount: Number(amounts[i][0]) || 0,
      percent: parsePct(percentages[i][0])
    };
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    stats: stats,
    budget: { amount: Number(budgetAmount) || 0, percent: parsePct(budgetPercent) }
  })).setMimeType(ContentService.MimeType.JSON);
}

// Helper: convert any timestamp to ISO string
function toISO(ts) {
  if (ts instanceof Date) return ts.toISOString();
  var str = String(ts);
  var parts = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    var d = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]),
                     parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6]));
    return d.toISOString();
  }
  var parsed = new Date(str);
  return isNaN(parsed.getTime()) ? str : parsed.toISOString();
}

// Helper: parse percentage value
function parsePct(p) {
  if (typeof p === 'string' && p.includes('%')) return parseInt(p.replace('%', ''));
  if (typeof p === 'number' && Math.abs(p) < 10 && p !== 0) return Math.round(p * 100);
  if (typeof p === 'number') return Math.round(p);
  return 0;
}
