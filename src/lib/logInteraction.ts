const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const AUTH_TOKEN_KEY = "eamora.auth.token";

export type InteractionAction = "view" | "click" | "add_to_cart" | "purchase";

/**
 * Fire-and-forget interaction logger.
 *
 * Intentionally NOT awaited so it never blocks the UI. The auth token is read
 * directly from `localStorage` (the helper is also used outside AuthProvider,
 * e.g. CartProvider), so no React context dependency is needed.
 *
 * Anonymous strategy (Option A): when no token exists the call is skipped
 * entirely. This keeps `mock-user-123` out of the interaction table so the
 * Stage 2 user-vector computation only sees real users. Failures are only
 * reported with `console.warn`.
 */
export function logInteraction(productId: string, action: InteractionAction): void {
  if (typeof window === "undefined" || !productId) return;

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // `keepalive` lets the request survive a link-triggered navigation (click action).
  void fetch(`${API_BASE_URL}/api/interactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ productId, action }),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`Failed to log interaction (${action} ${productId}): HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.warn(`Failed to log interaction (${action} ${productId}):`, error);
    });
}
