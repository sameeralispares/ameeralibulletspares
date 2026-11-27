'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { CART_STORAGE_KEY, addLine, cartCount, parseStoredCart, removeLine, setQty, type CartLine } from '@/lib/cart';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  /** False until the saved cart has been read in the browser (avoids a flash of "empty"). */
  ready: boolean;
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => 'added' | 'full';
  setQuantity: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// A tiny external store over localStorage, so every component sees one cart
// and tabs stay in step. Server rendering reports "not ready".
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY) ?? '';
  } catch {
    return ''; // storage blocked: the cart works for this page only
  }
}

function getServerSnapshot(): null {
  return null;
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable: nothing to persist */
  }
  emit();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = raw !== null;
  const lines = useMemo(() => parseStoredCart(raw), [raw]);

  const add = useCallback<CartContextValue['add']>(
    (line, qty = 1) => {
      const next = addLine(lines, line, qty);
      if (next.error) return 'full';
      write(next.lines);
      return 'added';
    },
    [lines],
  );

  const setQuantity = useCallback((key: string, qty: number) => write(setQty(lines, key, qty)), [lines]);
  const remove = useCallback((key: string) => write(removeLine(lines, key)), [lines]);
  const clear = useCallback(() => write([]), []);

  const value = useMemo<CartContextValue>(
    () => ({ lines, count: cartCount(lines), ready, add, setQuantity, remove, clear }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
