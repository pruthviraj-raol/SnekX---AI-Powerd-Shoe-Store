const Address = require("../models/Address");
const asyncHandler = require("../middleware/asyncHandler");

const getAddressId = (req) =>
  req.body.addressId ||
  req.body.id ||
  req.query.addressId ||
  req.query.id;

const addAddress = asyncHandler(async (req, res) => {
  const { fullName, phone, street, city, state, postalCode, country } = req.body;

  if (!fullName || !phone || !street || !city || !state || !postalCode || !country) {
    res.status(400);
    throw new Error("All address fields are required.");
  }

  const address = await Address.create({
    userId: req.user._id,
    fullName,
    phone,
    street,
    city,
    state,
    postalCode,
    country,
  });

  res.status(201).json({
    success: true,
    message: "Address added successfully.",
    address,
  });
});

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ userId: req.user._id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    count: addresses.length,
    addresses,
  });
});

const updateAddress = asyncHandler(async (req, res) => {
  const addressId = getAddressId(req);
  if (!addressId) {
    res.status(400);
    throw new Error("addressId is required.");
  }

  const address = await Address.findOneAndUpdate(
    { _id: addressId, userId: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!address) {
    res.status(404);
    throw new Error("Address not found.");
  }

  res.json({
    success: true,
    message: "Address updated successfully.",
    address,
  });
});

const deleteAddress = asyncHandler(async (req, res) => {
  const addressId = getAddressId(req);
  if (!addressId) {
    res.status(400);
    throw new Error("addressId is required.");
  }

  const deleted = await Address.findOneAndDelete({
    _id: addressId,
    userId: req.user._id,
  });

  if (!deleted) {
    res.status(404);
    throw new Error("Address not found.");
  }

  res.json({
    success: true,
    message: "Address deleted successfully.",
  });
});

module.exports = {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
};
