import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, X, ArrowRight, ShoppingBag, Tag } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

const Cart = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    totalPrice,
    couponCode,
    setCouponCode,
    discount,
    applyCoupon,
    clearCart,
    isLoading,
  } = useCart();

  const discountAmount = (totalPrice * discount) / 100;
  const finalPrice = totalPrice - discountAmount;

  const handleRemoveItem = async (productId: string, size: number | null, name: string) => {
    try {
      await removeItem(productId, size);
      toast("Item removed", { description: name });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to remove this item."));
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast("Cart cleared", { description: "All items have been removed." });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to clear your cart."));
    }
  };

  const handleApplyCoupon = () => {
    applyCoupon();
    if (couponCode.toUpperCase() === "SNEKX20" || couponCode.toUpperCase() === "SNEKX10") {
      toast.success("Coupon applied!", {
        description: `You saved ${couponCode.toUpperCase() === "SNEKX20" ? "20%" : "10%"} on your order.`,
      });
    } else if (couponCode) {
      toast.error("Invalid coupon", { description: "Please check the code and try again." });
    }
  };

  const handleQuantityChange = async (productId: string, size: number | null, quantity: number) => {
    try {
      await updateQuantity(productId, size, quantity);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update this quantity."));
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading your cart...</div>
      </UserLayout>
    );
  }

  if (items.length === 0) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          </motion.div>
          <h1 className="font-heading text-2xl font-bold mb-2">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">Looks like you haven't added any shoes yet.</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl"
          >
            Start Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-heading text-3xl font-bold">Shopping Cart</h1>
          <motion.button
            onClick={handleClearCart}
            whileTap={{ scale: 0.95 }}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear All
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={`${item.product.id}-${item.size ?? "default"}`}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex gap-4 p-4 bg-card rounded-xl border border-border"
                >
                  <Link to={`/product/${item.product.id}`} className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-secondary">
                    <img src={getProductImage(item.product)} alt={item.product.name} onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{item.product.brand}</p>
                        <h3 className="font-heading font-semibold text-sm">{item.product.name}</h3>
                        {item.size && <p className="text-xs text-muted-foreground mt-0.5">Size: {item.size}</p>}
                      </div>
                      <motion.button
                        onClick={() => handleRemoveItem(item.product.id, item.size, item.product.name)}
                        whileTap={{ scale: 0.8, rotate: 90 }}
                        className="p-1 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </motion.button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => handleQuantityChange(item.product.id, item.size, item.quantity - 1)}
                          whileTap={{ scale: 0.85 }}
                          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </motion.button>
                        <motion.span
                          key={item.quantity}
                          initial={{ scale: 1.3 }}
                          animate={{ scale: 1 }}
                          className="text-sm font-semibold w-6 text-center"
                        >
                          {item.quantity}
                        </motion.span>
                        <motion.button
                          onClick={() => handleQuantityChange(item.product.id, item.size, item.quantity + 1)}
                          whileTap={{ scale: 0.85 }}
                          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </motion.button>
                      </div>
                      <span className="font-heading font-bold">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6 h-fit sticky top-24 space-y-4"
          >
            <h2 className="font-heading text-lg font-bold">Order Summary</h2>

            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-secondary rounded-lg px-3">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <motion.button
                onClick={handleApplyCoupon}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-secondary text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Apply
              </motion.button>
            </div>
            <AnimatePresence>
              {discount > 0 && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-primary font-medium"
                >
                  {discount}% discount applied!
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-2 pt-2 border-t border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{totalPrice.toFixed(2)}</span>
              </div>
              <AnimatePresence>
                {discount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex justify-between text-primary"
                  >
                    <span>Discount ({discount}%)</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-primary text-xs font-medium">FREE</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border text-lg font-heading font-bold">
                <span>Total</span>
                <motion.span key={finalPrice} initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
                  ₹{finalPrice.toFixed(2)}
                </motion.span>
              </div>
            </div>

            <motion.div whileTap={{ scale: 0.98 }}>
              <Link
                to="/checkout"
                className="block w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 text-center"
              >
                Checkout
              </Link>
            </motion.div>
            <Link to="/products" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              Continue Shopping
            </Link>
          </motion.div>
        </div>
      </div>
    </UserLayout>
  );
};

export default Cart;

