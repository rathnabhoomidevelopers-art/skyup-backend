const { getDb } = require("../config/db");
const { buildContactDocument } = require("../models/contactModel");

const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;

const addContact = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name || !mobile) {
      return res.status(400).json({ message: "Name and mobile are required" });
    }

    const db = getDb();
    const contactDoc = buildContactDocument(req.body);
    await db.collection("contact").insertOne(contactDoc);
    console.log("✅ Contact submitted successfully");

    // Only attempt the CRM forward if a URL is configured
    if (CRM_WEBHOOK_URL) {
      fetch(CRM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_secret: process.env.CRM_WEBHOOK_SECRET,
          name: req.body.name || "Unknown",
          mobile: String(req.body.mobile || ""),
          email: req.body.email || "",
          message: "[Contact Page] " + (req.body.message || req.body.subject || ""),
        }),
      })
        .then((crmRes) => console.log("✅ Lead forwarded to CRM, status:", crmRes.status))
        .catch((crmErr) => console.error("⚠️ CRM webhook error:", crmErr.message));
    }

    res.json({ message: "Submitted successfully" });
  } catch (err) {
    console.error("❌ Add contact error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

const getContacts = async (req, res) => {
  try {
    const db = getDb();
    const document = await db.collection("contact").find({}).toArray();
    console.log(`✅ Fetched ${document.length} contacts by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get contacts error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

module.exports = { addContact, getContacts };
