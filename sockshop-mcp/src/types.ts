export interface RawProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string[];
  price: number;
  count: number;
  tag: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  count: number;
  tags: string[];
}

export interface CartItem {
  id?: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export interface ResourceLink {
  href: string;
}

export type ResourceLinks = Record<string, ResourceLink>;

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  _links: ResourceLinks;
}

export interface Address {
  id: string;
  number: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
}

export interface Card {
  id: string;
  longNum: string;
  expires: string;
  ccv: string;
}

export interface Shipment {
  id: string;
  name: string;
}

export interface Order {
  id?: string;
  customerId: string;
  customer: Customer;
  address: Address;
  card: Card;
  items: CartItem[];
  shipment: Shipment;
  date: string;
  total: number;
}

export interface TagsResponse {
  tags: string[];
  err: string | null;
}

export interface CatalogueSizeResponse {
  size: number;
  err: string | null;
}
