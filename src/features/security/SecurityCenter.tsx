import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { logSecurityEvent } from "@/lib/security/security-events";
import {
  Smartphone,
  Monitor,
  Tablet,
  Shield,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTrustedDevices, revokeDevice, getDeviceId, type TrustedDevice } from "@/lib/device";
import {
  getSecurityEvents,
  type SecurityEvent,
  type SecurityEventType,
} from "@/lib/security/security-events";
import {
  getBiometricCapabilities,
  registerBiometric,
  unregisterBiometric,
  hasBiometricCredential,
  type BiometricCapabilities,
} from "@/lib/biometric";
import { useAppLock } from "@/features/app-lock/use-app-lock";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Event display metadata ───────────────────────────────────────────────────

const EVENT_META: Record<SecurityEventType, { label: string; icon: typeof Shield; color: string }> =
  {
    login: { label: "Signed in", icon: LogIn, color: "text-positive" },
    logout: { label: "Signed out", icon: LogOut, color: "text-muted-foreground" },
    pin_set: { label: "PIN enabled", icon: Lock, color: "text-positive" },
    pin_changed: { label: "PIN changed", icon: KeyRound, color: "text-sky" },
    pin_removed: { label: "PIN removed", icon: XCircle, color: "text-warn" },
    failed_unlock: { label: "Failed unlock attempt", icon: ShieldAlert, color: "text-warn" },
    lockout_triggered: { label: "Device locked out", icon: AlertTriangle, color: "text-negative" },
    device_trusted: { label: "Device trusted", icon: ShieldCheck, color: "text-positive" },
    device_revoked: { label: "Device revoked", icon: Trash2, color: "text-negative" },
    session_expired: { label: "Session expired", icon: RefreshCw, color: "text-muted-foreground" },
    password_changed: { label: "Password changed", icon: KeyRound, color: "text-sky" },
    biometric_enabled: { label: "Biometrics enabled", icon: Fingerprint, color: "text-positive" },
    biometric_disabled: {
      label: "Biometrics disabled",
      icon: Fingerprint,
      color: "text-muted-foreground",
    },
    offline_unlock: { label: "Unlocked offline", icon: ShieldAlert, color: "text-warn" },
    offline_biometric_unlock: {
      label: "Unlocked offline (biometric)",
      icon: Fingerprint,
      color: "text-warn",
    },
  };

// ─── Device icon ──────────────────────────────────────────────────────────────

function DeviceIcon({ platform, className }: { platform: string; className?: string }) {
  if (/iPhone|iPad/.test(platform)) return <Tablet className={className} />;
  if (/Android/.test(platform)) return <Smartphone className={className} />;
  return <Monitor className={className} />;
}

// ─── Trusted device row ───────────────────────────────────────────────────────

