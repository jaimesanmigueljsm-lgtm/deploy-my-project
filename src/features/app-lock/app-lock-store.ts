export interface LockMeta {
  failedCount: number;
  lockoutUntil: number; // epoch ms; 0 = not locked out
  lastActiveAt: number; // epoch ms when app was last visible; 0 = never
  autoLockMs: number; // -1=immediately, 0=never, >0=ms threshold
  hideBalances: boolean;
  biometricEnabled: boolean;
}

const DEFAULT_META: LockMeta = {
  failedCount: 0,
  lockoutUntil: 0,
  lastActiveAt: 0,
  autoLockMs: 300_000,
  hideBalances: false,
  biometricEnabled: false,
};

const safe = typeof window !== "undefined";
const PIN_KEY = (uid: string) => `nest.pin_hash.${uid}`;
const META_KEY = (uid: string) => `nest.lock_meta.${uid}`;
const PROMPTED_KEY = (uid: string) => `nest.pin_prompted.${uid}`;

export const pinStore = {
  read: (uid: string): string | null => {
    if (!safe) return null;
    try {
      return localStorage.getItem(PIN_KEY(uid));
    } catch {
      return null;
    }
  },
  write: (uid: string, hash: string) => {
    if (!safe) return;
    try {
      localStorage.setItem(PIN_KEY(uid), hash);
      // eslint-disable-next-line no-empty
    } catch {}
  },
  clear: (uid: string) => {
    if (!safe) return;
    try {
      localStorage.removeItem(PIN_KEY(uid));
      // eslint-disable-next-line no-empty
    } catch {}
  },
};

export const metaStore = {
  read: (uid: string): LockMeta => {
    if (!safe) return { ...DEFAULT_META };
    try {
      const raw = localStorage.getItem(META_KEY(uid));
      return raw
        ? { ...DEFAULT_META, ...(JSON.parse(raw) as Partial<LockMeta>) }
        : { ...DEFAULT_META };
    } catch {
      return { ...DEFAULT_META };
    }
  },
  write: (uid: string, patch: Partial<LockMeta>) => {
    if (!safe) return;
    try {
      const cur = metaStore.read(uid);
      localStorage.setItem(META_KEY(uid), JSON.stringify({ ...cur, ...patch }));
      // eslint-disable-next-line no-empty
    } catch {}
  },
};

export const promptStore = {
  wasShown: (uid: string): boolean => {
    if (!safe) return false;
    try {
      return !!localStorage.getItem(PROMPTED_KEY(uid));
    } catch {
      return false;
    }
  },
  markShown: (uid: string) => {
    if (!safe) return;
    try {
      localStorage.setItem(PROMPTED_KEY(uid), "1");
      // eslint-disable-next-line no-empty
    } catch {}
  },
};
