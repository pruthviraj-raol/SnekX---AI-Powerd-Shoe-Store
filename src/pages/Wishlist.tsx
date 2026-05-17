import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ArrowRight } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import ProductCard from "@/components/ProductCard";
import { useWishlist } from "@/context/WishlistContext";

const Wishlist = () => {
  const { items, isLoading } = useWishlist();

  if (isLoading && items.length === 0) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading your wishlist...</div>
      </UserLayout>
    );
  }

  if (items.length === 0) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Your Wishlist is Empty</h1>
          <p className="text-muted-foreground mb-6">Save shoes you love for later.</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl"
          >
            Browse Shoes <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl font-bold mb-8">
          Wishlist <span className="text-muted-foreground text-lg font-normal">({items.length})</span>
        </h1>
        <AnimatePresence>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {items.map((product, index) => (
              <motion.div key={product.id} layout exit={{ opacity: 0, scale: 0.9 }}>
                <ProductCard product={product} index={index} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>
    </UserLayout>
  );
};

export default Wishlist;
