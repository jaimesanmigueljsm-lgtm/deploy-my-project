// Biometric authentication provider abstraction.
//
// Current implementation: WebAuthn platform authenticator detection.
// Works today in: Safari (Touch ID / Face ID), Chrome on Windows Hello,
// Chrome on Android (fingerprint / face), Edge.
//
// Future path: swap `defaultProvider` for a CapacitorBiometricProvider
// without touching any call-sites — the interface stays identical.

export interface BiometricCapabilities {
  webAuthnSupported: boolean;
  platformAuthenticator: boolean;
  // Populated by a native Capacitor plugin — false until then
  nativeFaceId: boolean;
  nativeTouchId: boolean;
  nativeAndroid: boolean;
}

// The interface every provider must implement.
// Adding Capacitor: implement this interface and set defaultProvider below.
export interface BiometricProvider {
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<BiometricCapabilities>;
}

// ─── WebAuthn implementation ──────────────────────────────────────────────────

class WebAuthnBiometricProvider implements BiometricProvider {
  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async getCapabilities(): Promise<BiometricCapabilities> {
    const webAuthnSupported = typeof window !== "undefined" && !!window.PublicKeyCredential;
    let platformAuthenticator = false;
    if (webAuthnSupported) {
      try {
        platformAuthenticator =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        /* not supported */
      }
    }
    return {
      webAuthnSupported,
      platformAuthenticator,
      nativeFaceId: false,
      nativeTouchId: false,
      nativeAndroid: false,
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const defaultProvider: BiometricProvider = new WebAuthnBiometricProvider();

export async function isBiometricAvailable(): Promise<boolean> {
  return defaultProvider.isAvailable();
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  return defaultProvider.getCapabilities();
}
