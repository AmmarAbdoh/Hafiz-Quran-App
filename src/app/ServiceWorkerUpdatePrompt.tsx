import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";

export function ServiceWorkerUpdatePrompt() {
  const { t } = useTranslation("common");
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setUpdateReady(true);
    window.addEventListener("artqiy:sw-update-ready", handleUpdate);
    return () =>
      window.removeEventListener("artqiy:sw-update-ready", handleUpdate);
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex justify-center px-4"
    >
      <div className="flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
        <p className="font-medium text-foreground">
          {t("updateReady.message")}
        </p>
        <Button
          type="button"
          size="sm"
          className="min-h-9"
          onClick={() => window.location.reload()}
        >
          {t("updateReady.reload")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9"
          onClick={() => setUpdateReady(false)}
        >
          {t("actions.close")}
        </Button>
      </div>
    </div>
  );
}
