import { describe, it, expect } from "vitest";
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  calculateCartTotals,
  CartItem,
  AddableProduct,
} from "@/lib/services/cart";

describe("POS Cart Services Layer", () => {
  const sampleProduct: AddableProduct = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Standard Tyre 205/55R16",
    sku: "TYR-205-55-16",
    sell_price: 8500,
    stock_quantity: 4,
  };

  const sampleProduct2: AddableProduct = {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Alloy Wheel 16in",
    sku: "WHL-16-001",
    sell_price: 12000,
    stock_quantity: 2,
  };

  it("adds an item to an empty cart", () => {
    const cart = addToCart([], sampleProduct, 2);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toEqual({
      productId: sampleProduct.id,
      name: sampleProduct.name,
      sku: sampleProduct.sku,
      sellPrice: 8500,
      stockQuantity: 4,
      quantity: 2,
    });
  });

  it("merges duplicate item and increments quantity without exceeding stock", () => {
    let cart: CartItem[] = [];
    cart = addToCart(cart, sampleProduct, 2);
    expect(cart[0].quantity).toBe(2);

    // Add 1 more -> total 3
    cart = addToCart(cart, sampleProduct, 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);

    // Add 3 more -> should cap at max stock of 4
    cart = addToCart(cart, sampleProduct, 3);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(4);
  });

  it("does not add out-of-stock items", () => {
    const outOfStock: AddableProduct = {
      ...sampleProduct,
      stock_quantity: 0,
    };
    const cart = addToCart([], outOfStock, 1);
    expect(cart).toHaveLength(0);
  });

  it("does not add non-positive quantities", () => {
    const cart = addToCart([], sampleProduct, 0);
    expect(cart).toHaveLength(0);

    const negativeCart = addToCart([], sampleProduct, -5);
    expect(negativeCart).toHaveLength(0);
  });

  it("updates item quantity and caps at stock", () => {
    let cart = addToCart([], sampleProduct, 1);
    cart = updateQuantity(cart, sampleProduct.id, 3);
    expect(cart[0].quantity).toBe(3);

    // Exceed stock
    cart = updateQuantity(cart, sampleProduct.id, 10);
    expect(cart[0].quantity).toBe(4);
  });

  it("removes item when quantity is set to 0", () => {
    let cart = addToCart([], sampleProduct, 1);
    cart = updateQuantity(cart, sampleProduct.id, 0);
    expect(cart).toHaveLength(0);
  });

  it("removes item directly via removeFromCart", () => {
    let cart = addToCart([], sampleProduct, 1);
    cart = addToCart(cart, sampleProduct2, 1);
    expect(cart).toHaveLength(2);

    cart = removeFromCart(cart, sampleProduct.id);
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe(sampleProduct2.id);
  });

  it("calculates accurate cart totals across items", () => {
    let cart = addToCart([], sampleProduct, 2); // 2 * 8500 = 17000
    cart = addToCart(cart, sampleProduct2, 1); // 1 * 12000 = 12000

    const totals = calculateCartTotals(cart);
    expect(totals.totalAmount).toBe(29000);
    expect(totals.totalItems).toBe(3);
    expect(totals.totalUniqueItems).toBe(2);
  });

  it("handles empty cart totals cleanly", () => {
    const totals = calculateCartTotals([]);
    expect(totals.totalAmount).toBe(0);
    expect(totals.totalItems).toBe(0);
    expect(totals.totalUniqueItems).toBe(0);
  });
});
