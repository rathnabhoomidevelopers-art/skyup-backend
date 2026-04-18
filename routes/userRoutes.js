const express = require("express");
const router = express.Router();
const { resumeUploadMiddleware, uploadResume, addUser, getUsers } = require("../controllers/userController");
const { authenticateToken } = require("../middleware/auth");

router.post("/resume", resumeUploadMiddleware, uploadResume);
router.post("/add-users", addUser);
router.get("/users", authenticateToken, getUsers);

module.exports = router;