import {
  Target,
  Home,
  Car,
  Plane,
  GraduationCap,
  Gift,
  Heart,
  Briefcase,
  PiggyBank,
} from "lucide-react";

export const GOAL_ICONS = {
  target: { icon: Target, label: "Generic" },
  home: { icon: Home, label: "Home" },
  car: { icon: Car, label: "Car" },
  plane: { icon: Plane, label: "Travel" },
  edu: { icon: GraduationCap, label: "Education" },
  gift: { icon: Gift, label: "Gift" },
  heart: { icon: Heart, label: "Wedding" },
  work: { icon: Briefcase, label: "Business" },
  piggy: { icon: PiggyBank, label: "Emergency" },
} as const;

export type GoalIconKey = keyof typeof GOAL_ICONS;

export const GOAL_COLORS = {
  mint: { bg: "bg-positive-soft", text: "text-positive", ring: "var(--positive)" },
  sky: { bg: "bg-sky/15", text: "text-sky", ring: "var(--sky)" },
  warn: { bg: "bg-warn-soft", text: "text-warn", ring: "var(--warn)" },
  violet: { bg: "bg-violet-soft", text: "text-violet", ring: "var(--violet)" },
} as const;

export type GoalColorKey = keyof typeof GOAL_COLORS;
