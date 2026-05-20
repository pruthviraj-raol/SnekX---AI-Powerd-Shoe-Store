import { describe, expect, it, vi } from "vitest";

const importApi = async () => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://snekx-backend.onrender.com");

  return import("./api");
};

describe("resolveApiUrl", () => {
  it("keeps explicit /api backend routes on the Render backend", async () => {
    const { resolveApiUrl } = await importApi();

    expect(resolveApiUrl("/api/products")).toBe("https://snekx-backend.onrender.com/api/products");
  });

  it("adds /api for known backend route roots", async () => {
    const { resolveApiUrl } = await importApi();

    expect(resolveApiUrl("/products")).toBe("https://snekx-backend.onrender.com/api/products");
    expect(resolveApiUrl("/cart/add")).toBe("https://snekx-backend.onrender.com/api/cart/add");
    expect(resolveApiUrl("orders/create")).toBe("https://snekx-backend.onrender.com/api/orders/create");
    expect(resolveApiUrl("/auth/login")).toBe("https://snekx-backend.onrender.com/api/auth/login");
    expect(resolveApiUrl("/wishlist")).toBe("https://snekx-backend.onrender.com/api/wishlist");
    expect(resolveApiUrl("/reviews")).toBe("https://snekx-backend.onrender.com/api/reviews");
  });

  it("leaves absolute URLs and frontend paths unchanged", async () => {
    const { resolveApiUrl } = await importApi();

    expect(resolveApiUrl("https://example.com/products")).toBe("https://example.com/products");
    expect(resolveApiUrl("/uploads/shoe.png")).toBe("https://snekx-backend.onrender.com/uploads/shoe.png");
  });
});
