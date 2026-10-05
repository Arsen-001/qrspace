// Товары с кодом (демо): печать по требованию пока не подключена — заказ сохраняется, оплата демо.
export const PRODUCTS = {
  stickers: { price: 6, variants: ["10", "30", "100"], prices: { "10": 6, "30": 14, "100": 39 } as Record<string, number> },
  keychain: { price: 12, variants: ["steel", "black"], prices: null },
  pettag: { price: 10, variants: ["round", "bone"], prices: null },
  tshirt: { price: 25, variants: ["S", "M", "L", "XL", "XXL"], prices: null },
} as const;
export type ProductId = keyof typeof PRODUCTS;
export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export const priceOf = (p: ProductId, variant: string, qty: number) => (PRODUCTS[p].prices?.[variant] ?? PRODUCTS[p].price) * qty;

export type ShopOrder = {
  id: string;
  person: string;
  product: ProductId;
  variant: string;
  code: string;
  qty: number;
  total: number;
  address: { name: string; phone: string; city: string; street: string };
  status: "paid" | "printing" | "shipped";
  createdAt: string;
};
