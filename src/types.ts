import type { Product } from "./components/ProductImageGallery";

export interface Address {
  latitude: number;
  longitude: number;
  region?: string;
  district?: string;
  street?: string;
  house?: string;
  apartment?: string;
  landmark?: string;
}

export interface CartItem {
  product: Product;
  size: string;
  color: string;
  quantity: number;
}
