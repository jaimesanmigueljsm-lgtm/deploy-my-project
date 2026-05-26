const enc = new TextEncoder();

/**
 * SHA-256 hash of `nest-pin:{userId}:{pin}`.
 * The userId acts as a per-user salt so hashes are not portable across accounts.
 */
export async function hashPin(userId: string, pin: string): Promise<string> {
  const data = enc.encode(`nest-pin:${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(userId: string, pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(userId, pin);
  return hash === storedHash;
}
