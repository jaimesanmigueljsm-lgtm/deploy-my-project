import { useState } from "react";
import { Bell, CheckCheck, Users, Target, TrendingUp } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { relativeDate } from "@/lib/format";
import { useNotifications, useMarkAllRead, useMarkNotificationRead } from "./use-notifications";
import { useT } from "@/i18n";
import { type NotificationType, notificationRoute } from "./notifications.service";

// ─── Icon per notification type ───────────────────────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === "invite_accepted") return <Users className="size-3.5" />;
  if (type === "contribution_added") return <TrendingUp className="size-3.5" />;
  return <Target className="size-3.5" />;
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unread = notifications.filter((n) => !n.read).length;

  if (isError) {
    // Notifications table may not exist yet in some environments — fail silently.
    return (
      <button className="size-10 rounded-full card-flat grid place-items-center text-muted-foreground hover:text-foreground transition">
        <Bell className="size-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="size-10 rounded-full card-flat grid place-items-center text-muted-foreground hover:text-foreground transition relative"
        aria-label={t("notifications.title")}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-negative" />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-80 card-soft shadow-float rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="text-sm font-semibold">{t("notifications.title")}</span>
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <CheckCheck className="size-3" />
                  {t("notifications.markAllRead")}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {t("notifications.empty")}
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                      void navigate({ to: notificationRoute(n.type) });
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 ${
                      !n.read ? "bg-positive-soft/10" : ""
                    }`}
                  >
                    <div
                      className={`size-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        !n.read
                          ? "bg-positive-soft text-positive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {relativeDate(n.created_at)}
                      </div>
                    </div>
                    {!n.read && (
                      <div className="size-1.5 rounded-full bg-positive shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
