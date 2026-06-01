import type { LucideIcon } from "lucide-react";
import {
  Home, Building2, Car, Banknote, Wrench, Smartphone, Dumbbell,
  Repeat, Shield, Bus, Baby, MoreHorizontal, Music, Sparkles, Sofa,
  Heart, Plane, Landmark, Shirt, PawPrint, CreditCard, ShoppingCart,
  Tag, Wallet, Utensils, Zap, Droplets, Flame,
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
  "home":            { icon: Home,           color: "sky",    group: "housing" },
  "building-2":      { icon: Building2,      color: "sky",    group: "housing" },
  "wrench":          { icon: Wrench,         color: "sky",    group: "housing" },
  "sofa":            { icon: Sofa,           color: "sky",    group: "housing" },
  "zap":             { icon: Zap,            color: "warn",   group: "housing" },
  "droplets":        { icon: Droplets,       color: "sky",    group: "housing" },
  "flame":           { icon: Flame,          color: "warn",   group: "housing" },
  "car":             { icon: Car,            color: "sky",    group: "transport" },
  "bus":             { icon: Bus,            color: "sky",    group: "transport" },
  "plane":           { icon: Plane,          color: "sky",    group: "travel" },
  "banknote":        { icon: Banknote,       color: "warn",   group: "finance" },
  "repeat":          { icon: Repeat,         color: "violet", group: "finance" },
  "shield":          { icon: Shield,         color: "sky",    group: "finance" },
  "landmark":        { icon: Landmark,       color: "violet", group: "finance" },
  "credit-card":     { icon: CreditCard,     color: "violet", group: "finance" },
  "smartphone":      { icon: Smartphone,     color: "mint",   group: "lifestyle" },
  "dumbbell":        { icon: Dumbbell,       color: "mint",   group: "health" },
  "baby":            { icon: Baby,           color: "mint",   group: "health" },
  "heart":           { icon: Heart,          color: "mint",   group: "health" },
  "music":           { icon: Music,          color: "violet", group: "lifestyle" },
  "sparkles":        { icon: Sparkles,       color: "violet", group: "lifestyle" },
  "shirt":           { icon: Shirt,          color: "warn",   group: "lifestyle" },
  "paw-print":       { icon: PawPrint,       color: "mint",   group: "lifestyle" },
  "shopping-cart":   { icon: ShoppingCart,   color: "mint",   group: "food" },
  "utensils":        { icon: Utensils,       color: "mint",   group: "food" },
  "more-horizontal": { icon: MoreHorizontal, color: "mint",   group: "other" },
  "tag":             { icon: Tag,            color: "mint",   group: "other" },
  "wallet":          { icon: Wallet,         color: "mint",   group: "other" },
};

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
