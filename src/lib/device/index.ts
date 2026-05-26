// Device fingerprinting and trusted-device management.
// All state lives in localStorage — no PII, no server round-trips.
// Architecture is ready for backend sync when needed (just swap the storage layer).

const DEVICE_ID_KEY = "nooly.device_id";
const TRUSTED_KEY = (uid: string) => `nooly.trusted_devices.${uid}`;

export interface DeviceInfo {
  deviceId: string;
  name: string;
  platform: string;
  browser: string;
  createdAt: number;
}

export interface TrustedDevice {
  deviceId: string;
  name: string;
  platform: string;
  browser: string;
  trustedAt: number;
  lastActiveAt: number;
  isCurrent: boolean;
}

// ─── Device ID ────────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

// ─── Platform detection ───────────────────────────────────────────────────────

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

function detectPlatform(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = detectPlatform(ua);
  const browser = detectBrowser(ua);
  return {
    deviceId: getDeviceId(),
    name: `${browser} on ${platform}`,
    platform,
    browser,
    createdAt: Date.now(),
  };
}

// ─── Trusted devices ──────────────────────────────────────────────────────────

export function getTrustedDevices(uid: string): TrustedDevice[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(TRUSTED_KEY(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrustedDevice[];
    const currentId = getDeviceId();
    return parsed.map((d) => ({ ...d, isCurrent: d.deviceId === currentId }));
  } catch {
    return [];
  }
}

export function trustCurrentDevice(uid: string): TrustedDevice {
  const info = getDeviceInfo();
  const existing = getTrustedDevices(uid).filter((d) => d.deviceId !== info.deviceId);
  const device: TrustedDevice = {
    deviceId: info.deviceId,
    name: info.name,
    platform: info.platform,
    browser: info.browser,
    trustedAt: Date.now(),
    lastActiveAt: Date.now(),
    isCurrent: true,
  };
  const updated = [device, ...existing].slice(0, 10);
  try {
    localStorage.setItem(TRUSTED_KEY(uid), JSON.stringify(updated));
  } catch {} // eslint-disable-line no-empty
  return device;
}

export function revokeDevice(uid: string, deviceId: string): void {
  const updated = getTrustedDevices(uid).filter((d) => d.deviceId !== deviceId);
  try {
    localStorage.setItem(TRUSTED_KEY(uid), JSON.stringify(updated));
  } catch {} // eslint-disable-line no-empty
}

export function isCurrentDeviceTrusted(uid: string): boolean {
  const currentId = getDeviceId();
  return getTrustedDevices(uid).some((d) => d.deviceId === currentId);
}

export function updateDeviceLastActive(uid: string): void {
  const currentId = getDeviceId();
  const devices = getTrustedDevices(uid).map((d) =>
    d.deviceId === currentId ? { ...d, lastActiveAt: Date.now() } : d,
  );
  try {
    localStorage.setItem(TRUSTED_KEY(uid), JSON.stringify(devices));
  } catch {} // eslint-disable-line no-empty
}
