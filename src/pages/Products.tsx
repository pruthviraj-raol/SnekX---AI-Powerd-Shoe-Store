import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UserLayout from "@/components/layout/UserLayout";
import ProductCard from "@/components/ProductCard";
import ProductSkeleton from "@/components/ui/ProductSkeleton";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types/shop";

const sortOptions = [
  { label: "Popular", value: "popular" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Newest", value: "newest" },
  { label: "Rating", value: "rating" },
];

const normalizeCategoryFilter = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (["running", "training", "basketball", "sports"].includes(normalized)) {
    return "sports";
  }

  if (["lifestyle", "casual"].includes(normalized)) {
    return "casual";
  }

  if (normalized === "formal") {
    return "formal";
  }

  return value;
};

const Products = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const initialCategory = normalizeCategoryFilter(searchParams.get("category") || "");

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 300]);
  const [sortBy, setSortBy] = useState("popular");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const itemsPerPage = 9;

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ success: boolean; products: Product[] }>("/api/products", {
          method: "GET",
          token,
        });

        const normalizedProducts = response.products.map(normalizeProduct);
        const maxPrice = Math.max(...normalizedProducts.map((product) => product.price), 300);
        setAllProducts(normalizedProducts);
        setPriceRange([0, maxPrice]);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load products right now."));
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [token]);

  useEffect(() => {
    const searchTerm = search.trim();

    if (!searchTerm) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void apiRequest<{ success: boolean; products: Product[] }>(
        `/api/products?search=${encodeURIComponent(searchTerm)}`,
        {
          method: "GET",
          token,
        }
      ).catch(() => {
        // Search analytics should never interrupt the shopping experience.
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [search, token]);

  const brands = useMemo(
    () => [...new Set(allProducts.map((product) => product.brand).filter(Boolean))].sort(),
    [allProducts]
  );
  const categories = useMemo(
    () => [...new Set(allProducts.map((product) => product.category).filter(Boolean))].sort(),
    [allProducts]
  );
  const colors = useMemo(
    () =>
      [...new Set(allProducts.flatMap((product) => (product.colors.length ? product.colors : [product.color])).filter(Boolean))].sort(),
    [allProducts]
  );
  const maxAvailablePrice = useMemo(
    () => Math.max(...allProducts.map((product) => product.price), 300),
    [allProducts]
  );

  const toggleFilter = (values: string[], setValues: (nextValues: string[]) => void, value: string) => {
    setValues(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  };

  const filtered = useMemo(() => {
    let result = [...allProducts];

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
      );
    }

    if (selectedBrands.length) {
      result = result.filter((product) => selectedBrands.includes(product.brand));
    }

    if (selectedCategories.length) {
      result = result.filter((product) => selectedCategories.includes(product.category));
    }

    if (selectedColors.length) {
      result = result.filter((product) =>
        selectedColors.some((selectedColor) => [product.color, ...product.colors].filter(Boolean).includes(selectedColor))
      );
    }

    result = result.filter((product) => product.price >= priceRange[0] && product.price <= priceRange[1]);

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        result.sort((a, b) => Number(new Date(b.createdAt || 0)) - Number(new Date(a.createdAt || 0)));
        break;
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        result.sort((a, b) => b.numReviews - a.numReviews || b.rating - a.rating);
        break;
    }

    return result;
  }, [allProducts, priceRange, search, selectedBrands, selectedCategories, selectedColors, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBrands, selectedCategories, selectedColors, priceRange, sortBy]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-muted-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <UserLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">All Shoes</h1>
            <p className="text-muted-foreground text-sm">
              {isLoading ? "Loading products..." : `${filtered.length} products`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shoes..."
              className="bg-secondary rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary w-48"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors md:hidden"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          <div className="hidden md:block w-56 shrink-0 space-y-6">
            <div>
              <h3 className="font-heading font-semibold text-sm mb-3">Brand</h3>
              <div className="flex flex-wrap gap-2">
                {brands.map((brand) => (
                  <FilterChip
                    key={brand}
                    label={brand}
                    active={selectedBrands.includes(brand)}
                    onClick={() => toggleFilter(selectedBrands, setSelectedBrands, brand)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <FilterChip
                    key={category}
                    label={category}
                    active={selectedCategories.includes(category)}
                    onClick={() => toggleFilter(selectedCategories, setSelectedCategories, category)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm mb-3">Color</h3>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <FilterChip
                    key={color}
                    label={color}
                    active={selectedColors.includes(color)}
                    onClick={() => toggleFilter(selectedColors, setSelectedColors, color)}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm mb-3">Price Range</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>₹{priceRange[0]}</span>
                <input
                  type="range"
                  min={0}
                  max={maxAvailablePrice}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="flex-1 accent-primary"
                />
                <span>₹{priceRange[1]}</span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden overflow-y-auto p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading text-xl font-bold">Filters</h2>
                  <button onClick={() => setFiltersOpen(false)}>
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-heading font-semibold text-sm mb-3">Brand</h3>
                    <div className="flex flex-wrap gap-2">
                      {brands.map((brand) => (
                        <FilterChip
                          key={brand}
                          label={brand}
                          active={selectedBrands.includes(brand)}
                          onClick={() => toggleFilter(selectedBrands, setSelectedBrands, brand)}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-sm mb-3">Category</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <FilterChip
                          key={category}
                          label={category}
                          active={selectedCategories.includes(category)}
                          onClick={() => toggleFilter(selectedCategories, setSelectedCategories, category)}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-sm mb-3">Color</h3>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color) => (
                        <FilterChip
                          key={color}
                          label={color}
                          active={selectedColors.includes(color)}
                          onClick={() => toggleFilter(selectedColors, setSelectedColors, color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="mt-8 w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
                >
                  Show {filtered.length} Results
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1">
            {isLoading ? (
              <ProductSkeleton count={9} className="md:grid-cols-3" />
            ) : error ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg">No shoes found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  {paginatedProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default Products;
