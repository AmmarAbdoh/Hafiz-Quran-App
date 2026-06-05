import { Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const DATA_SOURCES = [
  {
    name: "Quran.com / Quran Foundation",
    use: "تخطيط المصحف كلمة بكلمة، خطوط QCF، وتسجيلات الكلمات",
    url: "https://quran.com",
    license: "محتوى مرخّص بشروط Quran Foundation — للاستخدام في تطبيقات قرآنية",
  },
  {
    name: "مجمع الملك فهد لطباعة المصحف (KFGQPC)",
    use: "خطوط المصحف العثماني (QCF)",
    url: "https://fonts.qurancomplex.gov.sa",
    license: "مجاني للاستخدام مع نسبة المصدر — لا يجوز تعديل الخط أو بيعه",
  },
  {
    name: "EveryAyah.com",
    use: "أغلب تسجيلات تلاوة الآيات (آية بآية)",
    url: "https://everyayah.com",
    license: "تسجيلات طرف ثالث — للاستماع داخل التطبيق مع ذكر المصدر",
  },
  {
    name: "islamic.app",
    use: "قارئون إضافيون وتلاوات بلغات أخرى (آية بآية)",
    url: "https://islamic.app",
    license: "CDN مجاني للاستماع — مع نسبة المصدر",
  },
  {
    name: "Tanzil Project",
    use: "نص القرآن (حيث ينطبق على البيانات المستخدمة)",
    url: "https://tanzil.net",
    license: "Creative Commons Attribution 3.0 — نسخ حرفي دون تعديل النص",
  },
  {
    name: "مشاريع التفسير (Tafseer API وغيرها)",
    use: "نصوص التفاسير المعروضة في التطبيق",
    url: "https://github.com/spa5k/tafsir_api",
    license: "نصوص التفسير محمية بحقوق مؤلفيها — للعرض داخل التطبيق فقط",
  },
] as const;

export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">عن حافظ القرآن</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          تطبيق مجاني غير تجاري لخدمة من يريد قراءة القرآن وحفظه ومراجعته.
          لا نبيع المحتوى ولا نعرض إعلانات على صفحات المصحف.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Heart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed">
            جزى الله خيراً كل من ساهم في إتاحة هذه الموارد لنشر كتاب الله.
            هذا التطبيق يجمعها في واجهة واحدة لمساعدة الحفاظ والقراء.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">المصادر والشكر</h2>
        {DATA_SOURCES.map((source) => (
          <Card key={source.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {source.name}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">الاستخدام: </span>
                {source.use}
              </p>
              <p>
                <span className="font-medium text-foreground">الترخيص: </span>
                {source.license}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        إن وجدت خطأً في النص أو التلاوة، نرجو إبلاغنا — والله المستعان.
      </p>
    </div>
  );
}
