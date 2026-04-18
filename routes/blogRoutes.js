const express = require("express");
const router = express.Router();
const { uploadBlogImage, publishBlog } = require("../controllers/blogController");
const { authenticateToken } = require("../middleware/auth");

router.post("/api/upload-blog-image", authenticateToken, uploadBlogImage);
router.post("/api/publish-blog", authenticateToken, publishBlog);

module.exports = router;