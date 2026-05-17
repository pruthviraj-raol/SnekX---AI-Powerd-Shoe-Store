export interface ProductReview {
  user: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  type: string;
  description: string;
  price: number;
  originalPrice: number | null;
  sizes: number[];
  color: string;
  colors: string[];
  stock: number;
  image: string;
  images: string[];
  rating: number;
  numReviews: number;
  reviews: ProductReview[];
  tags: string[];
  isNew: boolean;
  isTrending: boolean;
  matchScore?: number;
  matchPercentage?: number;
  isAlternative?: boolean;
  matchSummary?: string;
  matchReasons?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OutfitPaletteColor {
  color: string;
  share: number;
  rgb?: {
    r: number;
    g: number;
    b: number;
  };
}

export interface OutfitAnalysis {
  clothingType: string;
  style: string;
  category: string;
  allowedTypes: string[];
  dominantColor: string;
  palette: OutfitPaletteColor[];
  neutralShare: number;
  recommendedShoeColors: string[];
  reasoning: string[];
  rgb: {
    r: number;
    g: number;
    b: number;
  } | null;
}

export interface OutfitRecommendationResponse {
  success: boolean;
  message: string;
  clothingType: string;
  color: string;
  detectedColor: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  } | null;
  analysis: OutfitAnalysis | null;
  products: Product[];
  fallback: boolean;
}

export interface CartApiItem {
  id: string;
  productId: Product;
  quantity: number;
  price: number;
  size: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistApiItem {
  id: string;
  productId: Product | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
  size: number | null;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderProduct {
  productId: string;
  name: string;
  brand: string;
  image: string;
  quantity: number;
  price: number;
  size: number | null;
  color: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?:
    | string
    | {
        id?: string;
        _id?: string;
        name: string;
        email: string;
      };
  products: OrderProduct[];
  totalAmount: number;
  orderStatus: "Processing" | "Shipped" | "Completed" | "Cancelled";
  paymentStatus: "Pending" | "Paid" | "Failed" | "Refunded";
  addressId: Address;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "banned";
  createdAt: string;
  updatedAt?: string;
  totalOrders: number;
  totalSpent: number;
}

export interface ChatQuery {
  id: string;
  userId?:
    | string
    | {
        id?: string;
        _id?: string;
        name?: string;
        email?: string;
      }
    | null;
  message: string;
  response: string;
  timestamp: string;
  type?: "contact" | "chatbot";
}

export interface ContactQuery {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  type?: "contact" | "chatbot";
  adminReply?: string;
  repliedAt?: string | null;
  resolvedAt?: string | null;
  handledBy?: {
    userId?: string;
    name?: string;
    email?: string;
  };
}


