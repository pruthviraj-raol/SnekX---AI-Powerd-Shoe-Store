import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Truck, CheckCircle, Lock, MapPin, Package, BookOpen } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import { useCart } from "@/context/CartContext";
import { useAddresses } from "@/context/AddressContext";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatAddressLine } from "@/lib/shop";
import { toast } from "sonner";
import type { Address, Order } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

const steps = ["Shipping", "Payment", "Confirmation"];

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  error?: string;
}) => (
  <div>
    <label className="text-sm text-muted-foreground mb-1 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-secondary border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
        error ? "border-destructive ring-1 ring-destructive/30" : "border-border"
      }`}
    />
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

const emptyShipping = {
  fullName: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};

const Checkout = () => {
  const { user, token } = useAuth();
  const { items, totalPrice, discount, refreshCart } = useCart();
  const { addresses, addAddress, isLoading: addressesLoading } = useAddresses();
  const [step, setStep] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shipping, setShipping] = useState(emptyShipping);
  const [payment, setPayment] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [order, setOrder] = useState<Order | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const discountAmount = (totalPrice * discount) / 100;
  const finalPrice = totalPrice - discountAmount;
  const shippingCost = shippingMethod === "express" ? 14.99 : 0;
  const orderTotal = finalPrice + shippingCost;

  const validateShipping = () => {
    const errors: Record<string, string> = {};

    if (!selectedAddressId) {
      if (!shipping.fullName.trim()) errors.fullName = "Full name is required";
      if (!shipping.phone.trim()) errors.phone = "Phone is required";
      if (!shipping.street.trim()) errors.street = "Street is required";
      if (!shipping.city.trim()) errors.city = "City is required";
      if (!shipping.state.trim()) errors.state = "State is required";
      if (!shipping.postalCode.trim()) errors.postalCode = "Postal code is required";
      if (!shipping.country.trim()) errors.country = "Country is required";
    }

    setShippingErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fill in all required shipping fields");
    }
    return Object.keys(errors).length === 0;
  };

  const validatePayment = () => {
    const errors: Record<string, string> = {};

    if (!payment.cardNumber.trim()) errors.cardNumber = "Card number is required";
    else if (!/^[\d\s]{13,19}$/.test(payment.cardNumber.replace(/\s/g, ""))) errors.cardNumber = "Enter a valid card number";
    if (!payment.cardName.trim()) errors.cardName = "Name on card is required";
    if (!payment.expiry.trim()) errors.expiry = "Expiry date is required";
    else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry)) errors.expiry = "Use MM/YY format";
    if (!payment.cvv.trim()) errors.cvv = "CVV is required";
    else if (!/^\d{3,4}$/.test(payment.cvv)) errors.cvv = "Enter a valid CVV";

    setPaymentErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fill in all required payment fields");
    }
    return Object.keys(errors).length === 0;
  };

  const selectAddress = (address: Address) => {
    setSelectedAddressId(address.id);
    setShipping({
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    });
    setShippingErrors({});
  };

  const handleContinueToPayment = async () => {
    if (!validateShipping()) {
      return;
    }

    try {
      if (!selectedAddressId) {
        setIsSavingAddress(true);
        const createdAddress = await addAddress(shipping);
        setSelectedAddressId(createdAddress.id);
      }
      setStep(1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save your shipping address."));
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validatePayment() || !selectedAddressId || !token) {
      return;
    }

    try {
      setIsPlacingOrder(true);
      const response = await apiRequest<{ success: boolean; order: Order }>("/api/orders/create", {
        method: "POST",
        body: {
          addressId: selectedAddressId,
          paymentStatus: "Paid",
        },
        token,
      });

      setOrder(response.order);
      await refreshCart();
      setStep(2);
      toast.success("Order placed successfully!", {
        description: "You'll receive a confirmation shortly.",
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to place your order."));
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0 && step < 2) {
    return (
      <UserLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">No Items to Checkout</h1>
          <p className="text-muted-foreground mb-6">Add some shoes to your cart first.</p>
          <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl">
            Browse Shoes
          </Link>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  index <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {index < step ? <CheckCircle className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${index <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {index < steps.length - 1 && <div className={`w-10 h-0.5 ${index < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 text-primary" />
                    <h2 className="font-heading text-xl font-semibold">Shipping Details</h2>
                  </div>

                  {addresses.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Use a Saved Address</h3>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 mb-4">
                        {addresses.map((address) => (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => selectAddress(address)}
                            className={`text-left p-3 rounded-xl border transition-colors ${
                              selectedAddressId === address.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary hover:bg-primary/5"
                            }`}
                          >
                            <p className="text-sm font-medium">{address.fullName}</p>
                            <p className="text-xs text-muted-foreground">{formatAddressLine(address)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{address.phone}</p>
                          </button>
                        ))}
                      </div>
                      <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-card px-3 text-xs text-muted-foreground">or enter a new address</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      label="Full Name"
                      value={shipping.fullName}
                      onChange={(value) => {
                        setSelectedAddressId("");
                        setShipping((previous) => ({ ...previous, fullName: value }));
                        setShippingErrors((previous) => ({ ...previous, fullName: "" }));
                      }}
                      placeholder="John Doe"
                      error={shippingErrors.fullName}
                    />
                    <InputField
                      label="Phone"
                      value={shipping.phone}
                      onChange={(value) => {
                        setSelectedAddressId("");
                        setShipping((previous) => ({ ...previous, phone: value }));
                        setShippingErrors((previous) => ({ ...previous, phone: "" }));
                      }}
                      placeholder="+1 (555) 123-4567"
                      error={shippingErrors.phone}
                    />
                  </div>

                  <InputField
                    label="Street Address"
                    value={shipping.street}
                    onChange={(value) => {
                      setSelectedAddressId("");
                      setShipping((previous) => ({ ...previous, street: value }));
                      setShippingErrors((previous) => ({ ...previous, street: "" }));
                    }}
                    placeholder="123 Main St"
                    error={shippingErrors.street}
                  />

                  <div className="grid sm:grid-cols-3 gap-4">
                    <InputField
                      label="City"
                      value={shipping.city}
                      onChange={(value) => {
                        setSelectedAddressId("");
                        setShipping((previous) => ({ ...previous, city: value }));
                        setShippingErrors((previous) => ({ ...previous, city: "" }));
                      }}
                      placeholder="New York"
                      error={shippingErrors.city}
                    />
                    <InputField
                      label="State"
                      value={shipping.state}
                      onChange={(value) => {
                        setSelectedAddressId("");
                        setShipping((previous) => ({ ...previous, state: value }));
                        setShippingErrors((previous) => ({ ...previous, state: "" }));
                      }}
                      placeholder="NY"
                      error={shippingErrors.state}
                    />
                    <InputField
                      label="Postal Code"
                      value={shipping.postalCode}
                      onChange={(value) => {
                        setSelectedAddressId("");
                        setShipping((previous) => ({ ...previous, postalCode: value }));
                        setShippingErrors((previous) => ({ ...previous, postalCode: "" }));
                      }}
                      placeholder="10001"
                      error={shippingErrors.postalCode}
                    />
                  </div>

                  <InputField
                    label="Country"
                    value={shipping.country}
                    onChange={(value) => {
                      setSelectedAddressId("");
                      setShipping((previous) => ({ ...previous, country: value }));
                      setShippingErrors((previous) => ({ ...previous, country: "" }));
                    }}
                    placeholder="United States"
                    error={shippingErrors.country}
                  />

                  <div className="pt-2">
                    <h3 className="font-heading font-semibold text-sm mb-3">Shipping Method</h3>
                    <div className="space-y-3">
                      {[
                        { id: "standard" as const, label: "Standard Shipping", desc: "5-7 business days", price: "FREE" },
                        { id: "express" as const, label: "Express Shipping", desc: "2-3 business days", price: "₹14.99" },
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setShippingMethod(method.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                            shippingMethod === method.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                shippingMethod === method.id ? "border-primary bg-primary" : "border-muted-foreground"
                              }`}
                            />
                            <div className="text-left">
                              <p className="text-sm font-medium">{method.label}</p>
                              <p className="text-xs text-muted-foreground">{method.desc}</p>
                            </div>
                          </div>
                          <span className={`text-sm font-semibold ${method.price === "FREE" ? "text-primary" : ""}`}>{method.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleContinueToPayment}
                    disabled={isSavingAddress || addressesLoading}
                    className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
                  >
                    {isSavingAddress ? "Saving Address..." : "Continue to Payment"}
                  </button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h2 className="font-heading text-xl font-semibold">Payment Details</h2>
                  </div>
                  <InputField
                    label="Card Number"
                    value={payment.cardNumber}
                    onChange={(value) => {
                      setPayment((previous) => ({ ...previous, cardNumber: value }));
                      setPaymentErrors((previous) => ({ ...previous, cardNumber: "" }));
                    }}
                    placeholder="1234 5678 9012 3456"
                    error={paymentErrors.cardNumber}
                  />
                  <InputField
                    label="Name on Card"
                    value={payment.cardName}
                    onChange={(value) => {
                      setPayment((previous) => ({ ...previous, cardName: value }));
                      setPaymentErrors((previous) => ({ ...previous, cardName: "" }));
                    }}
                    placeholder="John Doe"
                    error={paymentErrors.cardName}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      label="Expiry Date"
                      value={payment.expiry}
                      onChange={(value) => {
                        setPayment((previous) => ({ ...previous, expiry: value }));
                        setPaymentErrors((previous) => ({ ...previous, expiry: "" }));
                      }}
                      placeholder="MM/YY"
                      error={paymentErrors.expiry}
                    />
                    <InputField
                      label="CVV"
                      value={payment.cvv}
                      onChange={(value) => {
                        setPayment((previous) => ({ ...previous, cvv: value }));
                        setPaymentErrors((previous) => ({ ...previous, cvv: "" }));
                      }}
                      placeholder="123"
                      error={paymentErrors.cvv}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-xl p-3">
                    <Lock className="w-4 h-4 text-primary" />
                    Your payment information is encrypted and secure.
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(0)}
                      className="flex-1 py-3 rounded-xl border border-border font-semibold text-sm hover:bg-secondary transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isPlacingOrder}
                      className="flex-[2] bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
                    >
                      {isPlacingOrder ? "Placing Order..." : `Place Order - ₹${orderTotal.toFixed(2)}`}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && order && (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center"
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                    <CheckCircle className="w-20 h-20 text-primary mx-auto mb-6" />
                  </motion.div>
                  <h2 className="font-heading text-3xl font-bold mb-3">Order Confirmed!</h2>
                  <p className="text-muted-foreground mb-2">Thank you for your purchase.</p>
                  <p className="text-sm text-muted-foreground mb-8">
                    Order <span className="text-foreground font-semibold">{order.orderNumber}</span> -
                    We've sent confirmation details to <span className="text-foreground font-medium">{user?.email || "your account"}</span>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      to={`/order-tracking/${order.id}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl"
                    >
                      <MapPin className="w-4 h-4" /> Track Order
                    </Link>
                    <Link
                      to="/products"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-semibold text-sm hover:bg-secondary transition-colors"
                    >
                      Continue Shopping
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {step < 2 && (
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-24 space-y-4">
                <h3 className="font-heading text-lg font-semibold">Order Summary</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {items.map((item) => (
                    <div key={`${item.product.id}-${item.size ?? "default"}`} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden shrink-0">
                        <img src={getProductImage(item.product)} alt={item.product.name} onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size ? `Size ${item.size} - ` : ""}Qty {item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-3 border-t border-border text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{totalPrice.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Discount ({discount}%)</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className={shippingCost === 0 ? "text-primary text-xs font-medium" : ""}>
                      {shippingCost === 0 ? "FREE" : `₹${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border text-lg font-heading font-bold">
                    <span>Total</span>
                    <span>₹{orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
};

export default Checkout;

