import { useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, ShoppingBag, ArrowLeft, Truck, Shield, RotateCcw } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import ProductCard from "@/components/ProductCard";
import ProductSkeleton from "@/components/ui/ProductSkeleton";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { Product, ProductReview } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImageGallery } from "@/utils/getProductImage";

const ProductDetail = () => {
  const { id } = useParams();
  const { token, isAuthenticated, user } = useAuth();
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const [isSubmittingWishlist, setIsSubmittingWishlist] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const refreshProduct = async (productId: string) => {
    const productResponse = await apiRequest<{ success: boolean; product: Product }>(`/api/products/${productId}`, {
      method: "GET",
      token,
    });

    const nextProduct = normalizeProduct(productResponse.product);
    const gallery = Array.isArray(nextProduct.images) && nextProduct.images.length > 0
      ? nextProduct.images
      : nextProduct.image
        ? [nextProduct.image]
        : [];
    setProduct(nextProduct);
    setSelectedImage((previous) => Math.min(previous, Math.max(gallery.length - 1, 0)));
    setSelectedSize((previous) => (previous !== null && nextProduct.sizes.includes(previous) ? previous : nextProduct.sizes[0] ?? null));

    return nextProduct;
  };

  useEffect(() => {
    if (!id) {
      setError("Product not found.");
      setIsLoading(false);
      return;
    }

    const loadProduct = async () => {
      setIsLoading(true);
      setError("");

      try {
        const productResponse = await apiRequest<{ success: boolean; product: Product }>(`/api/products/${id}`, {
          method: "GET",
          token,
        });
        const nextProduct = normalizeProduct(productResponse.product);
        const gallery = Array.isArray(nextProduct.images) && nextProduct.images.length > 0
          ? nextProduct.images
          : nextProduct.image
            ? [nextProduct.image]
            : [];
        setProduct(nextProduct);
        setSelectedImage((previous) => Math.min(previous, Math.max(gallery.length - 1, 0)));
        setSelectedSize((previous) => (previous !== null && nextProduct.sizes.includes(previous) ? previous : nextProduct.sizes[0] ?? null));

        const relatedResponse = await apiRequest<{ success: boolean; products: Product[] }>(
          `/api/products?category=${encodeURIComponent(nextProduct.category)}`,
          {
            method: "GET",
            token,
          }
        );

        setSimilarProducts(
          relatedResponse.products
            .map(normalizeProduct)
            .filter((relatedProduct) => relatedProduct.id !== nextProduct.id)
            .slice(0, 4)
        );
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load this product right now."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadProduct();
  }, [id, token]);

  useEffect(() => {
    if (!product || !user) {
      setReviewRating(0);
      setReviewComment("");
      return;
    }

    const existingReview = product.reviews.find((review) => review.user === user.id);

    if (existingReview) {
      setReviewRating(existingReview.rating);
      setReviewComment(existingReview.comment);
      return;
    }

    setReviewRating(0);
    setReviewComment("");
  }, [product, user]);

  if (isLoading) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="aspect-square rounded-2xl bg-card shimmer" />
            <div className="space-y-5 py-4">
              <div className="h-4 w-24 rounded-full bg-muted shimmer" />
              <div className="h-10 w-4/5 rounded-xl bg-muted shimmer" />
              <div className="h-5 w-40 rounded-full bg-muted shimmer" />
              <div className="h-10 w-36 rounded-xl bg-muted shimmer" />
              <div className="h-24 rounded-xl bg-muted shimmer" />
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 w-12 rounded-xl bg-muted shimmer" />
                ))}
              </div>
              <div className="h-12 rounded-xl bg-muted shimmer" />
            </div>
          </div>
          <div className="mt-16">
            <ProductSkeleton count={4} />
          </div>
        </div>
      </UserLayout>
    );
  }

  if (error) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-heading text-2xl font-bold">{error || "Product not found"}</h1>
          <Link to="/products" className="text-primary hover:underline mt-4 inline-block">
            Back to Shop
          </Link>
        </div>
      </UserLayout>
    );
  }

  if (!product) return null;

  const liked = isInWishlist(product.id);
  const reviewCountLabel = product.numReviews === 1 ? "review" : "reviews";
  const existingReview = user ? product.reviews.find((review) => review.user === user.id) : null;
  const sortedReviews = [...product.reviews].sort(
    (firstReview, secondReview) => Number(new Date(secondReview.createdAt)) - Number(new Date(firstReview.createdAt))
  );
  const productGallery = getProductImageGallery(product);
  const mainImage = productGallery[selectedImage] || productGallery[0] || PRODUCT_IMAGE_PLACEHOLDER;

  const renderStars = (rating: number, sizeClassName = "w-4 h-4") =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={`${sizeClassName}-${rating}-${index}`}
        className={`${sizeClassName} ${index < Math.round(rating) ? "fill-primary text-primary" : "text-border"}`}
      />
    ));

  const handleAddToCart = async () => {
    const size = selectedSize ?? product.sizes[0] ?? null;

    try {
      setIsSubmittingCart(true);
      await addItem(product, size);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 1500);
      toast.success("Added to cart!", {
        description: `${product.name}${size ? ` - Size ${size}` : ""}`,
      });
    } catch (errorAddingToCart) {
      toast.error(getApiErrorMessage(errorAddingToCart, "Unable to add this product to your cart."));
    } finally {
      setIsSubmittingCart(false);
    }
  };

  const handleToggleWishlist = async () => {
    try {
      setIsSubmittingWishlist(true);
      const wasLiked = isInWishlist(product.id);
      await toggleWishlist(product);
      if (wasLiked) {
        toast("Removed from wishlist", { description: product.name });
      } else {
        toast.success("Added to wishlist", { description: product.name });
      }
    } catch (errorUpdatingWishlist) {
      toast.error(getApiErrorMessage(errorUpdatingWishlist, "Unable to update your wishlist."));
    } finally {
      setIsSubmittingWishlist(false);
    }
  };

  const handleReviewSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!id || !token) {
      toast.error("Please login to review");
      return;
    }

    if (!reviewRating) {
      toast.error("Please select a rating before submitting your review.");
      return;
    }

    if (!reviewComment.trim()) {
      toast.error("Please enter a comment before submitting your review.");
      return;
    }

    try {
      setIsSubmittingReview(true);
      const response = await apiRequest<{ success: boolean; message: string }>(`/api/products/${id}/reviews`, {
        method: "POST",
        token,
        body: {
          rating: reviewRating,
          comment: reviewComment.trim(),
        },
      });

      toast.success(response.message || "Review added successfully");
      await refreshProduct(id);
    } catch (reviewError) {
      toast.error(getApiErrorMessage(reviewError, "Unable to submit your review right now."));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Shop
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-card border border-border">
              <AnimatePresence mode="wait">
                <motion.img
                  key={mainImage}
                  src={mainImage}
                  alt={product?.name}
                  onError={(event) => {
                    event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                  }}
                  referrerPolicy="no-referrer"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                />
              </AnimatePresence>
            </div>
            <div className="flex gap-3">
              {productGallery.map((image, index) => (
                <motion.button
                  key={`${image}-${index}`}
                  onClick={() => setSelectedImage(index)}
                  whileTap={{ scale: 0.9 }}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                    selectedImage === index ? "border-primary" : "border-border"
                  }`}
                >
                  <img
                    src={image || PRODUCT_IMAGE_PLACEHOLDER}
                    alt={product?.name}
                    onError={(event) => {
                      event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                    }}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">{product.brand}</p>
              <h1 className="font-heading text-3xl md:text-4xl font-bold mt-1">{product.name}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">{renderStars(product.rating)}</div>
              <span className="text-sm text-muted-foreground">
                {product.rating.toFixed(1)} ({product.numReviews} {reviewCountLabel})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-heading text-3xl font-bold">₹{product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <>
                  <span className="text-xl text-muted-foreground line-through">₹{product.originalPrice.toFixed(2)}</span>
                  <span className="px-2 py-0.5 bg-accent text-accent-foreground text-xs font-bold rounded-full">
                    -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            <div>
              <h3 className="font-heading font-semibold text-sm mb-3">Select Size</h3>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <motion.button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ y: -2 }}
                    className={`w-12 h-12 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selectedSize === size
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {size}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={handleAddToCart}
                whileTap={{ scale: 0.95 }}
                animate={addedToCart ? { scale: [1, 1.05, 1] } : {}}
                disabled={isSubmittingCart}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/20 disabled:opacity-70 ${
                  addedToCart ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                <motion.div
                  animate={addedToCart ? { rotate: [0, -20, 20, 0], y: [0, -3, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <ShoppingBag className="w-5 h-5" />
                </motion.div>
                {addedToCart ? "Added!" : "Add to Cart"}
              </motion.button>
              <motion.button
                onClick={handleToggleWishlist}
                whileTap={{ scale: 0.85 }}
                disabled={isSubmittingWishlist}
                className={`p-3.5 rounded-xl border-2 transition-all disabled:opacity-70 ${
                  liked ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={liked ? "liked" : "not"}
                    initial={{ scale: 0.5, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0.5, rotate: 30 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  >
                    <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : ""}`} />
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              {[
                { icon: Truck, label: "Free Shipping" },
                { icon: Shield, label: "2 Year Warranty" },
                { icon: RotateCcw, label: "30 Day Returns" },
              ].map(({ icon: Icon, label }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-secondary/50"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <section className="mt-14 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-heading text-2xl font-bold">Ratings & Reviews</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {product.rating.toFixed(1)} out of 5 based on {product.numReviews} {reviewCountLabel}
                </p>
              </div>
              <div className="flex items-center gap-1">{renderStars(product.rating, "w-5 h-5")}</div>
            </div>

            {sortedReviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                No reviews yet. Be the first to review this product.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedReviews.map((review: ProductReview, index) => (
                  <div
                    key={`${review.user}-${review.createdAt}-${index}`}
                    className="rounded-xl border border-border bg-background/50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{review.name}</p>
                        <div className="flex items-center gap-1 mt-1">{renderStars(review.rating, "w-3.5 h-3.5")}</div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-heading text-2xl font-bold mb-2">{existingReview ? "Update Your Review" : "Write a Review"}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Share your experience with this pair to help other shoppers.
            </p>

            {!isAuthenticated ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Please login to review.{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in here
                </Link>
                .
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Your rating</label>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }, (_, index) => {
                      const value = index + 1;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-7 h-7 ${value <= reviewRating ? "fill-primary text-primary" : "text-border"}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-comment" className="block text-sm font-medium mb-2">
                    Your review
                  </label>
                  <textarea
                    id="review-comment"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    rows={5}
                    placeholder="Tell us what you liked, how the fit feels, or anything other shoppers should know."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {isSubmittingReview ? "Submitting Review..." : existingReview ? "Update Review" : "Submit Review"}
                </button>
              </form>
            )}
          </section>
        </section>

        {similarProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="font-heading text-2xl font-bold mb-6">You Might Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {similarProducts.map((similarProduct, index) => (
                <ProductCard key={similarProduct.id} product={similarProduct} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </UserLayout>
  );
};

export default ProductDetail;


