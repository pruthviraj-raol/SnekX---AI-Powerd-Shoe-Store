import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import type { Product } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

const ProductCard = ({ product, index = 0 }: { product: Product; index?: number }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const liked = isInWishlist(product.id);
  const [cartBounce, setCartBounce] = useState(false);
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const [isSubmittingWishlist, setIsSubmittingWishlist] = useState(false);
  const isOnSale = Boolean(product.originalPrice && product.originalPrice > product.price);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      setIsSubmittingCart(true);
      await addItem(product, product.sizes[0] ?? null);
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 600);
      toast.success(`${product.name} added to cart`, {
        description: `${product.sizes[0] ? `Size ${product.sizes[0]} - ` : ""}₹${product.price.toFixed(2)}`,
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to add this item to your cart."));
    } finally {
      setIsSubmittingCart(false);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      setIsSubmittingWishlist(true);
      const wasLiked = isInWishlist(product.id);
      await toggleWishlist(product);
      if (wasLiked) {
        toast("Removed from wishlist", { description: product.name });
      } else {
        toast.success("Added to wishlist", { description: product.name });
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your wishlist."));
    } finally {
      setIsSubmittingWishlist(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="group relative bg-card rounded-xl overflow-hidden border border-border"
    >
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        {product.isNew && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: index * 0.05 + 0.2 }}
            className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary text-primary-foreground rounded-full"
          >
            New
          </motion.span>
        )}
      </div>

      <motion.button
        onClick={handleToggleWishlist}
        whileTap={{ scale: 0.8 }}
        disabled={isSubmittingWishlist}
        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors disabled:opacity-60"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={liked ? "liked" : "not-liked"}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.5 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Heart
              className={`w-4 h-4 transition-colors ${liked ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </motion.div>
        </AnimatePresence>
      </motion.button>

      <Link to={`/product/${product.id}`}>
        <div className="aspect-square overflow-hidden bg-secondary/30">
          <img
            src={getProductImage(product)}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
            }}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        </div>
      </Link>

      <div className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{product.brand}</p>
        <Link to={`/product/${product.id}`}>
          <h3 className="font-heading font-semibold text-sm mb-2 hover:text-primary transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-3 h-3 fill-primary text-primary" />
          <span className="text-xs text-muted-foreground">
            {product.rating.toFixed(1)} ({product.numReviews})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold">₹{product.price.toFixed(2)}</span>
            {isOnSale && (
              <span className="text-sm text-muted-foreground line-through">₹{product.originalPrice!.toFixed(2)}</span>
            )}
          </div>
          <motion.button
            onClick={handleAddToCart}
            whileTap={{ scale: 0.85 }}
            animate={cartBounce ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            disabled={isSubmittingCart}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <ShoppingBag className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;

