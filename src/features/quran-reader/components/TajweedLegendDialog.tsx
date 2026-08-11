import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { TAJWEED_LEGEND } from "@/domain/quran";

interface TajweedLegendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TajweedLegendDialog({
  open,
  onOpenChange,
}: TajweedLegendDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const translatedRules: Record<
    string,
    { label: string; description: string }
  > = {
    sakin: {
      label: t("tajweed.rules.sakin.label"),
      description: t("tajweed.rules.sakin.description"),
    },
    "madd-2": {
      label: t("tajweed.rules.madd2.label"),
      description: t("tajweed.rules.madd2.description"),
    },
    "madd-munfasil": {
      label: t("tajweed.rules.maddMunfasil.label"),
      description: t("tajweed.rules.maddMunfasil.description"),
    },
    "madd-muttasil": {
      label: t("tajweed.rules.maddMuttasil.label"),
      description: t("tajweed.rules.maddMuttasil.description"),
    },
    "madd-lazim": {
      label: t("tajweed.rules.maddLazim.label"),
      description: t("tajweed.rules.maddLazim.description"),
    },
    ghunnah: {
      label: t("tajweed.rules.ghunnah.label"),
      description: t("tajweed.rules.ghunnah.description"),
    },
    qalqalah: {
      label: t("tajweed.rules.qalqalah.label"),
      description: t("tajweed.rules.qalqalah.description"),
    },
    tafkheem: {
      label: t("tajweed.rules.tafkheem.label"),
      description: t("tajweed.rules.tafkheem.description"),
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="max-h-[85vh] max-w-md overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("tajweed.guideTitle")}</DialogTitle>
          <DialogDescription>{t("tajweed.guideDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3">
          {TAJWEED_LEGEND.map((rule) => {
            const translatedRule = translatedRules[rule.id];
            return (
              <li
                key={rule.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <span
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-black/10 shadow-sm dark:border-white/10"
                  style={{ backgroundColor: rule.color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-body font-medium leading-snug">
                    {translatedRule?.label ?? rule.label}
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {translatedRule?.description ?? rule.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
