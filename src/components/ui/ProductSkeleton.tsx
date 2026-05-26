import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ProductSkeletonProps = {
  count?: number;
  className?: string;
};

const ProductSkeleton = ({ count = 8, className }: ProductSkeletonProps) => (
  <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6", className)} aria-label="Loading products">
    {Array.from({ length: count }).map((_, index) => (
      <motion.div
        key={index}
        className="overflow-hidden rounded-xl border border-border bg-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.04 }}
      >
        <div className="relative aspect-square overflow-hidden bg-secondary/40">
          <Skeleton className="h-full w-full rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="absolute bottom-4 left-4 right-4 h-2 rounded-full bg-background/35" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </motion.div>
    ))}
  </div>
);

export default ProductSkeleton;
