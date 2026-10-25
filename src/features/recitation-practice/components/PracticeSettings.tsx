import { useId, useState } from "react";
import { Mic, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/shared/components/Panel";
import { Switch } from "@/shared/components/Switch";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { NativeSelect } from "@/shared/components/ui/select";
import { usePracticeModel } from "@/features/recitation-practice/hooks/usePracticeModel";
import { usePracticeStrictMode } from "@/features/recitation-practice/hooks/usePracticeStrictMode";
import {
  isStreamingPracticeModel,
  PRACTICE_MODEL_OPTIONS,
  PRACTICE_MODEL_URL,
} from "@/features/recitation-practice/model/practiceConfig";
import { clearWhisperModelCache } from "@/features/recitation-practice/services/clearWhisperModelCache";
import { requestModelReload } from "@/features/recitation-practice/services/modelReload";

/*
 * Where the model actually comes from, which is no longer one answer.
 *
 * The streaming recogniser's weights are gated on Hugging Face, so a browser
 * cannot fetch them from there at all - they are served by whatever hosts the
 * app. Naming Hugging Face for every model told readers on the default one
 * something untrue about where their browser connects.
 */
const modelDisclosure = {
  streaming: {
    ar: "عند تفعيل التسميع، يُنزّل نموذج التعرف من مُضيِّف التطبيق ثم يعمل داخل المتصفح.",
    en: "When practice is enabled, the recogniser is downloaded from this app's own host and then runs in your browser.",
  },
  /* The build can point the weights at another origin, and then "this app's
     own host" is simply false - so that case names the host instead. */
  streamingElsewhere: {
    ar: "عند تفعيل التسميع، يُنزّل نموذج التعرف من {{host}} ثم يعمل داخل المتصفح.",
    en: "When practice is enabled, the recogniser is downloaded from {{host}} and then runs in your browser.",
  },
  huggingFace: {
    ar: "عند تفعيل التسميع، يُنزّل النموذج المحدد من Hugging Face ثم يعمل داخل المتصفح.",
    en: "When practice is enabled, the selected model is downloaded from Hugging Face and then runs in your browser.",
  },
} as const;

/** The origin the weights really come from, or null when it is our own. */
function streamingModelOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(PRACTICE_MODEL_URL, window.location.href);
    return url.origin === window.location.origin ? null : url.origin;
  } catch {
    return null;
  }
}

export function PracticeSettings() {
  const { t } = useTranslation("settings");
  const titleId = useId();
  const { modelId, setModelId } = usePracticeModel();
  const { strictMode, setStrictMode } = usePracticeStrictMode();
  const strictId = useId();
  const [clearingCache, setClearingCache] = useState(false);

  const clearPracticeModels = async () => {
    setClearingCache(true);
    try {
      /*
       * Asked for first, and outside the try that can throw.
       *
       * The streaming model is not in Whisper's cache - it is in the
       * browser's own - so the only way to drop it is to ask the next load
       * to fetch past it. It used to be asked for after the cache had been
       * cleared, which meant a cache that failed to open took the streaming
       * model's reload down with it: the button then did nothing at all for
       * everyone on the default model, which is the one failure it exists to
       * recover from.
       */
      requestModelReload();
      await clearWhisperModelCache();
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <Panel
      as="section"
      variant="flush"
      className="overflow-hidden"
      aria-labelledby={titleId}
    >
      <header className="flex items-start gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Mic aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id={titleId}>{t("practice.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("practice.description")}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <Label htmlFor="practice-model-select">
          {t("practice.modelLabel")}
        </Label>
        <NativeSelect
          id="practice-model-select"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
        >
          {Object.entries(PRACTICE_MODEL_OPTIONS).map(([id, model]) => (
            <option key={id} value={id}>
              {t(`practice.models.${model.key}.label`)}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("practice.localNote")}
        </p>
        <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm leading-6 text-muted-foreground">
          {t("practice.disclaimer")}
        </p>

        <div className="flex items-start justify-between gap-4 border-t border-border/80 pt-5">
          <div>
            <Label htmlFor={strictId}>{t("practice.strictLabel")}</Label>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("practice.strictHint")}
            </p>
          </div>
          <Switch
            id={strictId}
            pressed={strictMode}
            onPressedChange={setStrictMode}
            aria-label={t("practice.strictLabel")}
          />
        </div>
        <Button
          size="lg"
          type="button"
          variant="outline"
          className="w-full justify-between"
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
    </Panel>
  );
}

export function PracticePrivacyDisclosure() {
  const { i18n } = useTranslation("settings");
  const { modelId } = usePracticeModel();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ar";
  const elsewhere = streamingModelOrigin();
  const host = !isStreamingPracticeModel(modelId)
    ? "huggingFace"
    : elsewhere
      ? "streamingElsewhere"
      : "streaming";

  return (
    <li className="flex gap-2">
      <span aria-hidden="true">•</span>
      <span>
        {modelDisclosure[host][locale].replace("{{host}}", elsewhere ?? "")}
      </span>
    </li>
  );
}
