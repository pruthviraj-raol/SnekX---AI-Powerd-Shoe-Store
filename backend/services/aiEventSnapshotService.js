const trimSnapshotValue = (value = "") => String(value || "").trim();

const buildAIEventProductSnapshot = (product = {}) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const image = trimSnapshotValue(product.image) || trimSnapshotValue(images[0]);

  return {
    name: trimSnapshotValue(product.name),
    brand: trimSnapshotValue(product.brand),
    category: trimSnapshotValue(product.category).toLowerCase(),
    image,
  };
};

const hasAIEventProductSnapshot = (snapshot = {}) =>
  Boolean(
    trimSnapshotValue(snapshot?.name) ||
      trimSnapshotValue(snapshot?.brand) ||
      trimSnapshotValue(snapshot?.category) ||
      trimSnapshotValue(snapshot?.image)
  );

module.exports = {
  buildAIEventProductSnapshot,
  hasAIEventProductSnapshot,
};

