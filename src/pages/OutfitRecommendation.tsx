import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ShoppingBag, Sparkles, Upload, X } from "lucide-react";
import UserLayout from "@/components/layout/UserLayout";
import AILoader from "@/components/ui/AILoader";
import Loader from "@/components/ui/Loader";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import { toast } from "sonner";
import type { OutfitAnalysis, OutfitRecommendationResponse, Product } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

const formatLabel = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatPaletteShare = (share: number) => `${Math.round(share * 100)}%`;
const traditionalEthnicFootwearRegex = /\b(jutti|mojari|mojri|kolhapuri|traditional|ethnic|wedding)\b/i;

const getRecommendationTypeLabel = (product: Product) => {
  const searchableText = [product.name, product.description, ...(product.tags || [])].join(" ");

  if (
    product.category === "ethnic" &&
    product.type === "slip-on" &&
    traditionalEthnicFootwearRegex.test(searchableText)
  ) {
    return "Traditional";
  }

  return formatLabel(product.type);
};

const buildFallbackAnalysis = (response: OutfitRecommendationResponse): OutfitAnalysis | null => {
  const dominantColor = response.detectedColor || response.color || "";

  if (!dominantColor && !response.clothingType) {
    return null;
  }

  return {
    clothingType: response.clothingType || "casual outfit",
    style: response.clothingType || "casual outfit",
    category: "casual",
    allowedTypes: ["sneakers", "walking", "lifestyle"],
    dominantColor,
    palette: dominantColor ? [{ color: dominantColor, share: 1, rgb: response.rgb ?? undefined }] : [],
    neutralShare: 0,
    recommendedShoeColors: dominantColor ? [dominantColor] : [],
    reasoning: [],
    rgb: response.rgb ?? null,
  };
};

