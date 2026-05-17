/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { normalizeWishlistProducts } from "@/lib/shop";
import type { Product, WishlistApiItem } from "@/types/shop";

interface WishlistContextType {
  items: Product[];
  addItem: (product: Product) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  refreshWishlist: () => Promise<Product[]>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const requireToken = () => {
    if (!token) {
      throw new Error("Please sign in to use your wishlist.");
    }

    return token;
  };

  const refreshWishlist = async () => {
    if (!token) {
      setItems([]);
      return [];
    }

    setIsLoading(true);

    try {
      const response = await apiRequest<{ success: boolean; wishlist: WishlistApiItem[] }>("/api/wishlist", {
        method: "GET",
        token,
      });

      const nextItems = normalizeWishlistProducts(response.wishlist);
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

    refreshWishlist().catch(() => {
      setItems([]);
    });
  }, [authLoading, isAuthenticated, token]);

  const addItem = async (product: Product) => {
    const authToken = requireToken();

    const response = await apiRequest<{ success: boolean; wishlist: WishlistApiItem[] }>("/api/wishlist/add", {
      method: "POST",
      body: { productId: product.id },
      token: authToken,
    });

    setItems(normalizeWishlistProducts(response.wishlist));
  };

  const removeItem = async (productId: string) => {
    const authToken = requireToken();

    const response = await apiRequest<{ success: boolean; wishlist: WishlistApiItem[] }>("/api/wishlist/remove", {
      method: "DELETE",
      body: { productId },
      token: authToken,
    });

    setItems(normalizeWishlistProducts(response.wishlist));
  };

  const isInWishlist = (productId: string) => items.some((item) => item.id === productId);

  const toggleWishlist = async (product: Product) => {
    if (isInWishlist(product.id)) {
      await removeItem(product.id);
    } else {
      await addItem(product);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        isInWishlist,
        toggleWishlist,
        refreshWishlist,
        isLoading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }

  return context;
};
