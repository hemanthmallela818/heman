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
  const lowCol = String(colName).toLowerCase().trim();
  const lowHeaders = headers.map(h => String(h).toLowerCase().trim());
  
  if (lowCol === 'item name') {
    return lowHeaders.findIndex(h => h === 'item name' || h.includes('name'));
  }
  if (lowCol === 'quantity') {
    return lowHeaders.findIndex(h => h === 'quantity' || h.includes('quantity') || h.includes('qty') || h.includes('stock') || h.includes('count'));
  }
  if (lowCol === 'units') {
    return lowHeaders.findIndex(h => h === 'units' || h.includes('unit'));
  }
  if (lowCol === 'cost price') {
    return lowHeaders.findIndex(h => h === 'cost price' || h.includes('cost') || h.includes('buy') || h.includes('purchase'));
  }
  if (lowCol === 'selling price') {
    return lowHeaders.findIndex(h => h === 'selling price' || h.includes('selling') || h.includes('sell') || h.includes('price') && !h.includes('cost'));
  }
  if (lowCol === 'expiry date') {
    return lowHeaders.findIndex(h => h === 'expiry date' || h.includes('expiry') || h.includes('expire'));
  }
  if (lowCol === 'total price') {
    return lowHeaders.findIndex(h => h === 'total price' || h.includes('total') || h.includes('revenue') || h.includes('amount'));
  }
  if (lowCol === 'date') {
    return lowHeaders.findIndex(h => h === 'date' || h.includes('date') || h.includes('time'));
  }
  
  return lowHeaders.indexOf(lowCol);
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

    const ranges = [`${inventoryTab}!A1:Z1000`, `${salesTab}!A1:Z2000`];
    const response = await client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: client.spreadsheetId,
      ranges
    });

    const inventoryData = response.data.valueRanges[0].values || [];
    const salesData = response.data.valueRanges[1].values || [];

    return {
      inventory: inventoryData,
      sales: salesData,
      isMock: false,
      spreadsheetId: client.spreadsheetId,
      inventoryTab,
      salesTab
    };
  } catch (err) {
    console.error("Error fetching Google Sheets data. Falling back to mock data.", err);
    const data = readMockDb();
    return {
      inventory: data.inventory,
      sales: data.sales,
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
      const targetTab = up.tab.toLowerCase().includes('inventory') ? 'inventory' : 'sales';
      const targetTable = data[targetTab];
      
      // Determine the column index from header row
      const headers = targetTable[0];
      const colIndex = findHeaderIndex(headers, up.colName);
      
      if (colIndex !== -1 && targetTable[up.row - 1]) {
        targetTable[up.row - 1][colIndex] = String(up.value);
      }
    });

    writeMockDb(data);
    return { success: true, count: updates.length, isMock: true };
  }

  try {
    // For real sheets, first fetch headers to determine correct columns dynamically
    const dataResult = await fetchSheetData();
    const invTab = dataResult.inventoryTab || 'Inventory';
    const salTab = dataResult.salesTab || 'Sales / Transactions';
    
    const invHeaders = dataResult.inventory[0] || [];
    const salHeaders = dataResult.sales[0] || [];

    const valueRanges = updates.map(up => {
      const isInv = up.tab.toLowerCase().includes('inventory');
      const actualTab = isInv ? invTab : salTab;
      const headers = isInv ? invHeaders : salHeaders;

      const colIndex = findHeaderIndex(headers, up.colName);
      if (colIndex === -1) {
        throw new Error(`Column "${up.colName}" not found in tab "${actualTab}"`);
      }

      const colLetter = colIndexToLetter(colIndex);
      const range = `${actualTab}!${colLetter}${up.row}`;

      return {
        range,
        values: [[up.value]]
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

module.exports = {
  fetchSheetData,
  saveSheetChanges
};
