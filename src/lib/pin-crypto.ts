const enc = new TextEncoder();

const PBKDF2_V1_PREFIX = "pbkdf2v1:";
const PBKDF2_V2_PREFIX = "pbkdf2v2:";
const ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pbkdf2HashV1(userId: string, pin: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(`nest-pin-salt:${userId}`),
      iterations: ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return PBKDF2_V1_PREFIX + toHex(bits);
}

// v2 uses a random 32-byte salt stored alongside the hash: "pbkdf2v2:<saltHex>:<hashHex>"
async function pbkdf2HashV2(pin: string, salt?: Uint8Array): Promise<string> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(32));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    // @ts-ignore - TypeScript incorrectly infers ArrayBufferLike instead of ArrayBuffer for crypto.getRandomValues
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: ITERATIONS },
    keyMaterial,
    256,
  );
  return PBKDF2_V2_PREFIX + toHex(saltBytes) + ":" + toHex(bits);
}

async function sha256Hash(userId: string, pin: string): Promise<string> {
  const data = enc.encode(`nest-pin:${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(buf);
}

export async function hashPin(_userId: string, pin: string): Promise<string> {
  return pbkdf2HashV2(pin);
}

export async function verifyPin(userId: string, pin: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith(PBKDF2_V2_PREFIX)) {
    const rest = storedHash.slice(PBKDF2_V2_PREFIX.length);
    const colonIdx = rest.indexOf(":");
    if (colonIdx === -1) return false;
    const saltHex = rest.slice(0, colonIdx);
    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const candidate = await pbkdf2HashV2(pin, saltBytes);
    return candidate === storedHash;
  }
  if (storedHash.startsWith(PBKDF2_V1_PREFIX)) {
    const hash = await pbkdf2HashV1(userId, pin);
    return hash === storedHash;
  }
  // Legacy SHA-256 path
  const hash = await sha256Hash(userId, pin);
  return hash === storedHash;
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith(PBKDF2_V2_PREFIX);
}
