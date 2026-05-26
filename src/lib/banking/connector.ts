// Banking connector abstraction layer.
//
// Each provider (GoCardless, Plaid, Mock) implements BankingConnector.
// The registry pattern lets the app discover connectors without importing them all.
//
// Implementation guide:
//   1. Create src/lib/banking/providers/gocardless.ts implementing BankingConnector
//   2. Register it: connectorRegistry.register("gocardless", new GoCardlessConnector(...))
//   3. Trigger an OAuth flow: connector.initiateAuth(userId, institutionId, redirectUrl)
//   4. After redirect: connector.exchangeCode(userId, code) → BankConnection
//   5. Sync: connector.syncAccounts(connection) + connector.syncTransactions(account, ...)

import type {
  BankConnection,
  BankInstitution,
  BankingProviderName,
  NormalizedAccount,
  NormalizedTransaction,
  SyncResult,
} from "./types";

// ─── Connector interface ──────────────────────────────────────────────────────

export interface BankingConnector {
  readonly provider: BankingProviderName;

  // Returns the list of supported institutions
  getInstitutions(countryCode?: string): Promise<BankInstitution[]>;

  // Step 1: Start the OAuth/redirect flow — returns the URL to open
  initiateAuth(userId: string, institutionId: string, redirectUrl: string): Promise<string>;

  // Step 2: Exchange the code/requisition from the redirect callback
  exchangeCode(userId: string, code: string): Promise<BankConnection>;

  // Refresh a connection before it expires
  refreshConnection(connection: BankConnection): Promise<BankConnection>;

  // Fetch accounts for a live connection
  syncAccounts(connection: BankConnection): Promise<NormalizedAccount[]>;

  // Fetch transactions for an account within a date window
  syncTransactions(
    account: NormalizedAccount,
    from: string, // ISO date YYYY-MM-DD
    to: string,
  ): Promise<NormalizedTransaction[]>;

  // Full sync — accounts + transactions — returns a summary
  sync(connection: BankConnection, from: string, to: string): Promise<SyncResult>;

  // Revoke the connection (calls the provider's revocation endpoint)
  revokeConnection(connection: BankConnection): Promise<void>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

class BankingConnectorRegistry {
  private readonly connectors = new Map<BankingProviderName, BankingConnector>();

  register(connector: BankingConnector): void {
    this.connectors.set(connector.provider, connector);
  }

  get(provider: BankingProviderName): BankingConnector | undefined {
    return this.connectors.get(provider);
  }

  getAll(): BankingConnector[] {
    return Array.from(this.connectors.values());
  }

  isRegistered(provider: BankingProviderName): boolean {
    return this.connectors.has(provider);
  }
}

export const connectorRegistry = new BankingConnectorRegistry();

// ─── Mock connector (development / demo) ─────────────────────────────────────

export class MockBankingConnector implements BankingConnector {
  readonly provider: BankingProviderName = "mock";

  async getInstitutions(): Promise<BankInstitution[]> {
    return [
      { id: "mock_santander_es", name: "Santander", countries: ["ES"], provider: "mock" },
      { id: "mock_bbva_es", name: "BBVA", countries: ["ES"], provider: "mock" },
      {
        id: "mock_revolut",
        name: "Revolut",
        countries: ["ES", "GB", "DE", "FR"],
        provider: "mock",
      },
      { id: "mock_n26", name: "N26", countries: ["ES", "DE", "FR"], provider: "mock" },
    ];
  }

  async initiateAuth(
    _userId: string,
    _institutionId: string,
    redirectUrl: string,
  ): Promise<string> {
    return `${redirectUrl}?code=mock_code_12345`;
  }

  async exchangeCode(userId: string, _code: string): Promise<BankConnection> {
    return {
      id: crypto.randomUUID(),
      userId,
      institutionId: "mock_santander_es",
      institutionName: "Santander (Demo)",
      status: "active",
      consentExpiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
      lastSyncedAt: Date.now(),
      providerRef: "mock_req_123",
    };
  }

  async refreshConnection(connection: BankConnection): Promise<BankConnection> {
    return { ...connection, status: "active", lastSyncedAt: Date.now() };
  }

  async syncAccounts(connection: BankConnection): Promise<NormalizedAccount[]> {
    return [
      {
        id: `${connection.id}_acc_1`,
        connectionId: connection.id,
        name: "Current Account",
        iban: "ES91 2100 0418 4502 0005 1332",
        currency: "EUR",
        type: "current",
        balances: { available: 2840.5, current: 2840.5 },
        institutionName: connection.institutionName,
        lastUpdated: Date.now(),
      },
    ];
  }

  async syncTransactions(
    _account: NormalizedAccount,
    _from: string,
    _to: string,
  ): Promise<NormalizedTransaction[]> {
    return [];
  }

  async sync(connection: BankConnection, from: string, to: string): Promise<SyncResult> {
    const accounts = await this.syncAccounts(connection);
    const txns = await Promise.all(accounts.map((a) => this.syncTransactions(a, from, to)));
    return {
      connectionId: connection.id,
      accountsSynced: accounts.length,
      transactionsSynced: txns.flat().length,
      errors: [],
      syncedAt: Date.now(),
    };
  }

  async revokeConnection(_connection: BankConnection): Promise<void> {
    /* no-op for mock */
  }
}
