const ContactQuery = require("../models/ContactQuery");
const asyncHandler = require("../middleware/asyncHandler");

const createContactQuery = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    res.status(400);
    throw new Error("name, email, subject, and message are required.");
  }

  const contactQuery = await ContactQuery.create({
    name,
    email,
    subject,
    message,
  });

  res.status(201).json({
    success: true,
    message: "Contact message submitted successfully.",
    query: contactQuery,
  });
});

module.exports = {
  createContactQuery,
};
