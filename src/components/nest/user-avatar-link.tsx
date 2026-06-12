import { Link } from "@tanstack/react-router";
import { useProfile } from "@/features/profile/use-profile";
import { cn } from "@/lib/utils";

/**
 * UserAvatarLink — circular profile shortcut to /app/settings.
 *
 * Drops into the leftmost slot of every page header. Replaces the "Tú" tab
 * that used to live in the bottom navigation (we moved Settings out of the
 * nav so the bar holds 5 tabs — the sweet spot of every successful fintech
 * app: Revolut, Monzo, N26, Wise, Cash App).
 *
 * Rendering rules:
 *  - If profile.avatar_url is present and loads → show the photo
 *  - If absent or it fails to load → show user initials (first_name + last_name_1,
 *    or the first two parts of full_name as a fallback)
 *  - If we have nothing at all → render "?"  (rare; only on a brand-new account
 *    with no name set)
 *
 * Tap feedback:
 *  - active:scale-95 + 150ms ease-out → tactile confirmation on press
 *  - hover:opacity-90 → desktop hover state
 *  - focus-visible ring → keyboard accessibility
 *  - The destination route (/app/settings) already runs `animate-rise` so the
 *    actual navigation feels professional and smooth — no jarring jump.
 *
 * Size is fixed at 40 × 40 px to match every other circular action button in
 * the headers (NotificationBell, the + Add button, etc.). The tap target is
 * augmented by the `before:` pseudo for users on touch (44 × 44 minimum
 * recommended by WCAG / Apple HIG).
 */
export function UserAvatarLink({ className }: { className?: string }) {
  const { data: profile } = useProfile();

  // Compute initials with two robust fallbacks
  const initials = computeInitials(
    profile?.first_name,
    profile?.last_name_1,
    profile?.full_name,
  );

  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <Link
      to="/app/settings"
      aria-label="Open your profile and settings"
      className={cn(
        // Layout
        "relative size-10 shrink-0 rounded-full overflow-hidden grid place-items-center",
        // Brand surface — initials sit on the inverted brand color for legibility
        "bg-foreground text-background text-sm font-semibold tracking-tight",
        // Definition
        "shadow-soft ring-1 ring-border-subtle",
        // Smooth interaction
        "transition-[transform,opacity,box-shadow] duration-150 ease-out",
        "hover:opacity-90 hover:shadow-card",
        "active:scale-95",
        // Keyboard a11y
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Touch-friendly 44px hit zone without inflating the visible button
        "before:absolute before:-inset-1 before:content-['']",
        className,
      )}
    >
      <span aria-hidden="true" className="select-none">
        {initials}
      </span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Image failed — hide it so the initials underneath become visible.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </Link>
  );
}

/**
 * Pure helper kept separate so it's trivial to unit-test if we ever want to.
 * Always returns at minimum "?" so the visual chip never collapses.
 */
function computeInitials(
  firstName: string | null | undefined,
  lastName1: string | null | undefined,
  fullName: string | null | undefined,
): string {
  if (firstName && lastName1) {
    return `${firstName[0]}${lastName1[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
}
