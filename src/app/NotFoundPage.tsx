import { ArrowLeft, ArrowRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";

export function NotFoundPage() {
  const { t, i18n } = useTranslation("errors");
  const DirectionIcon = i18n.dir() === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <section className="route-state" aria-labelledby="not-found-title">
      <p className="editorial-kicker">404</p>
      <h1 id="not-found-title">
        {t("notFound.title", { defaultValue: "الصفحة غير موجودة" })}
      </h1>
      <p>
        {t("notFound.description", {
          defaultValue: "لم نتمكن من العثور على الصفحة التي طلبتها.",
        })}
      </p>
      <Button asChild size="lg">
        <Link to="/">
          <Home aria-hidden="true" />
          {t("notFound.home", { defaultValue: "العودة إلى الرئيسية" })}
          <DirectionIcon aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
