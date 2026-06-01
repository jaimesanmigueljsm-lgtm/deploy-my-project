import type { LucideIcon } from "lucide-react";
import {
  Home, Building2, Car, Banknote, Wrench, Smartphone, Dumbbell,
  Repeat, Shield, Bus, Baby, MoreHorizontal, Music, Sparkles, Sofa,
  Heart, Plane, Landmark, Shirt, PawPrint, CreditCard, ShoppingCart,
  Tag, Wallet, Utensils, Zap, Droplets, Flame,
  ShoppingBag, GraduationCap, Tv, Gift, Wifi, Fuel, Stethoscope,
} from "lucide-react";

export type CategoryColor = "mint" | "sky" | "warn" | "violet";
export type CategoryGroup = "housing" | "transport" | "food" | "health" | "finance" | "lifestyle" | "travel" | "other";

export interface CategoryMeta {
  icon: LucideIcon;
  color: CategoryColor;
  group: CategoryGroup;
}

// iconKey (stored in categories.icon DB column) → visual config.
// Colors are canonical here, not in the DB.
export const REGISTRY: Record<string, CategoryMeta> = {
  // Housing
  "home":            { icon: Home,           color: "sky",    group: "housing" },
  "building-2":      { icon: Building2,      color: "sky",    group: "housing" },
  "sofa":            { icon: Sofa,           color: "sky",    group: "housing" },
  "wrench":          { icon: Wrench,         color: "sky",    group: "housing" },
  "zap":             { icon: Zap,            color: "warn",   group: "housing" },
  "droplets":        { icon: Droplets,       color: "sky",    group: "housing" },
  "flame":           { icon: Flame,          color: "warn",   group: "housing" },
  // Transport
  "car":             { icon: Car,            color: "sky",    group: "transport" },
  "bus":             { icon: Bus,            color: "sky",    group: "transport" },
  "fuel":            { icon: Fuel,           color: "warn",   group: "transport" },
  "plane":           { icon: Plane,          color: "sky",    group: "travel" },
  // Food
  "shopping-cart":   { icon: ShoppingCart,   color: "mint",   group: "food" },
  "utensils":        { icon: Utensils,       color: "warn",   group: "food" },
  // Health
  "heart":           { icon: Heart,          color: "mint",   group: "health" },
  "dumbbell":        { icon: Dumbbell,       color: "mint",   group: "health" },
  "stethoscope":     { icon: Stethoscope,    color: "mint",   group: "health" },
  "baby":            { icon: Baby,           color: "mint",   group: "health" },
  // Finance & Utilities
  "credit-card":     { icon: CreditCard,     color: "violet", group: "finance" },
  "banknote":        { icon: Banknote,       color: "warn",   group: "finance" },
  "landmark":        { icon: Landmark,       color: "violet", group: "finance" },
  "repeat":          { icon: Repeat,         color: "violet", group: "finance" },
  "shield":          { icon: Shield,         color: "sky",    group: "finance" },
  "wifi":            { icon: Wifi,           color: "sky",    group: "finance" },
  // Lifestyle & Shopping
  "shopping-bag":    { icon: ShoppingBag,    color: "warn",   group: "lifestyle" },
  "shirt":           { icon: Shirt,          color: "warn",   group: "lifestyle" },
  "sparkles":        { icon: Sparkles,       color: "violet", group: "lifestyle" },
  "smartphone":      { icon: Smartphone,     color: "mint",   group: "lifestyle" },
  "music":           { icon: Music,          color: "violet", group: "lifestyle" },
  "graduation-cap":  { icon: GraduationCap,  color: "sky",    group: "lifestyle" },
  "tv":              { icon: Tv,             color: "violet", group: "lifestyle" },
  "gift":            { icon: Gift,           color: "violet", group: "lifestyle" },
  "paw-print":       { icon: PawPrint,       color: "mint",   group: "lifestyle" },
  // Other
  "more-horizontal": { icon: MoreHorizontal, color: "mint",   group: "other" },
  "tag":             { icon: Tag,            color: "mint",   group: "other" },
  "wallet":          { icon: Wallet,         color: "mint",   group: "other" },
};

// Ordered list for the icon picker UI (grouped by category)
export const ICON_PICKER_KEYS: string[] = [
  // Housing & utilities
  "home", "building-2", "sofa", "wrench", "zap", "droplets", "flame",
  // Transport
  "car", "bus", "fuel", "plane",
  // Food
  "shopping-cart", "utensils",
  // Health
  "heart", "dumbbell", "stethoscope", "baby",
  // Finance & utilities
  "credit-card", "banknote", "landmark", "repeat", "shield", "wifi",
  // Lifestyle & shopping
  "shopping-bag", "shirt", "sparkles", "smartphone", "music",
  "graduation-cap", "tv", "gift", "paw-print",
  // Other
  "more-horizontal", "tag", "wallet",
];

const FALLBACK: CategoryMeta = { icon: Tag, color: "mint", group: "other" };

export function getCategoryMeta(iconKey: string): CategoryMeta {
  return REGISTRY[iconKey] ?? FALLBACK;
}

export function getColorClasses(color: string): { soft: string; text: string } {
  const map: Record<string, { soft: string; text: string }> = {
    mint:   { soft: "bg-positive-soft", text: "text-positive" },
    sky:    { soft: "bg-sky-soft",      text: "text-sky" },
    warn:   { soft: "bg-warn-soft",     text: "text-warn" },
    violet: { soft: "bg-violet-soft",   text: "text-violet" },
  };
  return map[color] ?? { soft: "bg-muted", text: "text-muted-foreground" };
}
