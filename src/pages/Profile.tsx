import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
  Edit2,
  Camera,
  ChevronRight,
  ShoppingBag,
  CheckCircle,
  CreditCard,
} from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useAddresses } from "@/context/AddressContext";
import { useWishlist } from "@/context/WishlistContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import AddressManager from "@/components/AddressManager";
import type { Order } from "@/types/shop";

const tabs = [
  { id: "overview", label: "Overview", icon: User },
  { id: "orders", label: "Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
];

const statusColor: Record<string, string> = {
  Completed: "text-primary bg-primary/10",
  Shipped: "text-accent bg-accent/10",
  Processing: "text-muted-foreground bg-secondary",
  Cancelled: "text-destructive bg-destructive/10",
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
};

const buildProfileForm = (name = "", email = ""): ProfileForm => {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" "),
    email,
  };
};

const Profile = () => {
  const { user, logout, token, updateProfile: saveProfile } = useAuth();
  const { addresses, isLoading: addressesLoading } = useAddresses();
  const { items: wishlistItems } = useWishlist();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => buildProfileForm());
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await apiRequest<{ success: boolean; orders: Order[] }>("/api/orders/my-orders", {
          method: "GET",
          token,
        });

        setOrders(response.orders);
      } catch (error) {
        setOrdersError(getApiErrorMessage(error, "Unable to load your order history."));
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [token]);

  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.totalAmount, 0), [orders]);

  if (!user) {
    return null;
  }

  const nameParts = user.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "-";
  const initials = nameParts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";
  const rewardPoints = Math.round(totalSpent / 10);
  const savedAddresses = addressesLoading ? "Loading..." : String(addresses.length);

  const openProfileEditor = () => {
    setProfileForm(buildProfileForm(user.name, user.email));
    setProfileErrors({});
    setIsEditingProfile(true);
  };

  const closeProfileEditor = () => {
    setProfileForm(buildProfileForm(user.name, user.email));
    setProfileErrors({});
    setIsEditingProfile(false);
  };

  const updateProfileField = (field: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));

    if (profileErrors[field]) {
      setProfileErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateProfileForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!profileForm.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    }

    if (!profileForm.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }

    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleProfileSave = async () => {
    if (!token) {
      toast.error("You need to be signed in to update your profile.");
      return;
    }

    if (!validateProfileForm()) {
      return;
    }

    const nextName = `${profileForm.firstName.trim()} ${profileForm.lastName.trim()}`.trim();

    try {
      setIsSavingProfile(true);
      const updatedUser = await saveProfile({
        name: nextName,
        email: profileForm.email.trim().toLowerCase(),
      });

      setProfileForm(buildProfileForm(updatedUser.name, updatedUser.email));
      setIsEditingProfile(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="bg-card rounded-2xl border border-border p-6 text-center mb-4">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-heading font-bold text-primary-foreground">
                  {initials || "SN"}
                </div>
                <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Camera className="w-3 h-3" />
                </button>
              </div>
              <h2 className="font-heading font-bold">{user.name}</h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Member since {memberSince}</p>
            </div>

            <nav className="bg-card rounded-2xl border border-border overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </button>
              ))}
              <Link
                to="/wishlist"
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-secondary text-muted-foreground transition-colors"
              >
                <Heart className="w-4 h-4" /> Wishlist <ChevronRight className="w-3 h-3 ml-auto" />
              </Link>
              <Link
                to="/"
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-secondary text-destructive transition-colors border-t border-border"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </Link>
            </nav>
          </div>

          <div className="md:col-span-3">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <h1 className="font-heading text-2xl font-bold">My Profile</h1>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Orders", value: String(orders.length), icon: ShoppingBag },
                      { label: "Wishlist Items", value: String(wishlistItems.length), icon: Heart },
                      { label: "Total Spent", value: `₹${totalSpent.toFixed(2)}`, icon: CreditCard },
                      { label: "Reward Points", value: rewardPoints.toLocaleString(), icon: CheckCircle },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                        <stat.icon className="w-5 h-5 text-primary mb-2" />
                        <p className="font-heading text-xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-heading font-semibold">Personal Information</h2>
                      {!isEditingProfile ? (
                        <button onClick={openProfileEditor} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      ) : (
                        <button onClick={closeProfileEditor} className="text-sm text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      )}
                    </div>
                    {isEditingProfile ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(
                            [
                              ["firstName", "First Name"],
                              ["lastName", "Last Name"],
                              ["email", "Email"],
                            ] as const
                          ).map(([field, label]) => (
                            <div key={field}>
                              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                              <Input
                                type={field === "email" ? "email" : "text"}
                                value={profileForm[field]}
                                onChange={(e) => updateProfileField(field, e.target.value)}
                                className={profileErrors[field] ? "border-destructive" : ""}
                              />
                              {profileErrors[field] && <p className="text-xs text-destructive mt-1">{profileErrors[field]}</p>}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { label: "Role", value: user.role },
                            { label: "Account Status", value: user.status },
                            { label: "Saved Addresses", value: savedAddresses },
                          ].map((field) => (
                            <div key={field.label}>
                              <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
                              <p className="text-sm font-medium">{field.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => void handleProfileSave()}
                            disabled={isSavingProfile}
                            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            {isSavingProfile ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={closeProfileEditor}
                            className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: "First Name", value: firstName },
                          { label: "Last Name", value: lastName },
                          { label: "Email", value: user.email },
                          { label: "Role", value: user.role },
                          { label: "Account Status", value: user.status },
                          { label: "Saved Addresses", value: savedAddresses },
                        ].map((field) => (
                          <div key={field.label}>
                            <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
                            <p className="text-sm font-medium">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "orders" && (
                <div className="space-y-6">
                  <h1 className="font-heading text-2xl font-bold">Order History</h1>
                  {ordersLoading ? (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
                      Loading your orders...
                    </div>
                  ) : ordersError ? (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
                      {ordersError}
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
                      You have not placed any orders yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="bg-card rounded-2xl border border-border p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <div>
                              <p className="font-heading font-semibold text-sm">{order.orderNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[order.orderStatus]}`}>
                                {order.orderStatus}
                              </span>
                              <Link to={`/order-tracking/${order.id}`} className="text-xs text-primary hover:underline">
                                Track Order
                              </Link>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {order.products.map((item, index) => (
                              <div key={`${item.productId}-${index}`} className="flex items-center gap-3">
                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-secondary" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.size ? `Size ${item.size} - ` : ""}Qty {item.quantity}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Total</span>
                            <span className="font-heading font-bold">₹{order.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "addresses" && <AddressManager />}
            </motion.div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default Profile;
