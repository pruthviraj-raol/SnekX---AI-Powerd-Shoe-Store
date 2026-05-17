/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { normalizeCartItem } from "@/lib/shop";
import type { CartApiItem, CartItem, Product } from "@/types/shop";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, size?: number | null, quantity?: number) => Promise<void>;
  removeItem: (productId: string, size?: number | null) => Promise<void>;
  updateQuantity: (productId: string, size: number | null, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<CartItem[]>;
  totalItems: number;
  totalPrice: number;
  couponCode: string;
  setCouponCode: (code: string) => void;
  discount: number;
  applyCoupon: () => void;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const mapCartItems = (items: CartApiItem[]) => items.map(normalizeCartItem);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const requireToken = () => {
    if (!token) {
      throw new Error("Please sign in to use your cart.");
    }

    return token;
  };

  const refreshCart = async () => {
    if (!token) {
      setItems([]);
      return [];
    }

    setIsLoading(true);

    try {
      const response = await apiRequest<{ success: boolean; cart: CartApiItem[] }>("/api/cart", {
        method: "GET",
        token,
      });

      const nextItems = mapCartItems(response.cart);
      setItems(nextItems);
      return nextItems;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !token) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    refreshCart().catch(() => {
      setItems([]);
    });
  }, [authLoading, isAuthenticated, token]);

  const addItem = async (product: Product, size?: number | null, quantity = 1) => {
    const authToken = requireToken();
    const selectedSize = size ?? product.sizes[0] ?? null;

    const response = await apiRequest<{ success: boolean; cart: CartApiItem[] }>("/api/cart/add", {
      method: "POST",
      body: {
        productId: product.id,
        quantity,
        size: selectedSize,
      },
      token: authToken,
    });

    setItems(mapCartItems(response.cart));
  };

  const removeItem = async (productId: string, size?: number | null) => {
    const authToken = requireToken();

    const response = await apiRequest<{ success: boolean; cart: CartApiItem[] }>("/api/cart/remove", {
      method: "DELETE",
      body: {
        productId,
        size,
      },
      token: authToken,
    });

    setItems(mapCartItems(response.cart));
  };

  const updateQuantity = async (productId: string, size: number | null, quantity: number) => {
    const currentItem = items.find((item) => item.productId === productId && item.size === size);

    if (!currentItem) {
      return;
    }

    if (quantity <= 0) {
      await removeItem(productId, size);
      return;
    }

    if (quantity === currentItem.quantity) {
      return;
    }

    if (quantity > currentItem.quantity) {
      await addItem(currentItem.product, size, quantity - currentItem.quantity);
      return;
    }

    await removeItem(productId, size);
    await addItem(currentItem.product, size, quantity);
  };

  const clearCart = async () => {
    const currentItems = [...items];

    for (const item of currentItems) {
      await removeItem(item.productId, item.size);
    }

    setItems([]);
  };

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [items]);

  const applyCoupon = () => {
    if (couponCode.toUpperCase() === "SNEKX20") {
      setDiscount(20);
    } else if (couponCode.toUpperCase() === "SNEKX10") {
      setDiscount(10);
    } else {
      setDiscount(0);
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        refreshCart,
        totalItems,
        totalPrice,
        couponCode,
        setCouponCode,
        discount,
        applyCoupon,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
};
