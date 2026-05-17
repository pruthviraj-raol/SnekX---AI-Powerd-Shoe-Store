import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Truck, CheckCircle, MapPin, Clock, XCircle } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatAddressLine } from "@/lib/shop";
import type { Order } from "@/types/shop";

const statusBadge: Record<Order["orderStatus"], string> = {
  Processing: "bg-accent/10 text-accent",
  Shipped: "bg-primary/10 text-primary",
  Completed: "bg-primary/10 text-primary",
  Cancelled: "bg-destructive/10 text-destructive",
};

const OrderTracking = () => {
  const { orderId } = useParams();
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    const loadOrders = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; orders: Order[] }>("/api/orders/my-orders", {
          method: "GET",
          token,
        });

        setOrders(response.orders);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load your order tracking details."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrders();
  }, [token]);

  const order = useMemo(
    () => orders.find((item) => item.id === orderId || item.orderNumber === orderId) || null,
    [orderId, orders]
  );

  const trackingSteps = useMemo(() => {
    if (!order) {
      return [];
    }

    const createdAt = new Date(order.createdAt);
    const updatedAt = new Date(order.updatedAt || order.createdAt);
    const labelDate = (value: Date) =>
      value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    const labelDateTime = (value: Date) =>
      value.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    const currentIndex =
      order.orderStatus === "Completed" ? 3 : order.orderStatus === "Shipped" ? 2 : 1;

    return [
      {
        id: 1,
        label: "Order Placed",
        description: "Your order has been confirmed and queued for fulfillment.",
        date: labelDateTime(createdAt),
        icon: Package,
        done: true,
        active: false,
      },
      {
        id: 2,
        label: "Processing",
        description:
          order.orderStatus === "Cancelled"
            ? "This order was cancelled before shipment."
            : "We are preparing your sneakers for shipment.",
        date: labelDateTime(updatedAt),
        icon: Clock,
        done: currentIndex > 1,
        active: currentIndex === 1,
      },
      {
        id: 3,
        label: "Shipped",
        description: "Your package has left our warehouse.",
        date:
          order.orderStatus === "Shipped" || order.orderStatus === "Completed"
            ? labelDateTime(updatedAt)
            : `Expected after ${labelDate(createdAt)}`,
        icon: Truck,
        done: currentIndex > 2,
        active: currentIndex === 2,
      },
      {
        id: 4,
        label: "Delivered",
        description:
          order.orderStatus === "Completed"
            ? "Your order has been delivered successfully."
            : "Delivery confirmation will appear here once completed.",
        date: order.orderStatus === "Completed" ? labelDateTime(updatedAt) : "Pending",
        icon: CheckCircle,
        done: currentIndex > 3,
        active: currentIndex === 3,
      },
    ];
  }, [order]);

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {isLoading ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
              Loading order tracking...
            </div>
          ) : error ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
              {error}
            </div>
          ) : !order ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
              Order not found.
            </div>
          ) : (
            <>
              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <h1 className="font-heading text-2xl font-bold">Order Tracking</h1>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusBadge[order.orderStatus]}`}>
                    {order.orderStatus}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
              </div>

              {order.orderStatus === "Cancelled" && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 mb-6 flex gap-3">
                  <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">This order was cancelled.</p>
                    <p className="text-xs text-muted-foreground">
                      If you need help with a replacement or refund, please contact support.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <h2 className="font-heading font-semibold mb-4">Items in this Order</h2>
                <div className="space-y-3">
                  {order.products.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover bg-secondary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size ? `Size ${item.size} - ` : ""}Qty {item.quantity}
                        </p>
                      </div>
                      <span className="font-heading font-semibold text-sm">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h2 className="font-heading font-semibold">Shipping Address</h2>
                </div>
                <p className="text-sm font-medium">{order.addressId.fullName}</p>
                <p className="text-sm text-muted-foreground">{formatAddressLine(order.addressId)}</p>
                <p className="text-sm text-muted-foreground">{order.addressId.phone}</p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-heading font-semibold mb-6">Tracking Timeline</h2>
                <div className="relative">
                  {trackingSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isLast = index === trackingSteps.length - 1;

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex gap-4 relative"
                      >
                        {!isLast && (
                          <div className="absolute left-5 top-10 w-0.5 h-full -translate-x-1/2">
                            <div className={`w-full h-full ${step.done ? "bg-primary" : "bg-border"}`} />
                          </div>
                        )}

                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 ${
                            step.done
                              ? "bg-primary text-primary-foreground"
                              : step.active
                                ? "bg-primary/20 text-primary animate-pulse-glow"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className={`pb-8 ${!step.done && !step.active ? "opacity-50" : ""}`}>
                          <p className="font-heading font-semibold text-sm">{step.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{step.date}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </UserLayout>
  );
};

export default OrderTracking;
