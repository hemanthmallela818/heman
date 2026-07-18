/**
 * Utility to normalize date strings from multiple formats (e.g. DD/MM/YYYY, YYYY-MM-DD)
 * to a standardized YYYY-MM-DD format.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  let val = dateStr.trim();

  // 1. Matches DD/MM/YYYY or DD-MM-YYYY
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const dmyMatch = val.match(dmyRegex);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 2. Matches YYYY/MM/DD
  const ymdSlashRegex = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;
  const ymdMatch = val.match(ymdSlashRegex);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback to standard JavaScript parsing if valid
  try {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (err) {
    // Ignore and return raw
  }

  return val;
}

/**
 * Utility to safely parse numerical inputs, stripping currencies/commas
 */
function parseNumber(val, defaultValue = 0) {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'number') return val;
  
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Utility to safely convert cells to string, filtering out literal 'undefined' or 'null' values
 */
function safeString(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  return str === 'undefined' || str === 'null' ? fallback : str;
}


/**
 * Helper to match header column index dynamically based on common keywords
 */
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

/**
 * Processes raw Google Sheet arrays and derives analytics metrics
 */
function processStoreData(rawInventory = [], rawSales = [], rawCredits = [], lowStockThreshold = 10) {
  if (rawInventory.length === 0) {
    return {
      inventory: [],
      sales: [],
      credits: [],
      kpis: {
        totalStockValue: 0,
        totalPotentialRevenue: 0,
        totalItemsTracked: 0,
        lowStockCount: 0,
        averageProfitMargin: 0,
        totalCreditsAmount: 0,
        totalCreditsCustomers: 0
      },
      revenueTrend: [],
      bestSellers: []
    };
  }

  // 1. Process Inventory
  const invHeaders = rawInventory[0].map(h => String(h).toLowerCase().trim());
  const idxInvName = findHeaderIndex(invHeaders, "item name");
  const idxInvQty = findHeaderIndex(invHeaders, "quantity");
  const idxInvUnits = findHeaderIndex(invHeaders, "units");
  const idxInvCost = findHeaderIndex(invHeaders, "cost price");
  const idxInvSell = findHeaderIndex(invHeaders, "selling price");
  const idxInvExpiry = findHeaderIndex(invHeaders, "expiry date");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inventoryItems = [];
  const inventoryMap = new Map(); // For quick lookup when merging sales

  for (let i = 1; i < rawInventory.length; i++) {
    const row = rawInventory[i];
    // Skip completely empty rows
    if (!row || row.length === 0 || !row[idxInvName]) continue;

    const name = safeString(row[idxInvName]);
    const qty = parseNumber(row[idxInvQty], 0);
    const units = idxInvUnits !== -1 ? safeString(row[idxInvUnits], 'units') : 'units';
    const cost = parseNumber(row[idxInvCost], 0);
    const sell = parseNumber(row[idxInvSell], 0);
    const rawExpiry = idxInvExpiry !== -1 ? safeString(row[idxInvExpiry]) : '';
    const expiry = normalizeDate(rawExpiry);

    // Calculate Margin: (Selling - Cost) / Cost
    const margin = cost > 0 ? (sell - cost) / cost : 0;

    // Calculate Expiry Status
    let expiryStatus = 'non-perishable';
    let daysToExpiry = null;
    if (expiry) {
      const expiryDateObj = new Date(expiry);
      if (!isNaN(expiryDateObj.getTime())) {
        const diffTime = expiryDateObj.getTime() - today.getTime();
        daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 7) {
          expiryStatus = 'expired-soon-7'; // High alert
        } else if (daysToExpiry <= 30) {
          expiryStatus = 'expired-soon-30'; // Warning alert
        } else {
          expiryStatus = 'safe';
        }
      }
    }

    const item = {
      row: i + 1, // 1-indexed row in sheet (headers are row 1)
      name,
      quantity: qty,
      units,
      costPrice: cost,
      sellingPrice: sell,
      expiryDate: expiry,
      expiryStatus,
      daysToExpiry,
      profitMargin: margin,
      salesQuantity: 0,
      salesRevenue: 0,
      transactions: []
    };

    inventoryItems.push(item);
    inventoryMap.set(name.toLowerCase(), item);
  }

  // 2. Process Sales Transactions
  const salesItems = [];
  const salesHeaders = rawSales[0] ? rawSales[0].map(h => String(h).toLowerCase().trim()) : [];
  const idxSalName = findHeaderIndex(salesHeaders, "item name");
  const idxSalQty = findHeaderIndex(salesHeaders, "quantity");
  const idxSalUnits = findHeaderIndex(salesHeaders, "units");
  const idxSalTotal = findHeaderIndex(salesHeaders, "total price");
  const idxSalDate = findHeaderIndex(salesHeaders, "date");

  for (let i = 1; i < rawSales.length; i++) {
    const row = rawSales[i];
    if (!row || row.length === 0 || !row[idxSalName]) continue;

    const name = safeString(row[idxSalName]);
    const qty = parseNumber(row[idxSalQty], 0);
    const units = idxSalUnits !== -1 ? safeString(row[idxSalUnits], 'units') : 'units';
    const total = parseNumber(row[idxSalTotal], 0);
    const rawDate = idxSalDate !== -1 ? safeString(row[idxSalDate]) : '';
    const date = normalizeDate(rawDate);

    const transaction = {
      row: i + 1,
      name,
      quantity: qty,
      units,
      totalPrice: total,
      date
    };

    salesItems.push(transaction);

    // Link Sales Transaction to Inventory Item
    const linkedItem = inventoryMap.get(name.toLowerCase());
    if (linkedItem) {
      linkedItem.salesQuantity += qty;
      linkedItem.salesRevenue += total;
      linkedItem.transactions.push(transaction);
    }
  }

  // 3. Compute KPI Metrics
  let totalStockValue = 0;
  let totalPotentialRevenue = 0;
  let lowStockCount = 0;
  let totalMarginSum = 0;
  let itemsWithMarginCount = 0;

  inventoryItems.forEach(item => {
    totalStockValue += item.quantity * item.costPrice;
    totalPotentialRevenue += item.quantity * item.sellingPrice;
    if (item.quantity < lowStockThreshold) {
      lowStockCount++;
    }
    if (item.costPrice > 0) {
      totalMarginSum += item.profitMargin;
      itemsWithMarginCount++;
    }
  });

  const averageProfitMargin = itemsWithMarginCount > 0 ? totalMarginSum / itemsWithMarginCount : 0;

  // 3b. Calculate Today's Profit & Revenue
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let todaysRevenue = 0;
  let todaysProfit = 0;

  salesItems.forEach(s => {
    if (s.date === todayYmd) {
      todaysRevenue += s.totalPrice;
      const linkedItem = inventoryMap.get(s.name.toLowerCase());
      if (linkedItem) {
        todaysProfit += s.totalPrice - (s.quantity * linkedItem.costPrice);
      } else {
        todaysProfit += s.totalPrice;
      }
    }
  });

  // 4. Aggregate Revenue Trend (Group by Date)
  const trendMap = new Map();
  salesItems.forEach(s => {
    if (!s.date) return;
    const current = trendMap.get(s.date) || 0;
    trendMap.set(s.date, current + s.totalPrice);
  });

  const revenueTrend = Array.from(trendMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 5. Aggregate Best-Sellers (Group by Item Name)
  const sellerMap = new Map();
  salesItems.forEach(s => {
    const key = s.name.trim();
    const current = sellerMap.get(key) || { quantity: 0, revenue: 0 };
    current.quantity += s.quantity;
    current.revenue += s.totalPrice;
    sellerMap.set(key, current);
  });

  const bestSellers = Array.from(sellerMap.entries()).map(([name, data]) => {
    const linkedItem = inventoryMap.get(name.toLowerCase());
    const cost = linkedItem ? linkedItem.costPrice : 0;
    const profit = linkedItem ? (data.revenue - (data.quantity * cost)) : 0;

    return {
      name,
      quantity: data.quantity,
      revenue: parseFloat(data.revenue.toFixed(2)),
      profit: parseFloat(profit.toFixed(2))
    };
  });

  // 6. Process Credits Logs & Balances
  const creditsLogs = [];
  const aggregatedCreditsMap = new Map();
  let totalCreditsAmount = 0;
  
  if (rawCredits && rawCredits.length > 0) {
    const credHeaders = rawCredits[0].map(h => String(h).toLowerCase().trim());
    const idxCredName = findHeaderIndex(credHeaders, "user name");
    const idxCredContact = findHeaderIndex(credHeaders, "contact");
    const idxCredAddress = findHeaderIndex(credHeaders, "address");
    const idxCredAmount = findHeaderIndex(credHeaders, "credit amount");
    const idxCredDate = findHeaderIndex(credHeaders, "date");
    
    for (let i = 1; i < rawCredits.length; i++) {
      const row = rawCredits[i];
      if (!row || row.length === 0 || !row[idxCredName]) continue;
      
      const name = safeString(row[idxCredName]);
      const contact = idxCredContact !== -1 ? safeString(row[idxCredContact]) : '';
      const address = idxCredAddress !== -1 ? safeString(row[idxCredAddress]) : '';
      const amount = parseNumber(row[idxCredAmount], 0);
      const date = idxCredDate !== -1 ? normalizeDate(safeString(row[idxCredDate])) : '';
      
      creditsLogs.push({
        row: i + 1,
        name,
        contact,
        address,
        creditAmount: amount,
        date
      });
      
      const nameLower = name.toLowerCase().trim();
      if (aggregatedCreditsMap.has(nameLower)) {
        const existing = aggregatedCreditsMap.get(nameLower);
        existing.creditAmount += amount;
        if (!existing.contact && contact) existing.contact = contact;
        if (!existing.address && address) existing.address = address;
        existing.rows.push(i + 1);
      } else {
        aggregatedCreditsMap.set(nameLower, {
          name,
          contact,
          address,
          creditAmount: amount,
          rows: [i + 1]
        });
      }
    }
  }

  const creditsAggregated = Array.from(aggregatedCreditsMap.values()).map((c, index) => {
    totalCreditsAmount += c.creditAmount;
    return {
      id: index + 1,
      name: c.name,
      contact: c.contact,
      address: c.address,
      creditAmount: c.creditAmount,
      rows: c.rows
    };
  });

  return {
    inventory: inventoryItems,
    sales: salesItems,
    credits: creditsAggregated,
    creditsLogs: creditsLogs,
    kpis: {
      totalStockValue: parseFloat(totalStockValue.toFixed(2)),
      totalPotentialRevenue: parseFloat(totalPotentialRevenue.toFixed(2)),
      totalItemsTracked: inventoryItems.length,
      lowStockCount,
      averageProfitMargin: parseFloat(averageProfitMargin.toFixed(4)), // E.g. 0.4532 (45.32%)
      todaysRevenue: parseFloat(todaysRevenue.toFixed(2)),
      todaysProfit: parseFloat(todaysProfit.toFixed(2)),
      totalCreditsAmount: parseFloat(totalCreditsAmount.toFixed(2)),
      totalCreditsCustomers: creditsAggregated.length
    },
    revenueTrend,
    bestSellers
  };
}

module.exports = {
  normalizeDate,
  processStoreData
};
