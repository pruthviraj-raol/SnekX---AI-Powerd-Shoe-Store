import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Search, Eye, X, Package, MapPin, CreditCard, User } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatAddressLine } from "@/lib/shop";
import type { Order } from "@/types/shop";

type AdminOrder = Order & {
  userId?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
  };
};

const statusStyle: Record<string, string> = {
  Completed: "text-primary bg-primary/10",
  Processing: "text-accent bg-accent/10",
  Shipped: "text-blue-400 bg-blue-400/10",
  Cancelled: "text-destructive bg-destructive/10",
};

const AdminOrders = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [orderList, setOrderList] = useState<AdminOrder[]>([]);
  const [viewOrder, setViewOrder] = useState<AdminOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const loadOrders = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; orders: AdminOrder[] }>("/api/orders/all", {
          method: "GET",
          token,
        });

        setOrderList(response.orders);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load orders."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrders();
  }, [token]);

  const filtered = orderList.filter((order) => {
    const customerName = order.userId?.name || "";
    const matchSearch =
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || order.orderStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!token) {
      toast.error("Admin authentication is required.");
      return;
    }

    try {
      setIsUpdating(true);
      const response = await apiRequest<{ success: boolean; order: AdminOrder }>("/api/orders/status", {
        method: "PUT",
        body: {
          orderId,
          orderStatus: newStatus,
        },
        token,
      });

      setOrderList((prev) => prev.map((order) => (order.id === orderId ? { ...order, orderStatus: response.order.orderStatus } : order)));
      setViewOrder((prev) => (prev && prev.id === orderId ? { ...prev, orderStatus: response.order.orderStatus } : prev));
      toast.success(`Order updated to ${newStatus}`);
    } catch (updateError) {
      toast.error(getApiErrorMessage(updateError, "Unable to update order status."));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminLayout title="Order Management">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="bg-secondary rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {["All", "Processing", "Shipped", "Completed", "Cancelled"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading orders...</div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">{error}</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.userId?.name || "Guest"}</p>
                      <p className="text-xs text-muted-foreground">{order.userId?.email || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{order.products.length}</td>
                    <td className="px-4 py-3 font-semibold">₹{order.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={order.orderStatus}
                        onChange={(e) => void updateStatus(order.id, e.target.value)}
                        disabled={isUpdating}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold outline-none cursor-pointer ${statusStyle[order.orderStatus]} bg-transparent disabled:opacity-60`}
                      >
                        {["Processing", "Shipped", "Completed", "Cancelled"].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setViewOrder(order)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setViewOrder(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-heading text-lg font-semibold">{viewOrder.orderNumber}</h2>
                  <p className="text-xs text-muted-foreground">
                    {new Date(viewOrder.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <button onClick={() => setViewOrder(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-primary" /> <span className="font-medium">{viewOrder.userId?.name || "Guest"}</span></div>
                <p className="text-xs text-muted-foreground pl-6">{viewOrder.userId?.email || "-"}</p>
                <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" /> <span className="text-muted-foreground text-xs">{formatAddressLine(viewOrder.addressId)}</span></div>
                <div className="flex items-center gap-2 text-sm"><CreditCard className="w-4 h-4 text-primary" /> <span className="text-xs text-muted-foreground">Payment: {viewOrder.paymentStatus}</span></div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[viewOrder.orderStatus]}`}>{viewOrder.orderStatus}</span>
              </div>

              <div className="space-y-3 mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Items ({viewOrder.products.length})</h3>
                {viewOrder.products.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3">
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Size: {item.size || "-"} • Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-heading font-semibold">Total</span>
                <span className="font-heading font-bold text-lg">₹{viewOrder.totalAmount.toFixed(2)}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default AdminOrders;
