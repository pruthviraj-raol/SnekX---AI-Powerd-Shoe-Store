import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SneakerMark } from "@/components/ui/Loader";

const loaderSteps = [
  "Uploading image...",
  "Analyzing style...",
  "Matching sneakers...",
  "Generating recommendations...",
];

type AILoaderProps = {
  active: boolean;
};

const AILoader = ({ active }: AILoaderProps) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, loaderSteps.length - 1));
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [active]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-background/88 px-4 backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.20),transparent_34%),radial-gradient(circle_at_55%_65%,hsl(var(--accent)/0.16),transparent_36%)]" />
          <motion.div
            className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10"
            animate={{ scale: [0.82, 1.12, 0.82], opacity: [0.28, 0.72, 0.28] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
          />
          <motion.div
            className="relative flex w-full max-w-md flex-col items-center text-center"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
              <Sparkles className="h-3.5 w-3.5" />
              SnekX AI Stylist
            </div>

            <SneakerMark size="lg" />

            <div className="mt-7 min-h-[4.5rem]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={loaderSteps[stepIndex]}
                  className="font-heading text-2xl font-bold text-foreground md:text-3xl"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28 }}
                >
                  {loaderSteps[stepIndex]}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-3 text-sm text-muted-foreground">
                Reading the outfit, palette, and sneaker match signals.
              </p>
            </div>

            <div className="mt-7 flex w-full max-w-xs gap-2">
              {loaderSteps.map((step, index) => (
                <div key={step} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    initial={false}
                    animate={{ width: index <= stepIndex ? "100%" : "0%" }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AILoader;
