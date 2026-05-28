const enc = new TextEncoder();

const PBKDF2_PREFIX = "pbkdf2v1:";
const ITERATIONS = 100_000;

async function pbkdf2Hash(userId: string, pin: string): Promise<string> {
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
  const hex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return PBKDF2_PREFIX + hex;
}

async function sha256Hash(userId: string, pin: string): Promise<string> {
  const data = enc.encode(`nest-pin:${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(userId: string, pin: string): Promise<string> {
  return pbkdf2Hash(userId, pin);
}

export async function verifyPin(userId: string, pin: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith(PBKDF2_PREFIX)) {
    const hash = await pbkdf2Hash(userId, pin);
    return hash === storedHash;
  }
  // Legacy SHA-256 path — handles hashes set before PBKDF2 migration
  const hash = await sha256Hash(userId, pin);
  return hash === storedHash;
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith(PBKDF2_PREFIX);
}
