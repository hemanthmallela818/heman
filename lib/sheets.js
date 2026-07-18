const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Determine path for mock DB to persist edits between dev server reloads
const MOCK_DB_PATH = path.join(process.cwd(), 'lib', 'mock_db.json');

// Helper to convert 0-based column index to spreadsheet letters (e.g., 0 -> A, 27 -> AB)
function colIndexToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Helper to match header column index dynamically based on common keywords
function findHeaderIndex(headers, colName) {
  if (!colName) return -1;
  const cleanCol = String(colName).toLowerCase().trim().replace(/[\s_-]+/g, '');
  const cleanHeaders = headers.map(h => String(h).toLowerCase().trim().replace(/[\s_-]+/g, ''));
  
  if (cleanCol === 'itemname' || cleanCol === 'name' || cleanCol.includes('name')) {
    const idx = cleanHeaders.findIndex(h => h === 'itemname' || h.includes('name'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'quantity' || cleanCol === 'qty' || cleanCol.includes('quantity') || cleanCol.includes('qty') || cleanCol.includes('stock') || cleanCol.includes('count')) {
    const idx = cleanHeaders.findIndex(h => h === 'quantity' || h === 'itemquantity' || h.includes('quantity') || h.includes('qty') || h.includes('stock') || h.includes('count'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'units' || cleanCol === 'unit' || cleanCol.includes('unit')) {
    const idx = cleanHeaders.findIndex(h => h === 'units' || h.includes('unit'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'costprice' || cleanCol === 'cost' || cleanCol.includes('cost') || cleanCol.includes('buy') || cleanCol.includes('purchase')) {
    const idx = cleanHeaders.findIndex(h => h === 'costprice' || h.includes('cost') || h.includes('buy') || h.includes('purchase'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'sellingprice' || cleanCol === 'sellprice' || cleanCol === 'sell' || cleanCol === 'price' || cleanCol.includes('sell') || (cleanCol.includes('price') && !cleanCol.includes('cost') && !cleanCol.includes('total'))) {
    const idx = cleanHeaders.findIndex(h => h === 'sellingprice' || h.includes('selling') || h.includes('sell') || (h.includes('price') && !h.includes('cost') && !h.includes('total')));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'expirydate' || cleanCol === 'expiry' || cleanCol === 'expire' || cleanCol.includes('expiry') || cleanCol.includes('expire')) {
    const idx = cleanHeaders.findIndex(h => h === 'expirydate' || h.includes('expiry') || h.includes('expire'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'totalprice' || cleanCol === 'total' || cleanCol.includes('total') || cleanCol.includes('revenue') || cleanCol.includes('amount')) {
    const idx = cleanHeaders.findIndex(h => h === 'totalprice' || h.includes('total') || h.includes('revenue') || h.includes('amount'));
    if (idx !== -1) return idx;
  }
  if (cleanCol === 'date' || cleanCol.includes('date') || cleanCol.includes('time')) {
    const idx = cleanHeaders.findIndex(h => h === 'date' || h.includes('date') || h.includes('time'));
    if (idx !== -1) return idx;
  }
  
  // Fallback direct matching
  const exactIdx = cleanHeaders.indexOf(cleanCol);
  if (exactIdx !== -1) return exactIdx;
  
  // Fallback fuzzy matching
  return cleanHeaders.findIndex(h => h.includes(cleanCol) || cleanCol.includes(h));
}

// Generate default mock database data relative to the current date
function generateMockData() {
  const today = new Date();
  const formatDate = (daysAgo) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Expiry dates are absolute dates relative to today for demonstration
  const expiryDate = (daysFromNow) => {
    const d = new Date(today);
    d.setDate(today.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  };

  return {
    inventory: [
      ["Item name", "Quantity", "Units", "Cost price", "Selling price", "Expiry date"],
      ["Organic Honey", "45", "jars", "6.50", "12.00", expiryDate(90)],
      ["Almond Milk 1L", "8", "cartons", "1.80", "3.50", expiryDate(4)], // Perishable, expiring in 4 days (Red alert <7d)
      ["Whole Wheat Bread", "15", "loaves", "1.20", "2.50", expiryDate(14)], // Perishable, expiring in 14 days (Amber alert <30d)
      ["Greek Yogurt 500g", "25", "tubs", "2.20", "4.80", expiryDate(2)], // Perishable, expiring in 2 days (Red alert <7d)
      ["Extra Virgin Olive Oil", "50", "bottles", "8.00", "16.99", ""], // Non-perishable (expiry is blank)
      ["Premium Dark Chocolate", "5", "bars", "1.50", "3.20", expiryDate(28)], // Low stock (5 < 10) & Amber alert
      ["Quinoa 1kg", "30", "bags", "3.00", "6.50", ""], // Non-perishable
      ["Avocado Oil 500ml", "12", "bottles", "5.50", "11.50", expiryDate(120)],
      ["Gluten-Free Oats 1kg", "3", "bags", "2.50", "5.00", expiryDate(15)], // Low stock (3 < 10) & Amber alert
      ["Matcha Green Tea Powder", "18", "tins", "12.00", "24.50", expiryDate(45)]
    ],
    sales: [
      ["Item name", "Quantity", "Units", "Total price", "Date"],
      ["Organic Honey", "2", "jars", "24.00", formatDate(0)],
      ["Almond Milk 1L", "4", "cartons", "14.00", formatDate(0)],
      ["Whole Wheat Bread", "5", "loaves", "12.50", formatDate(1)],
      ["Greek Yogurt 500g", "10", "tubs", "48.00", formatDate(1)],
      ["Organic Honey", "1", "jars", "12.00", formatDate(2)],
      ["Extra Virgin Olive Oil", "2", "bottles", "33.98", formatDate(2)],
      ["Premium Dark Chocolate", "10", "bars", "32.00", formatDate(3)],
      ["Almond Milk 1L", "3", "cartons", "10.50", formatDate(4)],
      ["Greek Yogurt 500g", "5", "tubs", "24.00", formatDate(4)],
      ["Quinoa 1kg", "4", "bags", "26.00", formatDate(5)],
      ["Organic Honey", "3", "jars", "36.00", formatDate(6)],
      ["Extra Virgin Olive Oil", "1", "bottles", "16.99", formatDate(6)],
      ["Premium Dark Chocolate", "2", "bars", "6.40", formatDate(6)]
    ],
    credits: [
      ["User name ", "Contact no", "Adrdress", "Credit amount", "Date"],
      ["A", "8", "", "48", formatDate(0)],
      ["B", "7", "", "78", formatDate(0)],
      ["A", "5", "", "345", formatDate(1)],
      ["A", "74", "", "34", formatDate(1)],
      ["C", "4", "", "34", formatDate(2)],
      ["C", "6", "", "67", formatDate(2)],
      ["D", "7", "", "97", formatDate(3)],
      ["A", "6", "", "34", formatDate(4)],
      ["C", "5", "", "44", formatDate(4)],
      ["B", "66", "", "43", formatDate(5)],
      ["D", "6", "", "455", formatDate(6)],
      ["D", "7", "", "455", formatDate(6)]
    ]
  };
}

// Read mock database
function readMockDb() {
  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading mock database:", err);
  }
  const defaultData = generateMockData();
  writeMockDb(defaultData);
  return defaultData;
}

// Write mock database
function writeMockDb(data) {
  try {
    const dir = path.dirname(MOCK_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing mock database:", err);
  }
}

// Initialize sheets client
function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  // Extract Spreadsheet ID from Google Sheets URL if full URL is pasted
  if (spreadsheetId && spreadsheetId.includes('/d/')) {
    const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      spreadsheetId = match[1];
    }
  }

  if (process.env.USE_MOCK_DATA === 'true' || !email || !privateKey || !spreadsheetId) {
    return { isMock: true, spreadsheetId: 'mock-spreadsheet-id' };
  }

  try {
    // Format private key correctly (replace literal \n with actual newlines)
    let cleanPrivateKey = privateKey.trim();
    if (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) {
      cleanPrivateKey = cleanPrivateKey.slice(1, -1);
    }
    const formattedPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');

    const client = new google.auth.JWT({
      email: email,
      key: formattedPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth: client });
    return { sheets, spreadsheetId, isMock: false };
  } catch (err) {
    console.error("Failed to initialize Google Sheets client. Falling back to mock data.", err);
    return { isMock: true, spreadsheetId: 'mock-spreadsheet-id' };
  }
}

// Exportable functions
async function fetchSheetData() {
  const client = getSheetsClient();

  if (client.isMock) {
    const data = readMockDb();
    return {
      inventory: data.inventory,
      sales: data.sales,
      credits: data.credits || [],
      isMock: true,
      spreadsheetId: client.spreadsheetId
    };
  }

  try {
    // Attempt to load 'Inventory' and 'Sales / Transactions' (fallback to 'Sales')
    // We fetch sheet metadata first to identify available tab names
    const metadata = await client.sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId
    });

    const sheetNames = metadata.data.sheets.map(s => s.properties.title);
    const inventoryTab = sheetNames.find(name => {
      const low = name.toLowerCase().trim();
      return low === 'inventory' || low.includes('stock');
    }) || 'Inventory';
    
    const salesTab = sheetNames.find(name => {
      const low = name.toLowerCase().trim();
      return low === 'sales' || 
             low === 'sales / transactions' || 
             low.includes('transaction') || 
             low.includes('sale') || 
             low.includes('history') || 
             low.includes('ledger') || 
             low.includes('order');
    }) || 'Sales / Transactions';

    const creditsTab = sheetNames.find(name => {
      const low = name.toLowerCase().trim();
      return low.includes('credit') && low.includes('log');
    }) || sheetNames.find(name => name.toLowerCase().trim().includes('credit')) || 'Credits log page';

    const ranges = [`${inventoryTab}!A1:Z1000`, `${salesTab}!A1:Z2000`, `${creditsTab}!A1:Z1000`];
    const response = await client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: client.spreadsheetId,
      ranges
    });

    const inventoryData = response.data.valueRanges[0].values || [];
    const salesData = response.data.valueRanges[1].values || [];
    const creditsData = (response.data.valueRanges[2] && response.data.valueRanges[2].values) || [];

    return {
      inventory: inventoryData,
      sales: salesData,
      credits: creditsData,
      isMock: false,
      spreadsheetId: client.spreadsheetId,
      inventoryTab,
      salesTab,
      creditsTab
    };
  } catch (err) {
    console.error("Error fetching Google Sheets data. Falling back to mock data.", err);
    const data = readMockDb();
    return {
      inventory: data.inventory,
      sales: data.sales,
      credits: data.credits || [],
      isMock: true,
      spreadsheetId: client.spreadsheetId,
      error: err.message
    };
  }
}

async function saveSheetChanges(updates) {
  const client = getSheetsClient();

  if (client.isMock) {
    const data = readMockDb();
    
    // Apply updates in-memory
    updates.forEach(up => {
      let targetTab;
      if (up.tab.toLowerCase().includes('inventory')) {
        targetTab = 'inventory';
      } else if (up.tab.toLowerCase().includes('sales')) {
        targetTab = 'sales';
      } else if (up.tab.toLowerCase().includes('credit')) {
        targetTab = 'credits';
      } else {
        targetTab = 'inventory';
      }
      const targetTable = data[targetTab] || [];
      
      // Determine the column index from header row
      const headers = targetTable[0];
      if (!headers) return;
      const colIndex = findHeaderIndex(headers, up.colName);
      
      if (colIndex !== -1 && targetTable[up.row - 1]) {
        const existingRow = targetTable[up.row - 1];
        const existingValue = String(existingRow[colIndex] || '').trim();
        let finalValue = up.value;
        if (existingValue !== '') {
          if (finalValue === null || finalValue === undefined || String(finalValue).trim() === '') {
            finalValue = existingValue;
          }
        }
        targetTable[up.row - 1][colIndex] = String(finalValue);
      }
    });

    writeMockDb(data);
    return { success: true, count: updates.length, isMock: true };
  }

  try {
    // For real sheets, first fetch data to determine correct columns and get current values
    const dataResult = await fetchSheetData();
    const invTab = dataResult.inventoryTab || 'Inventory';
    const salTab = dataResult.salesTab || 'Sales / Transactions';
    const credTab = dataResult.creditsTab || 'Credits view pge';
    
    const invHeaders = dataResult.inventory[0] || [];
    const salHeaders = dataResult.sales[0] || [];
    const credHeaders = dataResult.credits[0] || [];

    const valueRanges = updates.map(up => {
      let actualTab, headers, rows;
      if (up.tab.toLowerCase().includes('inventory')) {
        actualTab = invTab;
        headers = invHeaders;
        rows = dataResult.inventory;
      } else if (up.tab.toLowerCase().includes('sales')) {
        actualTab = salTab;
        headers = salHeaders;
        rows = dataResult.sales;
      } else if (up.tab.toLowerCase().includes('credit')) {
        actualTab = credTab;
        headers = credHeaders;
        rows = dataResult.credits;
      } else {
        throw new Error(`Unknown tab "${up.tab}"`);
      }

      const colIndex = findHeaderIndex(headers, up.colName);
      if (colIndex === -1) {
        throw new Error(`Column "${up.colName}" not found in tab "${actualTab}"`);
      }

      // Preserve existing non-empty value if the new value is empty/null/undefined
      let finalValue = up.value;
      const existingRow = rows[up.row - 1];
      if (existingRow && colIndex < existingRow.length) {
        const existingValue = String(existingRow[colIndex] || '').trim();
        if (existingValue !== '') {
          if (finalValue === null || finalValue === undefined || String(finalValue).trim() === '') {
            finalValue = existingValue;
          }
        }
      }

      const colLetter = colIndexToLetter(colIndex);
      const range = `${actualTab}!${colLetter}${up.row}`;

      return {
        range,
        values: [[finalValue]]
      };
    });

    await client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: client.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: valueRanges
      }
    });

    return { success: true, count: updates.length, isMock: false };
  } catch (err) {
    console.error("Error saving changes to Google Sheets:", err);
    throw new Error(err.message);
  }
}

async function appendSheetRow(tab, rowData) {
  const client = getSheetsClient();

  if (client.isMock) {
    const data = readMockDb();
    let targetTab;
    if (tab.toLowerCase().includes('inventory')) {
      targetTab = 'inventory';
    } else if (tab.toLowerCase().includes('sales')) {
      targetTab = 'sales';
    } else if (tab.toLowerCase().includes('credit')) {
      targetTab = 'credits';
    } else {
      targetTab = 'inventory';
    }
    const targetTable = data[targetTab] || [];
    const headers = targetTable[0] || [];
    
    const isInv = tab.toLowerCase().includes('inventory');
    const isCredits = tab.toLowerCase().includes('credit');
    
    let existingRowIndex = -1;
    let existingItemRow = null;
    
    let nameColIndex = -1;
    let inputName = '';
    if (isInv) {
      nameColIndex = findHeaderIndex(headers, "Item name");
      inputName = String(rowData["Item name"] || rowData["name"] || "").trim().toLowerCase();
    } else if (isCredits) {
      nameColIndex = findHeaderIndex(headers, "User name");
      inputName = String(rowData["User name "] || rowData["User name"] || rowData["name"] || "").trim().toLowerCase();
    }
    
    if (nameColIndex !== -1 && inputName) {
      for (let i = 1; i < targetTable.length; i++) {
        const row = targetTable[i];
        if (row && row[nameColIndex] && String(row[nameColIndex]).trim().toLowerCase() === inputName) {
          existingRowIndex = i; // 0-based index in targetTable
          existingItemRow = row;
          break;
        }
      }
    }
    
    const rowValues = headers.map((h, colIndex) => {
      const matchingKey = Object.keys(rowData).find(
        key => findHeaderIndex(headers, key) === colIndex
      );
      let value = matchingKey !== undefined ? rowData[matchingKey] : '';
      
      if (existingItemRow && colIndex < existingItemRow.length) {
        const existingValue = String(existingItemRow[colIndex] || '').trim();
        if (existingValue !== '' && String(value).trim() === '') {
          value = existingValue;
        }
      }
      return String(value);
    });
    
    if (existingRowIndex !== -1) {
      targetTable[existingRowIndex] = rowValues;
    } else {
      targetTable.push(rowValues);
    }
    
    writeMockDb(data);
    return { success: true, isMock: true };
  }

  try {
    const dataResult = await fetchSheetData();
    const invTab = dataResult.inventoryTab || 'Inventory';
    const salTab = dataResult.salesTab || 'Sales / Transactions';
    const credTab = dataResult.creditsTab || 'Credits view pge';
    
    const isInv = tab.toLowerCase().includes('inventory');
    const isSales = tab.toLowerCase().includes('sales');
    const isCredits = tab.toLowerCase().includes('credit');
    
    const actualTab = isInv ? invTab : (isSales ? salTab : credTab);
    const headers = isInv ? (dataResult.inventory[0] || []) : (isSales ? (dataResult.sales[0] || []) : (dataResult.credits[0] || []));

    let existingRowIndex = -1;
    let existingItemRow = null;
    
    let nameColIndex = -1;
    let inputName = '';
    
    if (isInv) {
      nameColIndex = findHeaderIndex(headers, "Item name");
      inputName = String(rowData["Item name"] || rowData["name"] || "").trim().toLowerCase();
    } else if (isCredits) {
      nameColIndex = findHeaderIndex(headers, "User name");
      inputName = String(rowData["User name "] || rowData["User name"] || rowData["name"] || "").trim().toLowerCase();
    }
    
    if (nameColIndex !== -1 && inputName) {
      const rows = isInv ? dataResult.inventory : (isSales ? dataResult.sales : dataResult.credits);
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row[nameColIndex] && String(row[nameColIndex]).trim().toLowerCase() === inputName) {
          existingRowIndex = i + 1; // 1-indexed row number
          existingItemRow = row;
          break;
        }
      }
    }

    const rowValues = headers.map((h, colIndex) => {
      const matchingKey = Object.keys(rowData).find(
        key => findHeaderIndex(headers, key) === colIndex
      );
      let value = matchingKey !== undefined ? rowData[matchingKey] : '';
      
      if (existingItemRow && colIndex < existingItemRow.length) {
        const existingValue = String(existingItemRow[colIndex] || '').trim();
        if (existingValue !== '' && String(value).trim() === '') {
          value = existingValue;
        }
      }
      return String(value);
    });

    if (existingRowIndex !== -1) {
      // Update existing row in place instead of appending a duplicate
      const colLetter = colIndexToLetter(headers.length - 1);
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: client.spreadsheetId,
        range: `${actualTab}!A${existingRowIndex}:${colLetter}${existingRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues]
        }
      });
      return { success: true, isMock: false, updatedRow: existingRowIndex };
    } else {
      // Append new row
      await client.sheets.spreadsheets.values.append({
        spreadsheetId: client.spreadsheetId,
        range: `${actualTab}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues]
        }
      });
      return { success: true, isMock: false };
    }
  } catch (err) {
    console.error("Error appending row to Google Sheets:", err);
    throw new Error(err.message);
  }
}

module.exports = {
  fetchSheetData,
  saveSheetChanges,
  appendSheetRow
};