const OutfitRecommendationPage = () => {
  const { token } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(null);
  const [detectedColor, setDetectedColor] = useState("");
  const [rgb, setRgb] = useState<{ r: number; g: number; b: number } | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setResults(null);
    setAnalysis(null);
    setDetectedColor("");
    setRgb(null);
    setUsedFallback(false);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file?.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  const analyzeOutfit = async () => {
    if (!selectedFile) {
      setError("Please upload an image before analyzing.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      setAnalyzing(true);
      setError("");

      const response = await apiRequest<OutfitRecommendationResponse>("/api/ai/outfit-recommendation", {
        method: "POST",
        body: formData,
        token,
      });

      const nextAnalysis = response.analysis ?? buildFallbackAnalysis(response);

      setAnalysis(nextAnalysis);
      setDetectedColor(nextAnalysis?.dominantColor || response.detectedColor || response.color || "");
      setRgb(nextAnalysis?.rgb ?? response.rgb ?? null);
      setResults(response.products.map(normalizeProduct));
      setUsedFallback(Boolean(response.fallback));
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, "Unable to analyze your outfit right now.");
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setSelectedFile(null);
    setResults(null);
    setAnalysis(null);
    setDetectedColor("");
    setRgb(null);
    setUsedFallback(false);
    setError("");
  };

  return (
    <UserLayout>
      <AILoader active={analyzing} />
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5" /> AI-Powered
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold">Outfit-Based Shoe Recommendation</h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Upload an outfit photo and the system will detect clothing type, dominant colors, and matching shoes
              from your catalog.
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            {!image ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onDrop={handleDrop}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="bg-card border-2 border-dashed border-border rounded-2xl p-12 md:p-20 text-center cursor-pointer hover:border-primary/50 transition-colors group"
              >
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-heading text-xl font-semibold mb-2">Upload Your Outfit Photo</h3>
                <p className="text-muted-foreground text-sm mb-2">Drag and drop or click to upload.</p>
                <p className="text-muted-foreground text-sm mb-6">
                  Best results come from clear upper-body or full-outfit photos. JPG or PNG up to 10MB.
                </p>
                <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm">
                  <Upload className="w-4 h-4" /> Choose Photo
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      handleFile(file);
                    }
                  }}
                />
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="relative bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    <div className="lg:w-1/2 relative">
                      <img src={image} alt="Uploaded outfit" className="w-full h-72 lg:h-full object-cover" />
                      <button
                        onClick={reset}
                        className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm p-2 rounded-full hover:bg-background transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="lg:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                      {!results && !analyzing && (
                        <>
                          <Sparkles className="w-10 h-10 text-primary mb-4" />
                          <h3 className="font-heading text-xl font-semibold mb-2">Ready to Analyze</h3>
                          <p className="text-muted-foreground text-sm mb-6">
                            We will detect the outfit type, identify the dominant color palette, and recommend matching
                            shoes with explanations.
                          </p>
                          <button
                            onClick={() => void analyzeOutfit()}
                            disabled={analyzing}
                            className="bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-xl flex items-center gap-2 hover:brightness-110 transition-all w-fit disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Sparkles className="w-4 h-4" /> Analyze Outfit
                          </button>
                          {error && <p className="text-sm text-destructive mt-4">{error}</p>}
                        </>
                      )}

                      {analyzing && (
                        <Loader
                          size="sm"
                          text="Analyzing your outfit..."
                          subtext="The full AI stylist overlay is matching your look now."
                        />
                      )}

                      {results && (
                        <>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {analysis?.style && (
                              <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                                Style: {formatLabel(analysis.style)}
                              </span>
                            )}
                            {detectedColor && (
                              <span className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                                Dominant Color: {formatLabel(detectedColor)}
                              </span>
                            )}
                            {usedFallback && (
                              <span className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-1 rounded-full">
                                Fallback Analysis
                              </span>
                            )}
                          </div>
                          <h3 className="font-heading text-xl font-semibold mb-2">Analysis Complete</h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            These shoes were ranked using clothing category, outfit palette, and matching shoe type.
                          </p>
                          {rgb && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                              <span
                                className="w-4 h-4 rounded-full border border-border"
                                style={{ backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
                              />
                              RGB: {rgb.r}, {rgb.g}, {rgb.b}
                            </div>
                          )}
                          <button
                            onClick={reset}
                            className="text-sm text-primary hover:underline flex items-center gap-1 w-fit"
                          >
                            <Camera className="w-3.5 h-3.5" /> Try Another Photo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {analysis && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                            Clothing Type
                          </p>
                          <h3 className="font-heading text-xl font-semibold">
                            {formatLabel(analysis.clothingType)}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-2">
                            Category: {formatLabel(analysis.category)}
                          </p>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                            Shoe Direction
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.allowedTypes.map((type) => (
                              <span
                                key={type}
                                className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary"
                              >
                                {formatLabel(type)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                            Recommended Colors
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.recommendedShoeColors.map((color) => (
                              <span
                                key={color}
                                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-secondary"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-border"
                                  style={{ backgroundColor: color }}
                                />
                                {formatLabel(color)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Palette</p>
                          <div className="flex flex-wrap gap-3">
                            {analysis.palette.map((entry) => (
                              <div
                                key={entry.color}
                                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2"
                              >
                                <span
                                  className="w-4 h-4 rounded-full border border-border"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <div>
                                  <p className="text-sm font-medium">{formatLabel(entry.color)}</p>
                                  <p className="text-xs text-muted-foreground">{formatPaletteShare(entry.share)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                            Why These Shoes
                          </p>
                          <div className="space-y-2">
                            {analysis.reasoning.map((reason) => (
                              <div
                                key={reason}
                                className="text-sm text-muted-foreground rounded-xl bg-secondary/40 px-3 py-2"
                              >
                                {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {usedFallback && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                          The AI image model was unavailable for this request, so the system used dominant-color and
                          filename fallback logic to keep recommendations working.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {results && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center justify-between gap-4 mb-6">
                        <div>
                          <h3 className="font-heading text-2xl font-bold">Recommended Shoes for You</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {results.some((product) => !product.isAlternative)
                              ? "Top matches ranked against your outfit type and palette."
                              : "No strong match was found, so these are the closest alternatives from the catalog."}
                          </p>
                        </div>
                      </div>

                      {results.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
                          No matching products were found for this image yet.
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {results.map((product, index) => (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.08 }}
                            >
                              <Link
                                to={`/product/${product.id}`}
                                className="bg-card border border-border rounded-2xl overflow-hidden group block hover:border-primary/30 transition-colors h-full"
                              >
                                <div className="aspect-square overflow-hidden bg-secondary">
                                  <img
                                    src={getProductImage(product)}
                                    alt={product.name}
                                    onError={(event) => {
                                      event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  />
                                </div>
                                <div className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                                      <h4 className="font-heading font-semibold text-sm mt-1 group-hover:text-primary transition-colors">
                                        {product.name}
                                      </h4>
                                    </div>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
                                      {product.matchPercentage && product.matchPercentage > 0
                                        ? `${product.matchPercentage}% Match`
                                        : "Alternative"}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary">
                                      {getRecommendationTypeLabel(product)}
                                    </span>
                                    {product.colors.slice(0, 2).map((color) => (
                                      <span
                                        key={`${product.id}-${color}`}
                                        className="inline-flex items-center gap-2 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary"
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full border border-border"
                                          style={{ backgroundColor: color }}
                                        />
                                        {formatLabel(color)}
                                      </span>
                                    ))}
                                  </div>

                                  {product.matchSummary && (
                                    <p className="text-sm text-foreground/90">{product.matchSummary}</p>
                                  )}

                                  {product.matchReasons && product.matchReasons.length > 0 && (
                                    <div className="space-y-2">
                                      {product.matchReasons.slice(0, 2).map((reason) => (
                                        <p key={reason} className="text-xs text-muted-foreground">
                                          {reason}
                                        </p>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between pt-2">
                                    <span className="font-bold text-primary">₹{product.price.toFixed(2)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {product.isAlternative ? "Closest fit" : "Strong match"}
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-20"
            >
              <h2 className="font-heading text-2xl font-bold text-center mb-10">How It Works</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    step: "01",
                    icon: Camera,
                    title: "Upload Photo",
                    desc: "The user uploads an outfit image with clear clothing visibility.",
                  },
                  {
                    step: "02",
                    icon: Sparkles,
                    title: "AI Analysis",
                    desc: "The system detects clothing type, dominant color, and the overall outfit direction.",
                  },
                  {
                    step: "03",
                    icon: ShoppingBag,
                    title: "Get Shoe Matches",
                    desc: "Shoes are ranked by matching color, style category, and recommended shoe type.",
                  },
                ].map((item) => (
                  <div key={item.step} className="bg-card border border-border rounded-2xl p-6 text-center relative">
                    <span className="absolute top-4 right-4 text-4xl font-heading font-bold text-primary/10">
                      {item.step}
                    </span>
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-heading font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default OutfitRecommendationPage;

