import { TrendingUp, Coins, Bitcoin, Building2, Wallet } from "lucide-react";
import type { InvestmentType } from "@/types/finance";

export const INVESTMENT_TYPE_META: Record<
  InvestmentType,
  { label: string; color: string; icon: typeof Coins }
> = {
  stock: { label: "Stocks", color: "oklch(0.62 0.14 158)", icon: TrendingUp },
  etf: { label: "ETFs", color: "oklch(0.58 0.10 235)", icon: Coins },
  crypto: { label: "Crypto", color: "oklch(0.55 0.16 290)", icon: Bitcoin },
  savings: { label: "Savings", color: "oklch(0.72 0.16 65)", icon: Building2 },
  other: { label: "Other", color: "oklch(0.55 0.04 255)", icon: Wallet },
};
