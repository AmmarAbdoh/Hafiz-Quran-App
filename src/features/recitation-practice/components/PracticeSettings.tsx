import { useId, useState } from "react";
import { Mic, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { usePracticeModel } from "@/features/recitation-practice/hooks/usePracticeModel";
import { PRACTICE_MODEL_OPTIONS } from "@/features/recitation-practice/model/practiceConfig";
import { clearWhisperModelCache } from "@/features/recitation-practice/services/clearWhisperModelCache";

const modelDisclosure = {
  ar: "عند تفعيل التسميع، يُنزّل النموذج المحدد من Hugging Face ثم يعمل داخل المتصفح.",
  en: "When practice is enabled, the selected model is downloaded from Hugging Face and then runs in your browser.",
} as const;

export function PracticeSettings() {
  const { t } = useTranslation("settings");
  const titleId = useId();
  const { modelId, setModelId } = usePracticeModel();
  const [clearingCache, setClearingCache] = useState(false);

  const clearPracticeModels = async () => {
    setClearingCache(true);
    try {
      await clearWhisperModelCache();
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <section
      className="editorial-panel overflow-hidden"
      aria-labelledby={titleId}
    >
      <header className="flex items-start gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Mic aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id={titleId} className="text-lg font-bold">
            {t("practice.title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("practice.description")}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <Label htmlFor="practice-model-select">
          {t("practice.modelLabel")}
        </Label>
        <select
          id="practice-model-select"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          {Object.entries(PRACTICE_MODEL_OPTIONS).map(([id, model]) => (
            <option key={id} value={id}>
              {model.label}
            </option>
          ))}
        </select>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("practice.localNote")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full justify-between"
          onClick={() => void clearPracticeModels()}
          disabled={clearingCache}
        >
          <span aria-live="polite">
            {clearingCache
              ? t("practice.clearingCache")
              : t("practice.clearCache")}
          </span>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

export function PracticePrivacyDisclosure() {
  const { i18n } = useTranslation("settings");
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ar";

  return (
    <li className="flex gap-2">
      <span aria-hidden="true">•</span>
      <span>{modelDisclosure[locale]}</span>
    </li>
  );
}
