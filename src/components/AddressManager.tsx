import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAddresses } from "@/context/AddressContext";
import { getApiErrorMessage } from "@/lib/api";
import { formatAddressLine } from "@/lib/shop";
import type { Address } from "@/types/shop";

const emptyForm = {
  fullName: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};

const AddressManager = () => {
  const { addresses, addAddress, updateAddress, deleteAddress, isLoading } = useAddresses();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.phone.trim()) nextErrors.phone = "Phone is required";
    if (!form.street.trim()) nextErrors.street = "Street is required";
    if (!form.city.trim()) nextErrors.city = "City is required";
    if (!form.state.trim()) nextErrors.state = "State is required";
    if (!form.postalCode.trim()) nextErrors.postalCode = "Postal code is required";
    if (!form.country.trim()) nextErrors.country = "Country is required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (address: Address) => {
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    });
    setEditingId(address.id);
    setErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingId) {
        await updateAddress(editingId, form);
        toast.success("Address updated!");
      } else {
        await addAddress(form);
        toast.success("Address added!");
      }
      setShowForm(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save this address."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await deleteAddress(deleteId);
      toast.success("Address deleted!");
      setDeleteId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete this address."));
    }
  };

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: "" }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Saved Addresses</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          + Add New
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="font-heading font-semibold text-sm">{editingId ? "Edit Address" : "New Address"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ["fullName", "Full Name"],
                ["phone", "Phone"],
                ["street", "Street"],
                ["city", "City"],
                ["state", "State"],
                ["postalCode", "Postal Code"],
                ["country", "Country"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <Input
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                  className={errors[field] ? "border-destructive" : ""}
                />
                {errors[field] && <p className="text-xs text-destructive mt-1">{errors[field]}</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading addresses...</div>
      ) : addresses.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No saved addresses yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address, index) => (
            <div key={address.id} className="bg-card rounded-2xl border border-border p-5 relative">
              {index === 0 && (
                <span className="absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  Latest
                </span>
              )}
              <p className="font-semibold text-sm">{address.fullName}</p>
              <p className="text-sm text-muted-foreground mt-1">{formatAddressLine(address)}</p>
              <p className="text-sm text-muted-foreground mt-1">{address.phone}</p>
              <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                <button onClick={() => openEdit(address)} className="text-xs text-primary hover:underline">
                  Edit
                </button>
                <button onClick={() => setDeleteId(address.id)} className="text-xs text-destructive hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddressManager;
