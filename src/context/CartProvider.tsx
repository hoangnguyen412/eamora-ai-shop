"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Product, ProductOffer, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  selectListing: (productId: string, offer: ProductOffer) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
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
  }, []);

  const selectListing = useCallback((productId: string, offer: ProductOffer) => {
    setItems((prev) => prev.map((item) => item.productId === productId
      ? {
        ...item,
        listingId: offer.listingId,
        shopId: offer.shopId,
        shopName: offer.shopName,
        selectedPrice: offer.price,
      }
      : item));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.selectedPrice * item.quantity,
    0
  );
  const shippingFee = subtotal > 0 ? 30000 : 0;
  const totalAmount = subtotal + shippingFee;

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
        subtotal,
        shippingFee,
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
