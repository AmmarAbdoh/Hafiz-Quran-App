import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TAJWEED_LEGEND } from "@/domain/quran";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface TajweedColorLegendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLegendGuide: () => void;
}

export function TajweedColorLegendDialog({
  open,
  onOpenChange,
  onOpenLegendGuide,
}: TajweedColorLegendDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");

  const ruleLabels: Record<string, string> = {
    sakin: t("tajweed.rules.sakin.label"),
    "madd-2": t("tajweed.rules.madd2.label"),
    "madd-munfasil": t("tajweed.rules.maddMunfasil.label"),
    "madd-muttasil": t("tajweed.rules.maddMuttasil.label"),
    "madd-lazim": t("tajweed.rules.maddLazim.label"),
    ghunnah: t("tajweed.rules.ghunnah.label"),
    qalqalah: t("tajweed.rules.qalqalah.label"),
    tafkheem: t("tajweed.rules.tafkheem.label"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon("actions.close")} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tajweed.meaning")}</DialogTitle>
          <DialogDescription>{t("tajweed.detailsShort")}</DialogDescription>
        </DialogHeader>

        <ul className="grid gap-3">
          {TAJWEED_LEGEND.map((rule) => (
            <li
              key={rule.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
            >
              <span
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-sm dark:border-white/10"
                style={{ backgroundColor: rule.color }}
                aria-hidden
              />
              <span className="text-caption leading-snug text-foreground">
                {ruleLabels[rule.id] ?? rule.label}
              </span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2"
          onClick={() => {
            onOpenChange(false);
            onOpenLegendGuide();
          }}
        >
          <Info aria-hidden="true" className="h-4 w-4" />
          {t("tajweed.details")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
