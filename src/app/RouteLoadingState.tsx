import { useTranslation } from "react-i18next";

export function RouteLoadingState() {
  const { t } = useTranslation("common");

  return (
    <div className="route-state" role="status" aria-live="polite">
      <span className="route-state__mark" aria-hidden="true">
        ۞
      </span>
      <p>{t("loading", { defaultValue: "جارٍ التحميل…" })}</p>
    </div>
  );
}
