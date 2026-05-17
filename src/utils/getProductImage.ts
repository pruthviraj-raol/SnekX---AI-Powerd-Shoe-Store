import type { Product } from "@/types/shop";

export const PRODUCT_IMAGE_PLACEHOLDER = "/placeholder.png";

type ProductImageSource = Pick<Product, "image" | "images"> | null | undefined;

const getNormalizedImages = (product: ProductImageSource) =>
  Array.isArray(product?.images)
    ? product.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
    : [];

export const getProductImage = (product: ProductImageSource) => {
  const images = getNormalizedImages(product);
  const fallbackImage = typeof product?.image === "string" && product.image.trim().length > 0 ? product.image : "";
  const resolvedImage = images[0] || fallbackImage || PRODUCT_IMAGE_PLACEHOLDER;
  return resolvedImage;
};

export const getProductImageGallery = (product: ProductImageSource) => {
  const images = getNormalizedImages(product);
  const fallbackImage = typeof product?.image === "string" && product.image.trim().length > 0 ? product.image : "";

  return images.length ? images : fallbackImage ? [fallbackImage] : [PRODUCT_IMAGE_PLACEHOLDER];
};
