import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Search, Mail, X, ShoppingBag, Calendar, UserCheck, UserX, Eye } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { AdminUser, Order } from "@/types/shop";

type AdminOrder = Order & {
  userId?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
  };
};

const statusStyle: Record<string, string> = {
  active: "text-primary bg-primary/10",
  inactive: "text-muted-foreground bg-secondary",
  banned: "text-destructive bg-destructive/10",
};

const AdminUsers = () => {
  const { token, user: currentAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [userList, setUserList] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const loadUsers = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [usersResponse, ordersResponse] = await Promise.all([
          apiRequest<{ success: boolean; users: AdminUser[] }>("/api/admin/users", {
            method: "GET",
            token,
          }),
          apiRequest<{ success: boolean; orders: AdminOrder[] }>("/api/orders/all", {
            method: "GET",
            token,
          }),
        ]);

        setUserList(usersResponse.users);
        setOrders(ordersResponse.orders);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load users."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadUsers();
  }, [token]);

  const filtered = userList.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  const userRecentOrders = useMemo(() => {
    if (!viewUser) {
      return [];
    }

    return orders
      .filter((order) => {
        const userId = typeof order.userId === "string" ? order.userId : order.userId?.id || order.userId?._id;
        return userId === viewUser.id;
      })
      .slice(0, 5);
  }, [orders, viewUser]);

  const toggleUserStatus = async (userId: string) => {
    if (!token) {
      toast.error("Admin authentication is required.");
      return;
    }

    const currentUser = userList.find((user) => user.id === userId);
    if (!currentUser) {
      return;
    }

    const nextStatus = currentUser.status === "active" ? "inactive" : "active";

    try {
      setIsUpdating(true);
      const response = await apiRequest<{ success: boolean; user: AdminUser }>(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
        token,
      });

      setUserList((prev) => prev.map((user) => (user.id === userId ? { ...user, status: response.user.status } : user)));
      setViewUser((prev) => (prev && prev.id === userId ? { ...prev, status: response.user.status } : prev));
      toast.success(`${currentUser.name} has been ${nextStatus === "inactive" ? "deactivated" : "reactivated"}.`);
    } catch (updateError) {
      toast.error(getApiErrorMessage(updateError, "Unable to update user status."));
    } finally {
      setIsUpdating(false);
    }
  };

  const sendEmail = (user: AdminUser) => {
    window.location.href = `mailto:${user.email}`;
  };

  return (
    <AdminLayout title="User Management">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="bg-secondary rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary w-64"
          />
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} users</p>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading users...</div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">{error}</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Orders</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Total Spent</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Joined</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const initials = user.name
                    .split(/\s+/)
                    .map((part) => part[0]?.toUpperCase() || "")
                    .slice(0, 2)
                    .join("");
                  const canReactivate = user.status !== "active";
                  const isCurrentAdmin = user.id === currentAdmin?.id;

                  return (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-xs font-bold">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.totalOrders}</td>
                      <td className="px-4 py-3 font-semibold hidden md:table-cell">₹{user.totalSpent.toFixed(2)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle[user.status] || statusStyle.active}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewUser(user)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="View Details">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => sendEmail(user)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Email">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            disabled={isUpdating || isCurrentAdmin}
                            onClick={() => void toggleUserStatus(user.id)}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${
                              canReactivate ? "hover:bg-primary/10" : "hover:bg-destructive/10"
                            }`}
                            title={isCurrentAdmin ? "You cannot change your own account status" : canReactivate ? "Reactivate user" : "Deactivate user"}
                          >
                            {canReactivate ? (
                              <UserCheck className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <UserX className="w-3.5 h-3.5 text-destructive" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setViewUser(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto z-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-lg font-semibold">User Details</h2>
                <button onClick={() => setViewUser(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="text-center mb-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  {viewUser.name.split(/\s+/).map((part) => part[0]?.toUpperCase() || "").slice(0, 2).join("")}
                </div>
                <h3 className="font-heading font-semibold text-lg">{viewUser.name}</h3>
                <p className="text-sm text-muted-foreground">{viewUser.email}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[viewUser.status] || statusStyle.active}`}>
                  {viewUser.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <ShoppingBag className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{viewUser.totalOrders}</p>
                  <p className="text-[10px] text-muted-foreground">Orders</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold">₹{viewUser.totalSpent.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Total Spent</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs font-medium">{new Date(viewUser.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  <p className="text-[10px] text-muted-foreground">Joined</p>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium">{viewUser.role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium text-right text-xs">{viewUser.email}</span></div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">Recent Orders</h4>
                {userRecentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {userRecentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">₹{order.totalAmount.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{order.orderStatus}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default AdminUsers;
