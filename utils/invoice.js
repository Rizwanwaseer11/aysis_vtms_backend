/**
 * Invoice generation in MongoDB.
 * We create invoice sequence per operation per monthKey (YYYY-MM).
 * This prevents collisions and keeps invoices stable.
 */
const InvoiceCounter = require("../models/InvoiceCounter");

function monthKeyFromDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function padInvoice(n) {
  return String(n).padStart(3, "0"); // 001
}

async function nextInvoice(operationType, monthKey) {
  const mk = monthKey || monthKeyFromDate(new Date());

  const doc = await InvoiceCounter.findOneAndUpdate(
    { operationType, monthKey: mk },
    { $inc: { lastNo: 1 } },
    { new: true, upsert: true }
  );

  return { invoiceNo: padInvoice(doc.lastNo), monthKey: mk };
}

module.exports = { nextInvoice, monthKeyFromDate };
