import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { TrendingUp, DollarSign, ShoppingBag, Users, Eye, ArrowUpRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { Order } from "@/types/shop";

type DashboardData = {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  pageViews: number;
  recentOrders: (Order & {
    userId?: {
      id?: string;
      _id?: string;
      name?: string;
      email?: string;
    };
  })[];
  topProducts: {
    _id: string;
    productName: string;
    sales: number;
    revenue: number;
  }[];
};

const statusStyle: Record<string, string> = {
  Completed: "text-primary bg-primary/10",
  Processing: "text-accent bg-accent/10",
  Shipped: "text-blue-400 bg-blue-400/10",
  Cancelled: "text-destructive bg-destructive/10",
};

type TooltipEntry = {
  value: number | string;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-heading font-bold">
        {typeof payload[0].value === "number" && payload[0].value > 1000
          ? `₹${payload[0].value.toLocaleString()}`
          : payload[0].value}
      </p>
    </div>
  );
};

const AdminDashboard = () => {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; dashboard: DashboardData }>("/api/admin/dashboard", {
          method: "GET",
          token,
        });

        setDashboard(response.dashboard);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load dashboard data."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboard();
  }, [token]);

  const stats = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { label: "Total Revenue", value: `₹${dashboard.totalRevenue.toLocaleString()}`, icon: DollarSign },
      { label: "Total Orders", value: dashboard.totalOrders.toLocaleString(), icon: ShoppingBag },
      { label: "Total Users", value: dashboard.totalUsers.toLocaleString(), icon: Users },
      { label: "Page Views", value: dashboard.pageViews.toLocaleString(), icon: Eye },
    ];
  }, [dashboard]);

  const revenueData = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const grouped = new Map<string, number>();
    for (const order of dashboard.recentOrders) {
      const label = new Date(order.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      grouped.set(label, (grouped.get(label) || 0) + order.totalAmount);
    }

    return Array.from(grouped.entries()).map(([label, revenue]) => ({ label, revenue }));
  }, [dashboard]);

  const topProductChart = useMemo(
    () =>
      dashboard?.topProducts.map((product) => ({
        name: product.productName,
        sales: product.sales,
      })) || [],
    [dashboard]
  );

  return (
    <AdminLayout title="Dashboard">
      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Loading dashboard...
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">{error}</div>
      ) : !dashboard ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No dashboard data available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                    <TrendingUp className="w-3 h-3" />
                    Live
                  </span>
                </div>
                <p className="font-heading text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="font-heading font-semibold mb-4">Recent Revenue</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="font-heading font-semibold mb-4">Top Product Sales</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProductChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-heading font-semibold">Recent Orders</h2>
                <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Product</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{order.userId?.name || "Guest"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{order.products[0]?.name || "-"}</td>
                        <td className="px-4 py-3 font-semibold">₹{order.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle[order.orderStatus]}`}>
                            {order.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="font-heading font-semibold">Top Products</h2>
              </div>
              <div className="p-4 space-y-4">
                {dashboard.topProducts.map((product, i) => (
                  <div key={product._id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      <p className="text-xs text-muted-foreground">{product.sales} sales</p>
                    </div>
                    <span className="text-sm font-heading font-semibold">₹{product.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
