import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type LoaderSize = "sm" | "md" | "lg";

type LoaderProps = {
  text?: string;
  subtext?: string;
  size?: LoaderSize;
  fullscreen?: boolean;
  className?: string;
};

const sizeClasses: Record<LoaderSize, string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

const textSizeClasses: Record<LoaderSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const SneakerMark = ({ size = "md" }: { size?: LoaderSize }) => (
  <motion.div
    className={cn("relative grid place-items-center", sizeClasses[size])}
    initial={{ scale: 0.92, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.45, ease: "easeOut" }}
  >
    <motion.div
      className="absolute inset-0 rounded-full border border-primary/25"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
    />
    <motion.div
      className="absolute inset-2 rounded-full border border-accent/25 border-t-primary border-r-primary/70"
      animate={{ rotate: -360 }}
      transition={{ repeat: Infinity, duration: 2.8, ease: "linear" }}
    />
    <motion.div
      className="absolute inset-0 rounded-full bg-primary/15 blur-2xl"
      animate={{ scale: [0.72, 1.12, 0.72], opacity: [0.32, 0.72, 0.32] }}
      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
    />

    <motion.div
      className="relative h-[58%] w-[68%]"
      animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }}
      transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
    >
      <div className="absolute bottom-[20%] left-[7%] h-[31%] w-[86%] rounded-b-full rounded-t-[1.4rem] bg-gradient-to-r from-foreground via-primary to-accent shadow-[0_0_35px_hsl(var(--primary)/0.45)]" />
      <div className="absolute bottom-[17%] left-[2%] h-[15%] w-[94%] rounded-full bg-background ring-1 ring-primary/40" />
      <div className="absolute bottom-[49%] left-[18%] h-[29%] w-[51%] -skew-x-12 rounded-tl-2xl rounded-tr-lg bg-gradient-to-br from-secondary via-card to-background ring-1 ring-white/10" />
      <div className="absolute bottom-[54%] right-[16%] h-[18%] w-[28%] -skew-x-12 rounded-tr-2xl bg-primary/85" />
      <div className="absolute bottom-[42%] left-[31%] flex gap-1">
        {[0, 1, 2].map((item) => (
          <motion.span
            key={item}
            className="block h-1 w-4 rounded-full bg-background/80"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: Infinity, duration: 1.4, delay: item * 0.18 }}
          />
        ))}
      </div>
    </motion.div>

    <motion.div
      className="absolute -bottom-1 h-2 w-3/5 rounded-full bg-primary/35 blur-md"
      animate={{ scaleX: [0.72, 1, 0.72], opacity: [0.3, 0.68, 0.3] }}
      transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
    />
  </motion.div>
);

const LoaderContent = ({ text = "Loading SnekX...", subtext, size = "md", className }: LoaderProps) => (
  <div className={cn("flex flex-col items-center justify-center gap-5 text-center", className)}>
    <SneakerMark size={size} />
    <div className="space-y-2">
      <motion.p
        className={cn("font-heading font-semibold text-foreground", textSizeClasses[size])}
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      >
        {text}
      </motion.p>
      {subtext && <p className="mx-auto max-w-xs text-xs text-muted-foreground md:text-sm">{subtext}</p>}
    </div>
  </div>
);

const Loader = ({ fullscreen = false, ...props }: LoaderProps) => {
  if (!fullscreen) {
    return <LoaderContent {...props} />;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] grid place-items-center bg-background/88 px-4 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(var(--primary)/0.16),transparent_34%),radial-gradient(circle_at_42%_58%,hsl(var(--accent)/0.12),transparent_32%)]" />
        <LoaderContent {...props} className="relative" />
      </motion.div>
    </AnimatePresence>
  );
};

export default Loader;
export { SneakerMark };
