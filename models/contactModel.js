function buildContactDocument(body) {
  return {
    name: (body.name || "").trim(),
    email: (body.email || "").trim(),
    mobile: String(body.mobile || "").replace(/\D/g, ""), // keep as string
    subject: body.subject || "",
    message: body.message || "",
    createdAt: new Date(),
  };
}

module.exports = { buildContactDocument };
