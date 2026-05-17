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
  categoryInterest?: { name: string; value: number }[];
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

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
});

type TooltipEntry = {
  dataKey: string;
  name?: string;
  color?: string;
  value: number;
};

const formatCategoryLabel = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatShortDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return shortDateFormatter.format(parsed);
};

const PRODUCT_TICK_LINE_LIMIT = 12;

const truncateChartLabel = (value: string, limit = PRODUCT_TICK_LINE_LIMIT) =>
  value.length > limit ? `${value.slice(0, limit - 3)}...` : value;

const getRecommendationAxisLabel = (name: string, productId: string) => {
  const trimmedName = name.trim();

  if (trimmedName && trimmedName !== "Archived product") {
    return trimmedName;
  }

  const shortId = productId.trim().slice(-4).toUpperCase();
  return shortId ? `Archived ${shortId}` : "Archived item";
};

const buildProductTickLines = (value: string) => {
  const label = String(value || "").trim();

  if (!label) {
    return [""];
  }

  const words = label.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return [truncateChartLabel(label, 20)];
  }

  const midpoint = Math.ceil(words.length / 2);

  return [
    truncateChartLabel(words.slice(0, midpoint).join(" ")),
    truncateChartLabel(words.slice(midpoint).join(" ")),
  ].filter(Boolean);
};

const ProductAxisTick = ({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) => {
  const lines = buildProductTickLines(String(payload?.value || ""));

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border/70 px-6 text-center text-sm text-muted-foreground">
    {message}
  </div>
);

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      {typeof label !== "undefined" ? <p className="mb-1 text-xs text-muted-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-sm font-heading font-bold" style={{ color: entry.color }}>
          {entry.name || entry.dataKey}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const AdminAIAnalyticsFixed = () => {
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
      { label: "AI-Driven Revenue", value: currencyFormatter.format(analytics.aiDrivenRevenue || 0), icon: Zap },
    ];
  }, [analytics]);

  const topSearches = useMemo(() => analytics?.topSearchTerms || analytics?.mostSearchedTerms || [], [analytics]);
  const aiRecommended = useMemo(() => analytics?.mostRecommendedProducts || [], [analytics]);

  const categoryData = useMemo(() => {
    if (!analytics) {
      return [];
    }

    if (analytics.categoryInterest?.length) {
      return [...analytics.categoryInterest].sort(
        (left, right) => right.value - left.value || left.name.localeCompare(right.name)
      );
    }

    const grouped = new Map<string, number>();
    for (const product of analytics.mostRecommendedProducts) {
      grouped.set(product.category, (grouped.get(product.category) || 0) + product.recommendationCount);
    }

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));
  }, [analytics]);

  const recommendationChart = useMemo(
    () =>
      aiRecommended.slice(0, 6).map((item) => ({
        name: item.name,
        axisLabel: getRecommendationAxisLabel(item.name, item.productId),
        count: item.recommendationCount,
      })),
    [aiRecommended]
  );

  const searchTrend = useMemo(() => analytics?.searchTrend || [], [analytics]);

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
          ? `${formatCategoryLabel(topCategory.name)} is currently leading AI recommendation interest with ${topCategory.value.toLocaleString()} recommendation events.`
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
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Loading AI analytics...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">{error}</div>
      ) : !analytics ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          No AI analytics available yet.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {aiStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                    <TrendingUp className="h-3 w-3" />
                    Live
                  </span>
                </div>
                <p className="font-heading text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-4 font-heading font-semibold">Search Volume</h2>
              {searchTrend.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={searchTrend}>
                    <defs>
                      <linearGradient id="searchGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={formatShortDate}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} labelFormatter={(value) => (typeof value === "string" ? formatShortDate(value) : value)} />
                    <Area type="monotone" dataKey="count" name="Searches" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#searchGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Search trend data will appear after users start searching." />
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-4 font-heading font-semibold">Recommended Products</h2>
              {recommendationChart.length ? (
                <ResponsiveContainer width="100%" height={248}>
                  <BarChart data={recommendationChart} margin={{ top: 8, right: 0, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="axisLabel" interval={0} height={48} tick={<ProductAxisTick />} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Recommendations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="Recommendation performance will appear once AI suggestions are used." />
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-4 font-heading font-semibold">Category Interest</h2>
              {categoryData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                        {categoryData.map((item, index) => (
                          <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} labelFormatter={(value) => formatCategoryLabel(String(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {categoryData.map((item, index) => (
                      <span key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        {formatCategoryLabel(item.name)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="Category interest will appear once users interact with AI recommendations." />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Search className="h-4 w-4 text-primary" />
                <h2 className="font-heading font-semibold">Most Searched Terms</h2>
              </div>
              <div className="p-4">
                {topSearches.length ? (
                  <div className="space-y-3">
                    {topSearches.map((item, index) => (
                      <div key={item.term} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.term}</p>
                          <p className="text-xs text-muted-foreground">{item.count.toLocaleString()} searches</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Search intent data will appear once customers start using search.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-heading font-semibold">AI Recommended Performance</h2>
              </div>
              {aiRecommended.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Shoe</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Recommendations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiRecommended.map((item) => {
                        const imageUrl = item.image ? resolveMediaUrl(item.image) : "";
                        const productInitial = item.name.trim().charAt(0).toUpperCase() || "?";

                        return (
                          <tr key={item.productId} className="border-b border-border/50 transition-colors hover:bg-secondary/20">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {imageUrl ? (
                                  <img src={imageUrl} alt={item.name} className="h-10 w-10 rounded-lg bg-secondary object-cover" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                                    {productInitial}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.brand === "Unavailable" ? "Archived recommendation" : item.brand}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatCategoryLabel(item.category)}</td>
                            <td className="px-4 py-3 font-semibold">{item.recommendationCount.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Recommendation performance will appear once AI suggestions are used.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-accent/5 to-primary/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-heading font-semibold">AI Insights</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {insights.map((insight) => (
                <div key={insight.title} className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="mb-2 font-heading text-sm font-semibold">{insight.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminAIAnalyticsFixed;