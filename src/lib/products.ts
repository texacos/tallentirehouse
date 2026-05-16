import cushionIndigo from "@/assets/product-cushion-indigo.jpg";
import bolsterOchre from "@/assets/product-bolster-ochre.jpg";
import vaseCeladon from "@/assets/product-vase-celadon.jpg";
import throwStripe from "@/assets/product-throw-stripe.jpg";
import kaftanIvory from "@/assets/product-kaftan-ivory.jpg";
import pouchIndigo from "@/assets/product-pouch-indigo.jpg";
import fabricStack from "@/assets/product-fabric-stack.jpg";

export type Category =
  | "cushions"
  | "ceramics"
  | "fabrics"
  | "accessories"
  | "lounging"
  | "travel";

export const CATEGORIES: { slug: Category; label: string }[] = [
  { slug: "cushions", label: "Cushions & Bolsters" },
  { slug: "ceramics", label: "Ceramics" },
  { slug: "fabrics", label: "Fabrics" },
  { slug: "accessories", label: "Home Accessories" },
  { slug: "lounging", label: "Lounging" },
  { slug: "travel", label: "Travel" },
];

export type Product = {
  slug: string;
  name: string;
  category: Category;
  price: number; // in dollars
  image: string;
  blurb: string;
  description: string;
  origin: string;
  materials: string;
};

export const PRODUCTS: Product[] = [
  {
    slug: "asha-block-print-cushion",
    name: "Asha Block-Print Cushion",
    category: "cushions",
    price: 145,
    image: cushionIndigo,
    blurb: "Hand-blocked indigo on heavyweight cotton, fringed edge.",
    description:
      "A square cushion printed by hand using traditional wooden blocks in Bagru, Rajasthan. The deep natural indigo is fermented over weeks and dyed in small batches, giving each cushion its own quiet variation. Finished with a soft cotton fringe and a feather-down insert.",
    origin: "Bagru, India",
    materials: "100% cotton, feather-down inner",
  },
  {
    slug: "saffron-stripe-bolster",
    name: "Saffron Stripe Bolster",
    category: "cushions",
    price: 165,
    image: bolsterOchre,
    blurb: "Handwoven cotton bolster in ochre and rust stripes.",
    description:
      "Long bolster cushion woven on a traditional pit loom. The warm stripe is dyed with botanical pigments and softens beautifully over the years. Sized for a generous bed or daybed.",
    origin: "Andhra Pradesh, India",
    materials: "Handwoven cotton, kapok fill",
  },
  {
    slug: "celadon-bud-vase",
    name: "Celadon Bud Vase",
    category: "ceramics",
    price: 88,
    image: vaseCeladon,
    blurb: "Hand-thrown stoneware in matte celadon green.",
    description:
      "A small bud vase wheel-thrown by a single potter, finished with a celadon glaze that breaks softly over the throwing marks. Holds a single stem or a few wildflowers.",
    origin: "Jingdezhen, China",
    materials: "Stoneware, food-safe glaze",
  },
  {
    slug: "indigo-window-throw",
    name: "Indigo Window Throw",
    category: "fabrics",
    price: 210,
    image: throwStripe,
    blurb: "Soft cotton throw in undyed cream with indigo windowpane.",
    description:
      "A generous handloom throw woven from undyed cotton with a fine indigo windowpane check. Light enough for summer evenings, soft enough to live on the sofa year-round. Fringed by hand.",
    origin: "Tamil Nadu, India",
    materials: "100% handwoven cotton",
  },
  {
    slug: "moonlight-kaftan",
    name: "Moonlight Kaftan",
    category: "lounging",
    price: 245,
    image: kaftanIvory,
    blurb: "Ivory cotton kaftan with hand-embroidered neckline.",
    description:
      "Cut from a single length of soft cotton voile and finished with delicate hand embroidery around the neckline. One-size, designed to drape easily. As at home on the terrace as in the bedroom.",
    origin: "Lucknow, India",
    materials: "Cotton voile, hand embroidery",
  },
  {
    slug: "wayfarer-pouch",
    name: "Wayfarer Pouch",
    category: "travel",
    price: 72,
    image: pouchIndigo,
    blurb: "Quilted block-print pouch with leather drawstring.",
    description:
      "A small quilted pouch made from offcuts of our block-print yardage, lined in unbleached cotton and finished with a vegetable-tanned leather drawstring. Perfect for jewellery on the road.",
    origin: "Jaipur, India",
    materials: "Block-print cotton, vegetable-tanned leather",
  },
  {
    slug: "atelier-fabric-bundle",
    name: "Atelier Fabric Bundle",
    category: "fabrics",
    price: 320,
    image: fabricStack,
    blurb: "Curated stack of five hand-blocked cotton yardages.",
    description:
      "A curated bundle of five one-metre cuts from our current block-print collection. Hand-selected each season; colours and prints vary. A working sample for makers, designers, and collectors.",
    origin: "Bagru, India",
    materials: "100% cotton, natural dyes",
  },
  {
    slug: "celadon-table-jar",
    name: "Celadon Table Jar",
    category: "accessories",
    price: 124,
    image: vaseCeladon,
    blurb: "Lidded stoneware jar in soft celadon.",
    description:
      "A small lidded jar thrown alongside our bud vase, in the same matte celadon glaze. For sea salt, loose tea, or whatever the table needs that day.",
    origin: "Jingdezhen, China",
    materials: "Stoneware, food-safe glaze",
  },
];

export const getProduct = (slug: string) =>
  PRODUCTS.find((p) => p.slug === slug);

export const getProductsByCategory = (category: Category) =>
  PRODUCTS.filter((p) => p.category === category);

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
