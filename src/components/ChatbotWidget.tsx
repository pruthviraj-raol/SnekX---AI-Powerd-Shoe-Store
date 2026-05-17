import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { normalizeProduct } from "@/lib/shop";
import { toast } from "sonner";
import type { Product } from "@/types/shop";
import { PRODUCT_IMAGE_PLACEHOLDER, getProductImage } from "@/utils/getProductImage";

type ChatMessage = {
  role: "bot" | "user";
  text: string;
  products?: Product[];
};

const ChatbotWidget = () => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hey! I'm SnekX AI. Tell me what kind of sneaker you're looking for." },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !messagesContainerRef.current) {
      return;
    }

    const container = messagesContainerRef.current;
    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: messages.length > 1 ? "smooth" : "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSending, messages, open]);

  const sendMessage = async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const message = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");

    try {
      setIsSending(true);
      const response = await apiRequest<{ success: boolean; response: string; products: Product[] }>("/api/ai/chatbot", {
        method: "POST",
        body: { message },
        token,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: response.response,
          products: response.products.map(normalizeProduct),
        },
      ]);
    } catch (error) {
      const messageText = getApiErrorMessage(error, "Unable to contact the AI assistant right now.");
      toast.error(messageText);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "I couldn't process that just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-primary/30 hover:shadow-xl transition-all flex items-center justify-center animate-pulse-glow"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-80 h-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border bg-secondary/30">
              <h3 className="font-heading font-semibold text-sm">SnekX AI Assistant</h3>
              <p className="text-xs text-muted-foreground">Powered by AI • Online</p>
            </div>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.products && msg.products.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                      {msg.products.slice(0, 4).map((product) => (
                        <Link
                          key={product.id}
                          to={`/product/${product.id}`}
                          className="bg-card border border-border rounded-xl p-2 hover:border-primary/40 transition-colors"
                        >
                          <img src={getProductImage(product)} alt={product.name} onError={(event) => { event.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER; }} className="w-full h-20 object-cover rounded-lg bg-secondary mb-2" />
                          <p className="text-xs font-medium line-clamp-1">{product.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{product.brand}</p>
                          <p className="text-xs font-semibold text-primary mt-1">₹{product.price.toFixed(2)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-secondary-foreground px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void sendMessage();
                  }
                }}
                placeholder="Ask about shoes..."
                className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={isSending}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatbotWidget;

