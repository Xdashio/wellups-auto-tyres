export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  sellPrice: number;
  stockQuantity: number;
  quantity: number;
}

export interface CartTotals {
  totalAmount: number;
  totalItems: number;
  totalUniqueItems: number;
}

export interface AddableProduct {
  id: string;
  name: string;
  sku: string;
  sell_price: number;
  stock_quantity: number;
}

/**
 * Pure cart management functions for POS operations.
 * Client calculations are strictly informational for cashier UX.
 * Authoritative price, stock, and total calculations happen on the server/DB.
 */

export function addToCart(
  cart: CartItem[],
  product: AddableProduct,
  quantityToAdd: number = 1
): CartItem[] {
  if (quantityToAdd <= 0 || product.stock_quantity <= 0) {
    return cart;
  }

  const existingIndex = cart.findIndex((item) => item.productId === product.id);

  if (existingIndex >= 0) {
    const existing = cart[existingIndex];
    const newQty = Math.min(existing.quantity + quantityToAdd, product.stock_quantity);
    if (newQty === existing.quantity) {
      return cart;
    }

    const updated = [...cart];
    updated[existingIndex] = {
      ...existing,
      quantity: newQty,
    };
    return updated;
  }

  const initialQty = Math.min(quantityToAdd, product.stock_quantity);
  return [
    ...cart,
    {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      sellPrice: product.sell_price,
      stockQuantity: product.stock_quantity,
      quantity: initialQty,
    },
  ];
}

export function updateQuantity(
  cart: CartItem[],
  productId: string,
  newQuantity: number
): CartItem[] {
  if (newQuantity <= 0) {
    return removeFromCart(cart, productId);
  }

  const existingIndex = cart.findIndex((item) => item.productId === productId);
  if (existingIndex < 0) {
    return cart;
  }

  const existing = cart[existingIndex];
  const targetQty = Math.min(Math.floor(newQuantity), existing.stockQuantity);

  const updated = [...cart];
  updated[existingIndex] = {
    ...existing,
    quantity: targetQty,
  };
  return updated;
}

export function removeFromCart(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((item) => item.productId !== productId);
}

export function calculateCartTotals(cart: CartItem[]): CartTotals {
  let totalAmount = 0;
  let totalItems = 0;

  for (const item of cart) {
    totalAmount += item.quantity * item.sellPrice;
    totalItems += item.quantity;
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalItems,
    totalUniqueItems: cart.length,
  };
}
