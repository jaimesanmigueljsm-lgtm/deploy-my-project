// Open Banking integration types.
//
// Normalized over GoCardless Bank Account Data API (bankaccountdata.gocardless.com)
// and Plaid's data model so connector implementations are interchangeable.
//
// Supported institutions (when connectors are implemented):
//   Santander, BBVA, CaixaBank, Sabadell — Spain
//   Revolut, Monzo, Starling — Europe/UK
//   N26, ING — Europe
//   MyInvestor, eToro — Investment platforms

// ─── Institution ─────────────────────────────────────────────────────────────

export interface BankInstitution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  countries: string[]; // ISO 3166-1 alpha-2
  provider: BankingProviderName;
}

export type BankingProviderName = "gocardless" | "plaid" | "mock";

// ─── Connection ───────────────────────────────────────────────────────────────
// Represents one user ↔ institution link.

export type ConnectionStatus =
  | "pending" // OAuth flow started, not yet complete
  | "active" // Access granted, tokens valid
  | "expired" // Consent window elapsed, needs re-auth
  | "revoked" // User or institution revoked access
  | "error"; // Unrecoverable error

export interface BankConnection {
  id: string; // Local UUID
  userId: string;
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  status: ConnectionStatus;
  consentExpiresAt?: number; // epoch ms
  createdAt: number;
  lastSyncedAt?: number;
  providerRef?: string; // GoCardless requisition ID / Plaid item ID
}

// ─── Account ─────────────────────────────────────────────────────────────────

export type AccountType = "current" | "savings" | "investment" | "credit" | "loan" | "other";

export interface NormalizedAccount {
  id: string;
  connectionId: string;
  name: string;
  iban?: string;
  currency: string;
  type: AccountType;
  balances: AccountBalances;
  ownerName?: string;
  institutionName: string;
  lastUpdated: number;
}

export interface AccountBalances {
  available?: number;
  current: number;
  limit?: number;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionStatus = "booked" | "pending";

export interface NormalizedTransaction {
  id: string;
  accountId: string;
  amount: number; // Positive = credit, negative = debit
  currency: string;
  description: string;
  merchantName?: string;
  category?: string; // Auto-classified by connector or AI
  status: TransactionStatus;
  bookedAt?: number; // epoch ms
  valueAt?: number; // epoch ms (when funds move)
  reference?: string; // Bank reference / SEPA end-to-end ID
  counterpartName?: string;
  counterpartIban?: string;
}

// ─── Sync result ─────────────────────────────────────────────────────────────

export interface SyncResult {
  connectionId: string;
  accountsSynced: number;
  transactionsSynced: number;
  errors: string[];
  syncedAt: number;
}
