// Biometric authentication provider abstraction.
//
// Current implementation: WebAuthn platform authenticator (works in iOS Safari,
// Android Chrome, Windows Hello, macOS Safari/Chrome).
//
// Future path: swap defaultProvider for a CapacitorBiometricProvider that
// wraps @capacitor-community/biometric-auth — every call-site keeps working
// because the interface stays identical.

import {
  webAuthnRegister,
  webAuthnAuthenticate,
  webAuthnUnregister,
  webAuthnHasCredential,
} from "./webauthn-auth";

export interface BiometricCapabilities {
  webAuthnSupported: boolean;
  platformAuthenticator: boolean;
  nativeFaceId: boolean;
  nativeTouchId: boolean;
  nativeAndroid: boolean;
}

export interface BiometricProvider {
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<BiometricCapabilities>;
  register(userId: string, displayName: string): Promise<boolean>;
  authenticate(userId: string): Promise<boolean>;
  unregister(userId: string): void;
  hasCredential(userId: string): boolean;
}

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
        // not supported
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

  register(userId: string, displayName: string): Promise<boolean> {
    return webAuthnRegister(userId, displayName);
  }

  authenticate(userId: string): Promise<boolean> {
    return webAuthnAuthenticate(userId);
  }

  unregister(userId: string): void {
    webAuthnUnregister(userId);
  }

  hasCredential(userId: string): boolean {
    return webAuthnHasCredential(userId);
  }
}

export const defaultProvider: BiometricProvider = new WebAuthnBiometricProvider();

export async function isBiometricAvailable(): Promise<boolean> {
  return defaultProvider.isAvailable();
}

export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  return defaultProvider.getCapabilities();
}

export function registerBiometric(userId: string, displayName: string): Promise<boolean> {
  return defaultProvider.register(userId, displayName);
}

export function authenticateBiometric(userId: string): Promise<boolean> {
  return defaultProvider.authenticate(userId);
}

export function unregisterBiometric(userId: string): void {
  defaultProvider.unregister(userId);
}

export function hasBiometricCredential(userId: string): boolean {
  return defaultProvider.hasCredential(userId);
}
