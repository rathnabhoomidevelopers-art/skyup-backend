const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const {
  getCurrentFinancialYear,
  buildReceiptDocument,
  buildReceiptUpdateFields,
} = require("../models/receiptModel");

// GET /api/last-invoice — get last invoice serial for current FY (protected)
const getLastInvoice = async (req, res) => {
  try {
    const db = getDb();
    const currentFY = getCurrentFinancialYear();
    const currentYearReceipts = await db
      .collection("receipt")
      .find({ invoice_no: { $regex: currentFY } })
      .toArray();

    if (currentYearReceipts.length === 0) return res.json({ lastSerial: 0 });

    const serials = currentYearReceipts.map((r) => {
      const match = r.invoice_no?.match(/SDS\/(\d+)\//);
      return match ? parseInt(match[1], 10) : 0;
    });

    res.json({ lastSerial: Math.max(...serials) });
  } catch (err) {
    console.error("❌ Error fetching last invoice:", err);
    res.status(500).json({ lastSerial: 0, error: err.message });
  }
};

// POST /receipt — create receipt (protected)
const createReceipt = async (req, res) => {
  try {
    const db = getDb();
    const receiptsCollection = db.collection("receipt");
    const financialYear = getCurrentFinancialYear();

    const currentYearReceipts = await receiptsCollection
      .find({ invoice_no: { $regex: financialYear } })
      .toArray();

    let nextInvoiceSerial = 1;
    if (currentYearReceipts.length > 0) {
      const serials = currentYearReceipts.map((r) => {
        const match = r.invoice_no?.match(/SDS\/(\d+)\//);
        return match ? parseInt(match[1], 10) : 0;
      });
      nextInvoiceSerial = Math.max(...serials) + 1;
    }

    const paddedSerial = String(nextInvoiceSerial).padStart(3, "0");
    const invoiceNumber = `SDS/${paddedSerial}/${financialYear}`;

    const receiptDoc = buildReceiptDocument(req.body, invoiceNumber, req.user.email);
    console.log("📝 Receipt data to be saved:", JSON.stringify(receiptDoc, null, 2));

    await receiptsCollection.insertOne(receiptDoc);
    console.log(`✅ Receipt submitted successfully by ${req.user.email}`);
    res.json({ message: "Receipt submitted successfully", invoice_no: invoiceNumber });
  } catch (err) {
    console.error("❌ Receipt error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

// GET /receipts — get all receipts (protected)
const getReceipts = async (req, res) => {
  try {
    const db = getDb();
    const document = await db.collection("receipt").find({}).toArray();
    console.log(`✅ Fetched ${document.length} receipts by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get receipts error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

// PUT /receipt/:id — update receipt (protected)
const updateReceipt = async (req, res) => {
  try {
    const db = getDb();
    const updatedFields = buildReceiptUpdateFields(req.body, req.user.email);

    const result = await db
      .collection("receipt")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updatedFields });

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    console.log(`✅ Receipt ${req.params.id} updated by ${req.user.email}`);
    res.json({ message: "Receipt updated successfully" });
  } catch (err) {
    console.error("❌ Update receipt error:", err);
    res.status(500).json({ message: "Failed to update receipt", error: err.message });
  }
};

// DELETE /receipt/:id — delete receipt (protected)
const deleteReceipt = async (req, res) => {
  try {
    const db = getDb();
    const result = await db
      .collection("receipt")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    console.log(`✅ Receipt ${req.params.id} deleted by ${req.user.email}`);
    res.json({ message: "Receipt deleted successfully" });
  } catch (err) {
    console.error("❌ Delete receipt error:", err);
    res.status(500).json({ message: "Failed to delete receipt", error: err.message });
  }
};

module.exports = { getLastInvoice, createReceipt, getReceipts, updateReceipt, deleteReceipt };