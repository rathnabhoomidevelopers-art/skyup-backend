const express = require("express");
const router = express.Router();
const { addContact, getContacts } = require("../controllers/contactController");
const { authenticateToken } = require("../middleware/auth");

router.post("/add-contact", addContact);
router.get("/contacts", authenticateToken, getContacts);

module.exports = router;