function DeviceRow({
  device,
  onRevoke,
}: {
  device: TrustedDevice;
  onRevoke: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5",
        device.isCurrent && "bg-positive-soft/30",
      )}
    >
      <div
        className={cn(
          "size-9 rounded-xl grid place-items-center shrink-0",
          device.isCurrent ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground",
        )}
      >
        <DeviceIcon platform={device.platform} className="size-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{device.name}</span>
          {device.isCurrent && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-positive-soft text-positive">
              This device
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Last active {relTime(device.lastActiveAt)} · Trusted {relTime(device.trustedAt)}
        </p>
      </div>

      {!device.isCurrent && (
        <button
          onClick={() => onRevoke(device.deviceId)}
          className="shrink-0 size-7 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative-soft transition-colors grid place-items-center"
          aria-label="Revoke device"
        >
          <XCircle className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Security event row ───────────────────────────────────────────────────────

function EventRow({ event }: { event: SecurityEvent }) {
  const meta = EVENT_META[event.type] ?? {
    label: event.type,
    icon: Shield,
    color: "text-muted-foreground",
  };
  const Icon = meta.icon;
  const isCurrentDevice = event.deviceId === getDeviceId();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="size-7 rounded-lg bg-muted grid place-items-center shrink-0">
        <Icon className={cn("size-3.5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium">{meta.label}</span>
        {isCurrentDevice && (
          <span className="ml-1.5 text-[10px] text-muted-foreground">· This device</span>
        )}
        <p className="text-[11px] text-muted-foreground">{relTime(event.ts)}</p>
      </div>
    </div>
  );
}

// ─── Biometric toggle (interactive) ───────────────────────────────────────────

function BiometricToggle({
  uid,
  caps,
  isPinSet,
}: {
  uid: string;
  caps: BiometricCapabilities | null;
  isPinSet: boolean;
}) {
  const { meta, updateMeta } = useAppLock();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(!!meta.biometricEnabled);

  useEffect(() => {
    setEnabled(!!meta.biometricEnabled && hasBiometricCredential(uid));
  }, [uid, meta.biometricEnabled]);

  if (!caps) return null;

  const available =
    caps.platformAuthenticator || caps.nativeFaceId || caps.nativeTouchId || caps.nativeAndroid;

  async function handleEnable() {
    if (!isPinSet) {
      toast.error(t("security.biometric.pinFirst"));
      return;
    }
    setBusy(true);
    try {
      const ok = await registerBiometric(uid, "Nooly user");
      if (!ok) {
        toast.error(t("security.biometric.enableFailed"));
        return;
      }
      updateMeta({ biometricEnabled: true });
      setEnabled(true);
      logSecurityEvent(uid, "biometric_enabled");
      toast.success(t("security.biometric.enabled"));
    } catch (e) {
      console.warn("[biometric register] failed:", e);
      toast.error(t("security.biometric.enableFailed"));
    } finally {
      setBusy(false);
    }
  }

  function handleDisable() {
    if (!confirm(t("security.biometric.disableConfirm"))) return;
    unregisterBiometric(uid);
    updateMeta({ biometricEnabled: false });
    setEnabled(false);
    logSecurityEvent(uid, "biometric_disabled");
    toast.success(t("security.biometric.disabled"));
  }

  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <div
        className={cn(
          "size-9 rounded-xl grid place-items-center shrink-0",
          enabled
            ? "bg-positive-soft text-positive"
            : available
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-muted-foreground/60",
        )}
      >
        <Fingerprint className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{t("security.biometric.title")}</span>
          {enabled && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-positive-soft text-positive">
              {t("security.biometric.active")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {!available
            ? t("security.biometric.unsupported")
            : enabled
              ? t("security.biometric.enabledHint")
              : t("security.biometric.availableHint")}
        </p>
      </div>
      {available && (
        <button
          onClick={enabled ? handleDisable : handleEnable}
          disabled={busy || (!enabled && !isPinSet)}
          className={cn(
            "shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors",
            enabled
              ? "bg-negative-soft text-negative hover:bg-negative-soft/80"
              : "bg-positive text-positive-foreground hover:opacity-90 disabled:opacity-50",
          )}
        >
          {busy
            ? t("security.biometric.activating")
            : enabled
              ? t("security.biometric.disable")
              : t("security.biometric.enable")}
        </button>
      )}
    </div>
  );
}

// ─── SecurityCenter ───────────────────────────────────────────────────────────

export function SecurityCenter({ uid, isPinSet }: { uid: string; isPinSet: boolean }) {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [bioCaps, setBioCaps] = useState<BiometricCapabilities | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setDevices(getTrustedDevices(uid));
    setEvents(getSecurityEvents(uid));
    void getBiometricCapabilities().then(setBioCaps);
  }, [uid]);

  function handleRevoke(deviceId: string) {
    revokeDevice(uid, deviceId);
    setDevices(getTrustedDevices(uid));
  }

  const visibleEvents = showAllEvents ? events : events.slice(0, 5);
  const hasDevices = devices.length > 0;

  return (
    <div className="space-y-5 animate-rise">
      {/* PIN status */}
      <div className="card-flat overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            App Protection
          </p>
        </div>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div
            className={cn(
              "size-9 rounded-xl grid place-items-center shrink-0",
              isPinSet ? "bg-positive-soft text-positive" : "bg-warn-soft text-warn",
            )}
          >
            <Lock className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">PIN lock</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isPinSet ? "Active — app is protected" : "Not set — app is unprotected"}
            </p>
          </div>
          {isPinSet ? (
            <CheckCircle2 className="size-4 text-positive shrink-0" />
          ) : (
            <AlertTriangle className="size-4 text-warn shrink-0" />
          )}
        </div>
        <BiometricToggle uid={uid} caps={bioCaps} isPinSet={isPinSet} />
      </div>

      {/* Trusted devices */}
      <div className="card-flat overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Trusted Devices
          </p>
          <span className="text-[11px] text-muted-foreground">
            {devices.length} device{devices.length !== 1 ? "s" : ""}
          </span>
        </div>

        {hasDevices ? (
          <div className="divide-y divide-border-subtle">
            {devices.map((d) => (
              <DeviceRow key={d.deviceId} device={d} onRevoke={handleRevoke} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <Shield className="size-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No trusted devices yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Devices are registered when you unlock the app
            </p>
          </div>
        )}
      </div>

      {/* Security events */}
      <div className="card-flat overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Recent Activity
          </p>
          <span className="text-[11px] text-muted-foreground">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        </div>

        {events.length > 0 ? (
          <>
            <div className="divide-y divide-border-subtle">
              {visibleEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
            {events.length > 5 && (
              <button
                onClick={() => setShowAllEvents((v) => !v)}
                className="w-full py-3 text-xs text-muted-foreground hover:text-foreground transition text-center"
              >
                {showAllEvents ? "Show less" : `Show ${events.length - 5} more`}
              </button>
            )}
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <Shield className="size-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
