import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Plus, Edit, Trash2, Search, X, Save } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import type { Product } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

type ProductFormState = {
  name: string;
  brand: string;
  category: string;
  description: string;
  price: string;
  originalPrice: string;
  stock: string;
  image: string;
  color: string;
  colors: string;
  sizes: string;
  tags: string;
  isNew: boolean;
  isTrending: boolean;
};

const emptyProduct: ProductFormState = {
  name: "",
  brand: "",
  category: "",
  description: "",
  price: "",
  originalPrice: "",
  stock: "0",
  image: "",
  color: "",
  colors: "",
  sizes: "",
  tags: "",
  isNew: false,
  isTrending: false,
};

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const AdminProducts = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [productList, setProductList] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProduct);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; products: Product[] }>("/api/products", {
          method: "GET",
          token,
        });

        setProductList(response.products.map(normalizeProduct));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load products."));
      } finally {
        setIsLoading(false);
      }
    };

    void loadProducts();
  }, [token]);

  const filtered = productList.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.brand.toLowerCase().includes(search.toLowerCase())
  );

  const suggestions = useMemo(
    () => ({
      brands: Array.from(new Set(productList.map((product) => product.brand))).filter(Boolean),
      categories: Array.from(new Set(productList.map((product) => product.category))).filter(Boolean),
      colors: Array.from(new Set(productList.flatMap((product) => (product.colors.length ? product.colors : [product.color])))).filter(Boolean),
    }),
    [productList]
  );

  const formImagePreview = form.image.trim() || PRODUCT_IMAGE_PLACEHOLDER;

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      stock: String(product.stock),
      image: product.image,
      color: product.color,
      colors: product.colors.join(", "),
      sizes: product.sizes.join(", "),
      tags: product.tags.join(", "),
      isNew: product.isNew,
      isTrending: product.isTrending,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price.trim() || !form.brand.trim() || !form.category.trim() || !form.description.trim()) {
      toast.error("Name, brand, category, description, and price are required");
      return;
    }

    if (!token) {
      toast.error("Admin authentication is required.");
      return;
    }

    const colors = parseList(form.colors);
    const sizes = parseList(form.sizes).map((value) => Number(value)).filter(Number.isFinite);
    const tags = parseList(form.tags);
    const trimmedImage = form.image.trim();
    const imageChanged = !editingProduct || trimmedImage !== (editingProduct.image || "").trim();
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      originalPrice: form.originalPrice.trim() ? Number(form.originalPrice) : "",
      stock: Number(form.stock || 0),
      color: form.color.trim(),
      colors: colors.length ? colors : form.color.trim() ? [form.color.trim()] : [],
      sizes,
      tags,
      isNew: form.isNew,
      isTrending: form.isTrending,
    };

    if (imageChanged) {
      payload.image = trimmedImage;
      payload.images = trimmedImage ? [trimmedImage] : [];
    }

    try {
      setIsSaving(true);

      if (editingProduct) {
        const response = await apiRequest<{ success: boolean; product: Product }>(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          body: payload,
          token,
        });

        const updatedProduct = normalizeProduct(response.product);
        setProductList((prev) => prev.map((product) => (product.id === updatedProduct.id ? updatedProduct : product)));
        toast.success(`"${updatedProduct.name}" updated successfully`);
      } else {
        const response = await apiRequest<{ success: boolean; product: Product }>("/api/products", {
          method: "POST",
          body: payload,
          token,
        });

        const createdProduct = normalizeProduct(response.product);
        setProductList((prev) => [createdProduct, ...prev]);
        toast.success(`"${createdProduct.name}" added successfully`);
      }

      setDialogOpen(false);
    } catch (saveError) {
      toast.error(getApiErrorMessage(saveError, "Unable to save product."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) {
      toast.error("Admin authentication is required.");
      return;
    }

    const product = productList.find((item) => item.id === id);

    try {
      setIsDeleting(true);
      await apiRequest<{ success: boolean; message: string }>(`/api/products/${id}`, {
        method: "DELETE",
        token,
      });

      setProductList((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirm(null);
      toast.success(`"${product?.name || "Product"}" deleted`);
    } catch (deleteError) {
      toast.error(getApiErrorMessage(deleteError, "Unable to delete product."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout title="Product Management">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="bg-secondary rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary w-64"
            />
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">Loading products...</div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">{error}</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Sizes</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Stock</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={getProductImage(product)} alt={product.name} onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover bg-secondary" />
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.brand}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{product.category}</td>
                    <td className="px-4 py-3 font-semibold">₹{product.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{product.sizes.join(", ") || "-"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-medium">{product.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(product)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                          <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteConfirm(product.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {dialogOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-lg font-semibold">{editingProduct ? "Edit Product" : "Add New Product"}</h2>
                <button onClick={() => setDialogOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Air Phantom X" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Brand *</label>
                    <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} list="product-brands" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Nike" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Category *</label>
                    <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="product-categories" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Running" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Price *</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="189" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Original Price</label>
                    <input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="229" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="25" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Image URL</label>
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                  <div className="mt-3 rounded-xl overflow-hidden border border-border bg-secondary/20">
                    <img
                      src={formImagePreview}
                      alt="Product preview"
                      onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }}
                      referrerPolicy="no-referrer"
                      className="w-full h-40 object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Direct image URLs work best. If you paste a product page link, the backend will try to extract its preview image when you save.</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Color</label>
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} list="product-colors" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Black" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Colors</label>
                    <input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Black, White" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Sizes</label>
                    <input value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="7, 8, 9, 10" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="New arrival, Running" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Product description..." />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} className="accent-primary" /> New
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isTrending} onChange={(e) => setForm({ ...form, isTrending: e.target.checked })} className="accent-primary" /> Trending
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setDialogOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
                <button disabled={isSaving} onClick={() => void handleSave()} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  <Save className="w-4 h-4" /> {editingProduct ? "Update" : "Add Product"}
                </button>
              </div>

              <datalist id="product-brands">
                {suggestions.brands.map((brand) => <option key={brand} value={brand} />)}
              </datalist>
              <datalist id="product-categories">
                {suggestions.categories.map((category) => <option key={category} value={category} />)}
              </datalist>
              <datalist id="product-colors">
                {suggestions.colors.map((color) => <option key={color} value={color} />)}
              </datalist>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm z-10 text-center">
              <Trash2 className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-heading font-semibold text-lg mb-1">Delete Product?</h3>
              <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
                <button disabled={isDeleting} onClick={() => void handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-60">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default AdminProducts;



