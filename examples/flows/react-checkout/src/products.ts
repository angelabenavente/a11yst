export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export const products: Product[] = [
  {
    id: "mug",
    name: "a11yst Mug",
    price: 18,
    description: "Ceramic mug with a11yst logo. Dishwasher safe.",
  },
  {
    id: "tote",
    name: "a11yst Tote",
    price: 24,
    description: "Canvas tote bag for conferences and grocery runs.",
  },
];
