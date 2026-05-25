import { useState } from "react";
import { Bug, Lightbulb, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FeedbackType = "bug" | "suggestion" | "general";

const TYPES: { key: FeedbackType; Icon: typeof Bug; label: string }[] = [
  { key: "bug",        Icon: Bug,            label: "Bug" },
  { key: "suggestion", Icon: Lightbulb,       label: "Idea" },
  { key: "general",   Icon: MessageSquare,   label: "General" },
];

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug:        "Describe what happened and how to reproduce it…",
  suggestion: "What would you like to see in Nest?",
  general:    "Share your thoughts about your Nest experience…",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BetaFeedbackModal({ open, onClose }: Props) {
  const [type, setType]       = useState<FeedbackType>("general");
  const [text, setText]       = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    onClose();
    // Reset after animation completes
    setTimeout(() => { setSubmitted(false); setText(""); setType("general"); }, 300);
  }

  function submit() {
    if (!text.trim()) return;
    // TODO: persist to Supabase feedback table or webhook
    setSubmitted(true);
    setTimeout(handleClose, 1600);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Beta feedback</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center animate-scale-in">
            <div className="size-12 rounded-2xl bg-positive-soft grid place-items-center mx-auto mb-3">
              <MessageSquare className="size-5 text-positive" />
            </div>
            <p className="font-semibold text-sm">Thanks for your feedback!</p>
            <p className="text-xs text-muted-foreground mt-1">It helps us build a better Nest.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2">
              {TYPES.map(({ key, Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                    type === key
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDERS[type]}
              rows={4}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-surface resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20 placeholder:text-muted-foreground leading-relaxed"
            />

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button onClick={submit} disabled={!text.trim()} className="flex-1">Send</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
