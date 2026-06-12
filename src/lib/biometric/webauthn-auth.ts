/**
 * webauthn-auth.ts — Real WebAuthn registration + authentication for app lock.
 *
 * Local-only WebAuthn flow (no server roundtrip): we use the WebAuthn API
 * purely as a biometric prompt that grants access. The platform authenticator
 * (Touch ID, Face ID, Windows Hello, Android fingerprint) verifies the user
 * and unlocks a credential we created at registration time.
 *
 * When the app moves to Capacitor + native plugin, swap the `defaultProvider`
 * in ./index.ts and these functions are no longer called — every call-site
 * uses the high-level `authenticateBiometric()` re-export from ./index.ts.
 *
 * Security notes:
 *   · `userVerification: "required"` forces the platform to actually run
 *     biometric (or trusted PIN — but most users have biometric set up).
 *   · `authenticatorAttachment: "platform"` rules out roaming authenticators
 *     (YubiKey, etc.) so the credential is tied to this specific device.
 *   · The credential ID is stored in localStorage namespaced by user — if the
 *     user signs out and signs back in with another account, biometrics for
 *     that other account are tracked independently.
 *
 * Browser support: works in Safari (Touch/Face ID), Chrome on Android
 * (fingerprint/face), Edge with Windows Hello, Firefox on Android.
 */

const STORAGE_KEY = (userId: string) => `nooly.biometric.${userId}`;

interface StoredCredential {
  credentialId: string; // base64url-encoded raw credential ID
  createdAt: number;
}

// ─── base64url helpers ───────────────────────────────────────────────────────

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  const raw = atob(padded);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

// ─── Public API (low-level — use the re-exports from ./index.ts) ────────────

/**
 * Register a new biometric credential for the given user. Triggers the OS
 * prompt (Face ID / Touch ID / fingerprint) and saves the credential ID
 * locally so subsequent unlocks can target it.
 *
 * Returns `true` on success, `false` if the user cancelled or the platform
 * doesn't support platform authenticators.
 */
export async function webAuthnRegister(userId: string, displayName: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Nooly" },
        user: {
          id: new TextEncoder().encode(userId),
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    const credentialId = bufferToBase64Url(credential.rawId);
    const stored: StoredCredential = { credentialId, createdAt: Date.now() };
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(stored));
    return true;
  } catch (e) {
    // User cancelled, NotSupportedError, or the platform rejected.
    // Reasons we silence rather than throw: prompt cancellation is normal UX.
    console.warn("[biometric] register failed:", e);
    return false;
  }
}

/**
 * Trigger the biometric prompt and verify against the stored credential.
 * Returns `true` only if the user successfully verified with biometric.
 *
 * Returns `false` if:
 *   - No credential registered for this user
 *   - User cancelled the prompt
 *   - Biometric mismatch
 *   - Browser doesn't support WebAuthn
 */
export async function webAuthnAuthenticate(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;

  const stored = localStorage.getItem(STORAGE_KEY(userId));
  if (!stored) return false;

  try {
    const { credentialId } = JSON.parse(stored) as StoredCredential;
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64UrlToBuffer(credentialId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    return credential !== null;
  } catch (e) {
    console.warn("[biometric] authenticate failed:", e);
    return false;
  }
}

/** Remove the locally stored credential reference. */
export function webAuthnUnregister(userId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY(userId));
  } catch {
    /* no-op */
  }
}

/** True when the user has at least one credential registered locally. */
export function webAuthnHasCredential(userId: string): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY(userId));
  } catch {
    return false;
  }
}
