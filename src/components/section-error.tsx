import { RotateCcw } from "lucide-react";
import { Sentry } from "@/lib/sentry";

export function SectionError({ error, reset }: { error: Error; reset: () => void }) {
  Sentry.captureException(error);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This section couldn't load. Your data is safe.
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:opacity-80"
      >
        <RotateCcw className="size-3" />
        Try again
      </button>
    </div>
  );
}
