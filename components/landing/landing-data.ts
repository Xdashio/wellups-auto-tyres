export type StockLevel = "in" | "low" | "out";

export interface LandingProduct {
  id: string;
  brand: string;
  category: string;
  name: string;
  spec: string;
  stock: StockLevel;
  image: string | null;
}

export interface LandingService {
  id: string;
  category: string;
  name: string;
  spec: string;
  image: string | null;
  cta: string;
}

export interface LandingBranch {
  num: string;
  name: string;
  address: string[];
  phone: string;
  phoneHref: string;
}

export const WHATSAPP_NUMBER = "254748088741";

export function whatsappInquiryUrl(itemName = "", itemSpec = "", itemCategory = "") {
  let message = "Hello Well Lups!";
  if (itemName) {
    message += ` I would like to inquire about ${itemName}`;
    if (itemSpec) message += ` (${itemSpec})`;
    if (itemCategory) message += ` under ${itemCategory}`;
    message += ".";
  } else {
    message += " I would like to inquire about your tyres, products, and garage services.";
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Generic vehicle reference data for the fit finder. This is not store
// content: it only populates the Make/Model/Year dropdowns until live
// vehicle fitments exist. Products, services, and branches always come
// from the database — never hardcoded.
export const STATIC_VEHICLE_MODELS: Record<string, string[]> = {
  Toyota: ["Prado", "Hilux", "Land Cruiser V8", "Harrier", "RAV4", "Fortuner", "Premio"],
  Subaru: ["Forester", "Outback", "Legacy", "XV / Crosstrek", "Impreza"],
  Nissan: ["X-Trail", "Patrol", "Navara", "Qashqai", "Note"],
  Mitsubishi: ["Pajero", "Outlander", "L200", "RVR", "Pajero Sport"],
  "Land Rover": ["Defender", "Range Rover Sport", "Discovery 4", "Discovery 5", "Evoque"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "G-Wagon"],
  BMW: ["X3", "X5", "X6", "3 Series", "5 Series"],
  Isuzu: ["D-Max", "mu-X", "N-Series Truck"],
};

export const STATIC_YEARS = [
  "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015",
];
