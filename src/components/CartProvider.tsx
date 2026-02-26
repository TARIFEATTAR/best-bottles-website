"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
    graceSku: string;
    itemName: string;
    quantity: number;
    unitPrice: number | null;
    family?: string;
    capacity?: string;
    color?: string;
}

interface CartContextValue {
    items: CartItem[];
    itemCount: number;
    addItems: (newItems: CartItem[]) => void;
    removeItem: (graceSku: string) => void;
    updateQuantity: (graceSku: string, quantity: number) => void;
    clearCart: () => void;
    checkout: () => Promise<void>;
    isCheckingOut: boolean;
    checkoutError: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within CartProvider");
    return ctx;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "bb-grace-cart";

function loadCartFromStorage(): CartItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCartToStorage(items: CartItem[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* quota exceeded — ignore */ }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setItems(loadCartFromStorage());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) saveCartToStorage(items);
    }, [items, hydrated]);

    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const addItems = useCallback((newItems: CartItem[]) => {
        setItems((prev) => {
            const updated = [...prev];
            for (const item of newItems) {
                const existing = updated.find((i) => i.graceSku === item.graceSku);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    updated.push({ ...item });
                }
            }
            return updated;
        });
    }, []);

    const removeItem = useCallback((graceSku: string) => {
        setItems((prev) => prev.filter((i) => i.graceSku !== graceSku));
    }, []);

    const updateQuantity = useCallback((graceSku: string, quantity: number) => {
        if (quantity <= 0) {
            setItems((prev) => prev.filter((i) => i.graceSku !== graceSku));
        } else {
            setItems((prev) =>
                prev.map((i) => (i.graceSku === graceSku ? { ...i, quantity } : i))
            );
        }
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const checkout = useCallback(async () => {
        if (items.length === 0) return;
        setIsCheckingOut(true);
        setCheckoutError("");

        try {
            const res = await fetch("/api/shopify/resolve-variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: items.map((i) => ({
                        sku: i.graceSku,
                        quantity: i.quantity,
                    })),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error ?? "Checkout failed");
            }

            if (data.checkoutUrl) {
                const unmatched: string[] = data.unmatchedSkus ?? [];
                if (unmatched.length > 0) {
                    setCheckoutError(
                        `${unmatched.length} item(s) couldn't be matched in the store and were skipped. Proceeding with the rest.`
                    );
                }
                window.open(data.checkoutUrl, "_blank");
                clearCart();
            } else if (data.unmatchedSkus?.length) {
                setCheckoutError(
                    `These items aren't available in the online store yet: ${data.unmatchedSkus.join(", ")}. Contact us at sales@bestbottles.com to place your order.`
                );
            } else {
                setCheckoutError("No matching products found in the store. Please contact us at sales@bestbottles.com.");
            }
        } catch (err) {
            console.error("[Cart] Checkout error:", err);
            const message = err instanceof Error ? err.message : "";
            if (message.includes("not configured") || message.includes("503")) {
                setCheckoutError(
                    "Online checkout is temporarily unavailable. Please email your order to sales@bestbottles.com or call us at (800) 555-0199."
                );
            } else {
                setCheckoutError(
                    message || "Checkout failed. Please try again or contact sales@bestbottles.com."
                );
            }
        } finally {
            setIsCheckingOut(false);
        }
    }, [items, clearCart]);

    return (
        <CartContext.Provider
            value={{
                items,
                itemCount,
                addItems,
                removeItem,
                updateQuantity,
                clearCart,
                checkout,
                isCheckingOut,
                checkoutError,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}
