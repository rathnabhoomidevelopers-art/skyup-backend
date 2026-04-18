const { getDb } = require("../config/db");
const { buildUserDocument } = require("../models/userModel");
const { upload, uploadToCloudinary } = require("../config/cloudinary");

const resumeUploadMiddleware = upload.single("file");

const uploadResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    return res.json({
      message: "Uploaded successfully",
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      originalname: req.file.originalname,
    });
  } catch (err) {
    console.error("Resume upload error:", err);
    return res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

const addUser = async (req, res) => {
  try {
    const db = getDb();
    const userDoc = buildUserDocument(req.body);
    await db.collection("jobs").insertOne(userDoc);
    console.log("✅ User applied successfully");
    res.json({ message: "Applied successfully" });
  } catch (err) {
    console.error("❌ Add user error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const db = getDb();
    const document = await db.collection("jobs").find({}).toArray();
    console.log(`✅ Fetched ${document.length} users by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get users error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
};

module.exports = { resumeUploadMiddleware, uploadResume, addUser, getUsers };