import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fetchExportData, type ExportData } from "./settings.service";

export function useExportData() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: () => fetchExportData(user!.id),

    onSuccess: (data: ExportData) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nest-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    },

    onError: (err) => toast.error(err instanceof Error ? err.message : "Export failed"),
  });
}
