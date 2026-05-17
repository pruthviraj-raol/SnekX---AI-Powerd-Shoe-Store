import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Sparkles, TrendingUp, Search, Eye, Target, Zap } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import { resolveMediaUrl } from "@/lib/shop";

type AnalyticsData = {
  totalAIRecommendationsServed: number;
  aiConversionRate: number;
  aiDrivenRevenue: number;
  totalSearches?: number;
  topSearchTerms?: { term: string; count: number }[];
  searchTrend?: { date: string; count: number }[];
  mostSearchedTerms: { term: string; count: number }[];
  mostRecommendedProducts: {
    productId: string;
    name: string;
    brand: string;
    category: string;
    image: string;
    recommendationCount: number;
  }[];
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210 70% 55%)",
  "hsl(var(--muted-foreground))",
];

type TooltipEntry = {
  dataKey: string;
  name?: string;
  color?: string;
  value: number;
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
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm font-heading font-bold" style={{ color: entry.color }}>
          {entry.name || entry.dataKey}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const AdminAIAnalytics = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const loadAnalytics = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; analytics: AnalyticsData }>("/api/admin/ai-analytics", {
          method: "GET",
          token,
        });

        setAnalytics(response.analytics);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load AI analytics."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, [token]);

  const aiStats = useMemo(() => {
    if (!analytics) {
      return [];
    }

    return [
      { label: "AI Recommendations Served", value: analytics.totalAIRecommendationsServed.toLocaleString(), icon: Sparkles },
      { label: "AI Conversion Rate", value: `${analytics.aiConversionRate.toFixed(2)}%`, icon: Target },
      { label: "Total Searches", value: (analytics.totalSearches || 0).toLocaleString(), icon: Eye },
      { label: "AI-Driven Revenue", value: `₹${analytics.aiDrivenRevenue.toLocaleString()}`, icon: Zap },
    ];
  }, [analytics]);

  const topSearches = useMemo(
    () => analytics?.topSearchTerms || analytics?.mostSearchedTerms || [],
    [analytics]
  );
  const aiRecommended = useMemo(() => analytics?.mostRecommendedProducts || [], [analytics]);

  const categoryData = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const grouped = new Map<string, number>();
    for (const product of analytics.mostRecommendedProducts) {
      grouped.set(product.category, (grouped.get(product.category) || 0) + product.recommendationCount);
    }

    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const recommendationChart = useMemo(
    () =>
      aiRecommended.slice(0, 6).map((item) => ({
        name: item.name,
        count: item.recommendationCount,
      })),
    [aiRecommended]
  );

  const searchTrend = useMemo(
    () => analytics?.searchTrend || [],
    [analytics]
  );

  const insights = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const topCategory = categoryData[0];
    const topSearch = topSearches[0];
    const topRecommended = aiRecommended[0];

    return [
      {
        title: "Trending Category",
        desc: topCategory
          ? `${topCategory.name} is currently leading AI recommendation interest with ${topCategory.value.toLocaleString()} recommendation events.`
          : "Not enough recommendation data yet.",
      },
      {
        title: "Top Search Intent",
        desc: topSearch
          ? `"${topSearch.term}" is the most searched term at ${topSearch.count.toLocaleString()} searches.`
          : "Search trend data will appear after users interact with search.",
      },
      {
        title: "Best Performing Recommendation",
        desc: topRecommended
          ? `${topRecommended.name} has been recommended ${topRecommended.recommendationCount.toLocaleString()} times so far.`
          : "Recommendation performance will appear after AI usage grows.",
      },
    ];
  }, [aiRecommended, analytics, categoryData, topSearches]);

  return (
    <AdminLayout title="AI Analytics">
      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Loading AI analytics...
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">{error}</div>
      ) : !analytics ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No AI analytics available yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {aiStats.map((stat) => (
              <div key={stat.label} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    Live
                  </span>
                </div>
                <p className="font-heading text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="font-heading font-semibold mb-4">Search Volume</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={searchTrend}>
                  <defs>
                    <linearGradient id="searchGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Searches" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#searchGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="font-heading font-semibold mb-4">Recommended Products</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={recommendationChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Recommendations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <h2 className="font-heading font-semibold mb-4">Category Interest</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {categoryData.map((item, i) => (
                  <span key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold">Most Searched Terms</h2>
              </div>
              <div className="p-4 space-y-3">
                {topSearches.map((item, i) => (
                  <div key={item.term} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.term}</p>
                      <p className="text-xs text-muted-foreground">{item.count.toLocaleString()} searches</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold">AI Recommended Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-3 font-medium">Shoe</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Recommendations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiRecommended.map((item) => (
                      <tr key={item.productId} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={resolveMediaUrl(item.image)} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-secondary" />
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                        <td className="px-4 py-3 font-semibold">{item.recommendationCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/5 rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">AI Insights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight) => (
                <div key={insight.title} className="bg-card/60 rounded-xl p-4 border border-border/50">
                  <p className="font-heading font-semibold text-sm mb-2">{insight.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminAIAnalytics;
