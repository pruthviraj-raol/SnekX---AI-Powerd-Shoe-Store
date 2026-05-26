import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Zap, TrendingUp, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import heroImageDark from "@/assets/hero-shoe.jpg";
import heroImageLight from "@/assets/hero-shoe-light.jpg";
import ProductCard from "@/components/ProductCard";
import ProductSkeleton from "@/components/ui/ProductSkeleton";
import UserLayout from "@/components/layout/UserLayout";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types/shop";

const Index = () => {
  const { theme } = useTheme();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

        setProducts(response.products.map(normalizeProduct));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Unable to load featured products."));
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [token]);

  const featuredProducts = useMemo(() => products.filter((product) => product.isTrending).slice(0, 4), [products]);
  const newArrivals = useMemo(() => products.filter((product) => product.isNew).slice(0, 4), [products]);

  return (
    <UserLayout>
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImageDark}
            alt="SnekX Hero"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              theme === "dark" ? "opacity-100" : "opacity-0"
            }`}
          />
          <img
            src={heroImageLight}
            alt="SnekX Hero"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              theme === "light" ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-0 ${
              theme === "light"
                ? "bg-gradient-to-r from-white/95 via-white/60 to-transparent"
                : "bg-gradient-to-r from-background via-background/80 to-transparent"
            }`}
          />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">AI Powered</span>
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-bold leading-tight mb-6">
              Step Into
              <br />
              The <span className="gradient-text text-glow">Future</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              Discover AI-curated sneakers tailored to your style. Premium brands, intelligent recommendations.
            </p>
            <div className="flex gap-4">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
              >
                Shop Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/products?category=sports"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-xl hover:bg-secondary transition-colors font-semibold"
              >
                Explore
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-border bg-card/30">
        <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Brands", value: `${new Set(products.map((product) => product.brand)).size || 0}+`, icon: Zap },
            { label: "Products", value: `${products.length}+`, icon: TrendingUp },
            { label: "Trending Picks", value: `${featuredProducts.length}+`, icon: Sparkles },
            { label: "New Arrivals", value: `${newArrivals.length}+`, icon: Sparkles },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col items-center gap-1"
            >
              <span className="font-heading text-2xl md:text-3xl font-bold gradient-text">{stat.value}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold">Trending Now</h2>
            <p className="text-muted-foreground mt-1">Most popular picks from the catalog</p>
          </div>
          <Link to="/products" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {isLoading ? (
          <ProductSkeleton count={4} />
        ) : error ? (
          <div className="text-center py-16 text-muted-foreground">{error}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {featuredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 via-accent/10 to-primary/5 border border-border p-8 md:p-16">
          <div className="relative z-10 max-w-lg">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              AI Shoe <span className="gradient-text">Recommendation</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              Upload your outfit and let the AI suggest matching shoes based on clothing type and color.
            </p>
            <Link
              to="/outfit-recommendation"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all"
            >
              Try It Now <Sparkles className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold">New Arrivals</h2>
            <p className="text-muted-foreground mt-1">Fresh drops from the live catalog</p>
          </div>
          <Link to="/products" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {isLoading ? (
          <ProductSkeleton count={4} />
        ) : error ? (
          <div className="text-center py-16 text-muted-foreground">{error}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {newArrivals.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </section>
    </UserLayout>
  );
};

export default Index;
