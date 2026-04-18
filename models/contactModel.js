function buildContactDocument(body) {
  return {
    name: body.name,
    email: body.email,
    mobile: parseInt(body.mobile),
    subject: body.subject,
    message: body.message,
    createdAt: new Date(),
  };
}

module.exports = { buildContactDocument };