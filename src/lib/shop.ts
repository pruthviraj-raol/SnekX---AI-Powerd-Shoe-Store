import { resolveApiUrl } from "@/lib/api";
import type { Address, CartApiItem, CartItem, Product, WishlistApiItem } from "@/types/shop";

const isAbsoluteUrl = (value: string) => /^(https?:|data:|blob:)/.test(value);

export const resolveMediaUrl = (value: string | undefined | null) => {
  if (!value) {
    return "";
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return resolveApiUrl(value);
  }

  return resolveApiUrl(`/${value}`);
};

export const normalizeProduct = (product: Product): Product => {
  const images = (product.images || []).filter(Boolean).map(resolveMediaUrl);
  const primaryImage = resolveMediaUrl(product.image) || images[0] || "";
  const normalizedReviews = Array.isArray((product as Product & { reviews?: unknown }).reviews)
    ? product.reviews.map((review) => ({
        ...review,
        user: String(review.user),
        name: review.name?.trim() || "Anonymous",
        rating: Number(review.rating) || 0,
        comment: review.comment?.trim() || "",
        createdAt: review.createdAt || new Date(0).toISOString(),
      }))
    : [];

  return {
    ...product,
    originalPrice: product.originalPrice ?? null,
    type: product.type || "lifestyle",
    colors: product.colors?.length ? product.colors : product.color ? [product.color] : [],
    image: primaryImage,
    images: images.length ? images : primaryImage ? [primaryImage] : [],
    sizes: product.sizes || [],
    rating: Number(product.rating) || 0,
    numReviews: typeof product.numReviews === "number" ? product.numReviews : normalizedReviews.length,
    reviews: normalizedReviews,
    tags: product.tags || [],
    isNew: Boolean(product.isNew),
    isTrending: Boolean(product.isTrending),
    matchScore: typeof product.matchScore === "number" ? product.matchScore : undefined,
    matchPercentage: typeof product.matchPercentage === "number" ? product.matchPercentage : undefined,
    isAlternative: Boolean(product.isAlternative),
    matchSummary: typeof product.matchSummary === "string" ? product.matchSummary : undefined,
    matchReasons: Array.isArray(product.matchReasons)
      ? product.matchReasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0)
      : undefined,
  };
};

export const normalizeCartItem = (item: CartApiItem): CartItem => {
  const product = normalizeProduct(item.productId);

  return {
    id: item.id,
    productId: product.id,
    product,
    quantity: item.quantity,
    price: item.price,
    size: item.size ?? null,
  };
};

const hasWishlistProduct = (item: WishlistApiItem): item is WishlistApiItem & { productId: Product } => Boolean(item.productId);

export const normalizeWishlistProducts = (items: WishlistApiItem[]) =>
  items.filter(hasWishlistProduct).map((item) => normalizeProduct(item.productId));

export const normalizeAddress = (address: Address): Address => ({
  ...address,
  fullName: address.fullName.trim(),
  phone: address.phone.trim(),
  street: address.street.trim(),
  city: address.city.trim(),
  state: address.state.trim(),
  postalCode: address.postalCode.trim(),
  country: address.country.trim(),
});

export const formatAddressLine = (address: Address) =>
  `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;

