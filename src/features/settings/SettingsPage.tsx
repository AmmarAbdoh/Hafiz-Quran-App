import { useState } from "react";
import { Link } from "react-router-dom";
import { Info, Mic, Moon, Sun, Trash2, Volume2 } from "lucide-react";
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import { RECITATION_PRACTICE_ENABLED } from "@/shared/constants/feature-flags";
import {
  PRACTICE_MODEL_OPTIONS,
} from "@/shared/constants/recitation-practice";
import { usePracticeModel } from "@/shared/hooks/use-practice-model";
import { clearWhisperModelCache } from "@/shared/lib/clear-whisper-cache";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { ReciterSelect } from "@/features/settings/components/ReciterSelect";
import { WordByWordLegendDialog } from "@/features/settings/components/WordByWordLegendDialog";
import { DEMO_AYAH_LABEL } from "@/shared/constants/demoAyah";
import { RECITERS } from "@/shared/constants/reciters";
import { useReciter } from "@/shared/hooks/use-reciter";
import { useReciterPreview } from "@/shared/hooks/use-preview-audio";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";

export function SettingsPage() {
  const { reciter, setReciterId } = useReciter();
  const { theme, toggleTheme } = useTheme();
  const { preview, isPreviewPlaying } = useReciterPreview(reciter);
  const [wordByWordGuideOpen, setWordByWordGuideOpen] = useState(false);
  const { modelId, setModelId } = usePracticeModel();
  const [clearingCache, setClearingCache] = useState(false);

  const practiceModelOptions = Object.entries(PRACTICE_MODEL_OPTIONS).map(
    ([value, meta]) => ({
      value,
      label:
        meta.group === "quran" ? `📖 ${meta.label}` : meta.label,
    }),
  );

  const handleClearModelCache = async () => {
    setClearingCache(true);
    try {
      await clearWhisperModelCache();
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تخصيص تجربة القراءة والاستماع
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">القارئ</CardTitle>
          <CardDescription>
            تسجيلات آية بآية من EveryAyah و islamic.app. صوت الكلمة يبقى من
            تسجيل كلمة بكلمة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="reciter-select">اختر القارئ</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-primary"
              onClick={() => setWordByWordGuideOpen(true)}
            >
              <Info className="h-3.5 w-3.5" />
              شرح تمييز كلمة بكلمة
            </Button>
          </div>

          <ReciterSelect
            id="reciter-select"
            value={reciter.id}
            onValueChange={setReciterId}
            onWordHighlightGuideClick={() => setWordByWordGuideOpen(true)}
          />

          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-2"
            onClick={preview}
          >
            <span className="flex min-w-0 flex-1 items-center justify-start gap-2 overflow-hidden whitespace-nowrap text-right">
              <span className="shrink-0 text-sm">استمع للتجربة</span>
              <span className="quran-text min-w-0 truncate font-mushaf text-sm text-muted-foreground">
                {DEMO_AYAH_LABEL}
              </span>
            </span>
            <Volume2
              className={cn(
                "h-4 w-4 shrink-0",
                isPreviewPlaying && "animate-pulse text-primary",
              )}
            />
          </Button>

          <p className="text-xs text-muted-foreground">
            {RECITERS.length} قارئ — تلاوة آية بآية (مجاني). يمكنك أيضاً الضغط
            على أيقونة السماعة بجانب أي قارئ في القائمة.
          </p>
        </CardContent>
      </Card>

      {RECITATION_PRACTICE_ENABLED && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5 text-primary" />
            التسميع (التعرف على الصوت)
          </CardTitle>
          <CardDescription>
            النماذج تعمل محلياً في المتصفح بعد التحميل — الصوت لا يُرسل لخوادم
            Tarteel. نماذج «قرآن — Tarteel» هي نسخ ONNX مجانية من Hugging Face
            (أدق للتلاوة، تحميل أكبر). يحتاج الإنترنت للتحميل الأول فقط.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="practice-model-select">نموذج التعرف على الصوت</Label>
          <SearchableRtlSelect
            id="practice-model-select"
            value={modelId}
            options={practiceModelOptions}
            onValueChange={setModelId}
            searchPlaceholder="ابحث عن نموذج..."
          />
          <p className="text-xs text-muted-foreground">
            {PRACTICE_MODEL_OPTIONS[modelId]?.description}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-2"
            onClick={() => void handleClearModelCache()}
            disabled={clearingCache}
          >
            <span>مسح ذاكرة النماذج المحمّلة</span>
            <Trash2 className="h-4 w-4 shrink-0" />
          </Button>
          <p className="text-xs text-muted-foreground">
            جرّب «قرآن — Tarteel Tiny» أولاً للدقة. التحميل الأول قد يستغرق دقائق
            حسب الإنترنت والجهاز. بعدها يعمل دون اتصال. إن فشل التحميل، امسح
            الذاكرة وجرّب نموذجاً آخر.
          </p>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المظهر</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={toggleTheme}
          >
            <span>الوضع {theme === "dark" ? "الفاتح" : "الداكن"}</span>
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            عن التطبيق والمصادر
          </CardTitle>
          <CardDescription>
            شكر وتقدير لمن جعل هذه الموارد متاحة لخدمة كتاب الله
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" className="w-full" asChild>
            <Link to="/about">عرض المصادر والشكر</Link>
          </Button>
        </CardContent>
      </Card>

      <WordByWordLegendDialog
        open={wordByWordGuideOpen}
        onOpenChange={setWordByWordGuideOpen}
        reciterId={reciter.id}
      />
    </div>
  );
}
