const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const BLOGGER_EMAIL = process.env.BLOGGER_EMAIL;
    const BLOGGER_PASSWORD = process.env.BLOGGER_PASSWORD;

    let role = null;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      role = "admin";
    } else if (email === BLOGGER_EMAIL && password === BLOGGER_PASSWORD) {
      role = "blogger";
    } else {
      console.log("❌ Invalid login attempt:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { email, role, userId: role === "admin" ? "admin-1" : "blogger-1" },
      process.env.JWT_SECRET || "skyup-default-secret-change-in-production",
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );

    console.log("✅ User logged in successfully:", email);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: { email, role },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

const verify = (req, res) => {
  res.json({ valid: true, user: req.user });
};

const logout = (req, res) => {
  console.log("✅ User logged out:", req.user.email);
  res.json({ message: "Logged out successfully" });
};

module.exports = { login, verify, logout };