export interface CartData {
  id: string;
  version: number;
  currency: string;
  subtotalMinor: number;
  checkoutReady: boolean;
  items: {
    productId: string;
    slug: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    available: boolean;
  }[];
}
