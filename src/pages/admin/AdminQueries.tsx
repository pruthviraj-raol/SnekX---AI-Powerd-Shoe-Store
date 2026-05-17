import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import {
  Search,
  Eye,
  X,
  Mail,
  Clock,
  CheckCircle2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { ContactQuery } from "@/types/shop";

const statusConfig: Record<string, { style: string; icon: LucideIcon }> = {
  pending: { style: "text-accent bg-accent/10", icon: Clock },
  in_progress: { style: "text-primary bg-primary/10", icon: Clock },
  replied: { style: "text-sky-600 bg-sky-500/10", icon: Mail },
  resolved: { style: "text-emerald-600 bg-emerald-500/10", icon: CheckCircle2 },
  closed: { style: "text-muted-foreground bg-secondary", icon: X },
};

const statusOptions = ["pending", "in_progress", "replied", "resolved", "closed"];

const formatStatusLabel = (status: string) =>
  status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const buildReplyMailto = (query: ContactQuery, replyDraft: string) => {
  const replyBody = replyDraft.trim()
    ? replyDraft.trim()
    : `Thanks for reaching out to SnekX regarding "${query.subject}".`;

  const body = [
    `Hi ${query.name},`,
    "",
    replyBody,
    "",
    "Original query:",
    `Subject: ${query.subject}`,
    query.message,
    "",
    "Regards,",
    "SnekX Admin",
  ].join("\n");

  return `mailto:${query.email}?subject=${encodeURIComponent(`Re: ${query.subject}`)}&body=${encodeURIComponent(body)}`;
};

const AdminQueries = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [queries, setQueries] = useState<ContactQuery[]>([]);
  const [viewQuery, setViewQuery] = useState<ContactQuery | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const loadQueries = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; queries: ContactQuery[] }>("/api/admin/queries", {
          method: "GET",
          token,
        });

        setQueries(response.queries);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load customer queries."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadQueries();
  }, [token]);

  const availableStatuses = Array.from(new Set(queries.map((query) => query.status.toLowerCase()))).sort();

  const filtered = queries.filter((query) => {
    const normalizedStatus = query.status.toLowerCase();
    const term = search.toLowerCase();
    const matchSearch =
      query.name.toLowerCase().includes(term) ||
      query.email.toLowerCase().includes(term) ||
      query.subject.toLowerCase().includes(term) ||
      query.message.toLowerCase().includes(term) ||
      query.id.toLowerCase().includes(term);
    const matchStatus = statusFilter === "All" || normalizedStatus === statusFilter.toLowerCase();

    return matchSearch && matchStatus;
  });

  const pendingCount = queries.filter((query) => query.status.toLowerCase() === "pending").length;
  const viewStatusConfig = viewQuery ? statusConfig[viewQuery.status.toLowerCase()] || statusConfig.pending : statusConfig.pending;
  const ViewStatusIcon = viewStatusConfig.icon;

  const openQuery = (query: ContactQuery) => {
    setViewQuery(query);
    setReplyDraft(query.adminReply || "");
    setSelectedStatus(query.status.toLowerCase());
  };

  const syncUpdatedQuery = (updatedQuery: ContactQuery) => {
    setQueries((prev) => prev.map((query) => (query.id === updatedQuery.id ? updatedQuery : query)));
    setViewQuery((prev) => (prev?.id === updatedQuery.id ? updatedQuery : prev));
    setReplyDraft(updatedQuery.adminReply || "");
    setSelectedStatus(updatedQuery.status.toLowerCase());
  };

  const saveQuery = async (
    query: ContactQuery,
    payload: { status?: string; adminReply?: string },
    successMessage: string
  ) => {
    if (!token) {
      toast.error("Admin authentication is required.");
      return null;
    }

    try {
      setActiveQueryId(query.id);
      const response = await apiRequest<{ success: boolean; message: string; query: ContactQuery }>(
        `/api/admin/queries/${query.id}`,
        {
          method: "PATCH",
          body: payload,
          token,
        }
      );

      syncUpdatedQuery(response.query);
      toast.success(successMessage);
      return response.query;
    } catch (saveError) {
      toast.error(getApiErrorMessage(saveError, "Unable to update customer query."));
      return null;
    } finally {
      setActiveQueryId(null);
    }
  };

  const handleQuickResolve = async (query: ContactQuery) => {
    await saveQuery(query, { status: "resolved" }, `${query.name}'s query was marked as resolved.`);
  };

  const handleSaveChanges = async () => {
    if (!viewQuery) {
      return;
    }

    await saveQuery(
      viewQuery,
      {
        status: selectedStatus,
        adminReply: replyDraft,
      },
      "Customer query updated."
    );
  };

  const handleReplyByEmail = async () => {
    if (!viewQuery) {
      return;
    }

    const emailStatus = ["resolved", "closed"].includes(selectedStatus) ? selectedStatus : "replied";
    const updatedQuery =
      (await saveQuery(
        viewQuery,
        {
          status: emailStatus,
          adminReply: replyDraft,
        },
        "Reply saved. Opening your email app."
      )) || viewQuery;

    window.location.href = buildReplyMailto(updatedQuery, replyDraft);
  };

  const handleDeleteQuery = async () => {
    if (!viewQuery || !token) {
      toast.error("Admin authentication is required.");
      return;
    }

    const shouldDelete = window.confirm(`Delete the query from ${viewQuery.name}? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    try {
      setIsDeleting(true);
      await apiRequest<{ success: boolean; message: string }>(`/api/admin/queries/${viewQuery.id}`, {
        method: "DELETE",
        token,
      });

      setQueries((prev) => prev.filter((query) => query.id !== viewQuery.id));
      setViewQuery(null);
      setReplyDraft("");
      toast.success("Customer query deleted.");
    } catch (deleteError) {
      toast.error(getApiErrorMessage(deleteError, "Unable to delete customer query."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout title="Customer Queries">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries..."
              className="bg-secondary rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {["All", ...availableStatuses].map((status) => (
              <option key={status} value={status}>
                {status === "All" ? status : formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-accent font-medium">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {pendingCount} pending
            </span>
          )}
          <p className="text-sm text-muted-foreground">{filtered.length} queries</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Loading queries...
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          {error}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Subject</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((query) => {
                  const normalizedStatus = query.status.toLowerCase();
                  const statusStyle = statusConfig[normalizedStatus] || statusConfig.pending;
                  const StatusIcon = statusStyle.icon;
                  const isBusy = activeQueryId === query.id;

                  return (
                    <tr key={query.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{query.id}</td>
                      <td className="px-4 py-3 font-medium">{query.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{query.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{query.subject}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[280px] truncate">{query.message}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {new Date(query.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle.style}`}
                        >
                          <StatusIcon className="w-3 h-3" /> {formatStatusLabel(query.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openQuery(query)}
                            className="p-2 rounded-lg hover:bg-secondary transition-colors"
                            title="View query"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => {
                              window.location.href = buildReplyMailto(query, query.adminReply || "");
                            }}
                            className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                            title="Reply by email"
                          >
                            <Mail className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            disabled={isBusy || normalizedStatus === "resolved"}
                            onClick={() => void handleQuickResolve(query)}
                            className="p-2 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                            title={normalizedStatus === "resolved" ? "Already resolved" : "Mark resolved"}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No queries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewQuery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setViewQuery(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-heading text-lg font-semibold">Customer Query</h2>
                  <p className="text-xs text-muted-foreground">
                    {viewQuery.id} |{" "}
                    {new Date(viewQuery.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button onClick={() => setViewQuery(null)} className="p-1.5 rounded-lg hover:bg-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center text-sm font-bold">
                  {getInitials(viewQuery.name)}
                </div>
                <div>
                  <p className="font-medium text-sm">{viewQuery.name}</p>
                  <p className="text-xs text-muted-foreground">{viewQuery.email}</p>
                </div>
                <span
                  className={`md:ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    viewStatusConfig.style
                  }`}
                >
                  <ViewStatusIcon className="w-3 h-3" />
                  {formatStatusLabel(viewQuery.status)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Subject</span>
                  </div>
                  <p className="text-sm leading-relaxed">{viewQuery.subject}</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-4 text-sm space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Tracking</p>
                  <p>
                    Last updated:{" "}
                    <span className="font-medium">
                      {new Date(viewQuery.updatedAt || viewQuery.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  {viewQuery.handledBy?.name && (
                    <p>
                      Handled by: <span className="font-medium">{viewQuery.handledBy.name}</span>
                    </p>
                  )}
                  {viewQuery.repliedAt && (
                    <p>
                      Replied:{" "}
                      <span className="font-medium">
                        {new Date(viewQuery.repliedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4 text-sm mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Message</p>
                <p className="leading-relaxed whitespace-pre-wrap">{viewQuery.message}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] mb-5">
                <div>
                  <label className="text-sm font-medium mb-2 block">Admin Reply</label>
                  <textarea
                    rows={7}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Write a reply or internal response note here..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This reply is saved in the admin panel and used to prefill the email reply action.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-4 text-sm space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Quick Actions</p>
                    <button
                      onClick={() => void handleSaveChanges()}
                      disabled={activeQueryId === viewQuery.id}
                      className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-xl disabled:opacity-60"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => void handleReplyByEmail()}
                      disabled={activeQueryId === viewQuery.id}
                      className="w-full bg-secondary border border-border font-medium py-2.5 rounded-xl hover:bg-secondary/80 disabled:opacity-60"
                    >
                      Reply by Email
                    </button>
                    <button
                      onClick={() => void handleDeleteQuery()}
                      disabled={isDeleting}
                      className="w-full bg-destructive/10 text-destructive font-medium py-2.5 rounded-xl hover:bg-destructive/15 disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete Query
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default AdminQueries;
