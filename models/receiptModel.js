// Receipt / Invoice Model
// Defines the shape of a receipt document stored in the "receipt" collection.

function getCurrentFinancialYear() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  return m >= 4
    ? `${y}-${(y + 1).toString().slice(-2)}`
    : `${y - 1}-${y.toString().slice(-2)}`;
}

function safeParseNumber(value, defaultValue = 0) {
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function buildReceiptDocument(body, invoiceNumber, createdByEmail) {
  return {
    to: body.to,
    client_gst: body.client_gst || "URD",
    invoice_no: invoiceNumber,
    date: new Date(body.date),
    invoice_due: body.invoice_due ? new Date(body.invoice_due) : null,
    hsn_no: body.hsn_no,
    items: body.items || [],
    subtotal: safeParseNumber(body.subtotal),
    amount_in_words: body.amount_in_words,
    cgst: safeParseNumber(body.cgst),
    sgst: safeParseNumber(body.sgst),
    igst: safeParseNumber(body.igst),
    cgst_percentage: safeParseNumber(body.cgst_percentage),
    sgst_percentage: safeParseNumber(body.sgst_percentage),
    igst_percentage: safeParseNumber(body.igst_percentage),
    total: safeParseNumber(body.total),
    createdBy: createdByEmail,
    createdAt: new Date(),
  };
}

function buildReceiptUpdateFields(body, updatedByEmail) {
  return {
    to: body.to,
    client_gst: body.client_gst || "URD",
    date: new Date(body.date),
    invoice_due: body.invoice_due ? new Date(body.invoice_due) : null,
    hsn_no: body.hsn_no || "",
    items: body.items || [],
    subtotal: safeParseNumber(body.subtotal),
    amount_in_words: body.amount_in_words,
    cgst: safeParseNumber(body.cgst),
    sgst: safeParseNumber(body.sgst),
    igst: safeParseNumber(body.igst),
    cgst_percentage: safeParseNumber(body.cgst_percentage),
    sgst_percentage: safeParseNumber(body.sgst_percentage),
    igst_percentage: safeParseNumber(body.igst_percentage),
    total: safeParseNumber(body.total),
    updatedBy: updatedByEmail,
    updatedAt: new Date(),
  };
}

module.exports = {
  getCurrentFinancialYear,
  safeParseNumber,
  buildReceiptDocument,
  buildReceiptUpdateFields,
};