"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import type { Product, ProductOffer, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  selectListing: (productId: string, offer: ProductOffer) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  cartCount: number;
  subtotal: number;
  shippingFee: number;
  cartTotal: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "eamora.cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever items change
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota/private-mode errors
    }
  }, [items]);

  const setItemsWithPersist = useCallback(
    (next: React.SetStateAction<CartItem[]>) => {
      setItems((prev) => {
        const nextItems = typeof next === "function" ? next(prev) : next;
        return nextItems;
      });
    },
    [],
  );

  const addItem = useCallback(
    (product: Product, quantity = 1) => {
      setItemsWithPersist((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          return prev.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [
          ...prev,
          {
            id: `cart_${product.id}`,
            productId: product.id,
            product,
            quantity,
            selectedPrice: product.price,
          },
        ];
      });
    },
    [setItemsWithPersist],
  );

  const selectListing = useCallback(
    (productId: string, offer: ProductOffer) => {
      setItemsWithPersist((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? {
                ...item,
                listingId: offer.listingId,
                shopId: offer.shopId,
                shopName: offer.shopName,
                selectedPrice: offer.price,
              }
            : item,
        ),
      );
    },
    [setItemsWithPersist],
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItemsWithPersist((prev) => prev.filter((item) => item.productId !== productId));
    },
    [setItemsWithPersist],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setItemsWithPersist((prev) => prev.filter((item) => item.productId !== productId));
        return;
      }
      setItemsWithPersist((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        ),
      );
    },
    [setItemsWithPersist],
  );

  const clearCart = useCallback(() => setItemsWithPersist([]), [setItemsWithPersist]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartCount = items.length;
  const subtotal = items.reduce(
    (sum, item) => sum + item.selectedPrice * item.quantity,
    0,
  );
  const shippingFee = subtotal > 0 ? 30000 : 0;
  const cartTotal = subtotal + shippingFee;
  const totalAmount = cartTotal;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        selectListing,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        cartCount,
        subtotal,
        shippingFee,
        cartTotal,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
