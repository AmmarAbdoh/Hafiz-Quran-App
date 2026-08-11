import { ExternalLink, Heart, Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";

const dataSources = [
  {
    nameKey: "about.sourceDetails.quranFoundationName",
    url: "https://quran.com",
    useKey: "about.sourceDetails.quranFoundationUse",
    licenseKey: "about.sourceDetails.quranFoundationLicense",
  },
  {
    nameKey: "about.sourceDetails.kfgqpcName",
    url: "https://fonts.qurancomplex.gov.sa",
    useKey: "about.sourceDetails.kfgqpcUse",
    licenseKey: "about.sourceDetails.kfgqpcLicense",
  },
  {
    nameKey: "about.sourceDetails.everyAyahName",
    url: "https://everyayah.com",
    useKey: "about.sourceDetails.everyAyahUse",
    licenseKey: "about.sourceDetails.everyAyahLicense",
  },
  {
    nameKey: "about.sourceDetails.islamicAppName",
    url: "https://islamic.app",
    useKey: "about.sourceDetails.islamicAppUse",
    licenseKey: "about.sourceDetails.islamicAppLicense",
  },
  {
    nameKey: "about.sourceDetails.tanzilName",
    url: "https://tanzil.net",
    useKey: "about.sourceDetails.tanzilUse",
    licenseKey: "about.sourceDetails.tanzilLicense",
  },
  {
    nameKey: "about.sourceDetails.tafsirName",
    url: "https://github.com/spa5k/tafsir_api",
    useKey: "about.sourceDetails.tafsirUse",
    licenseKey: "about.sourceDetails.tafsirLicense",
  },
] as const;

export function AboutPage() {
  const { t } = useTranslation("settings");
  const { t: tA11y } = useTranslation("a11y");

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Landmark aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="mt-5">{t("about.title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-body text-muted-foreground">
          {t("about.description")}
        </p>
      </header>

      <section className="editorial-panel flex items-start gap-4">
        <Heart
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
        />
        <p className="text-sm leading-7">{t("about.gratitude")}</p>
      </section>

      <section aria-labelledby="source-list-title">
        <h2 id="source-list-title">{t("about.sourcesTitle")}</h2>
        <div className="mt-4 grid gap-4">
          {dataSources.map((source) => (
            <article key={source.url} className="editorial-panel">
              <h3>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md text-primary underline-offset-4 hover:underline"
                >
                  <span>{t(source.nameKey)}</span>
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">({tA11y("externalLink")})</span>
                </a>
              </h3>
              <dl className="mt-3 grid gap-3 text-sm leading-6 sm:grid-cols-[7rem_1fr]">
                <dt className="font-semibold text-foreground">
                  {t("about.useLabel")}
                </dt>
                <dd className="text-muted-foreground">{t(source.useKey)}</dd>
                <dt className="font-semibold text-foreground">
                  {t("about.licenseLabel")}
                </dt>
                <dd className="text-muted-foreground">
                  {t(source.licenseKey)}
                </dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-border bg-muted/45 px-4 py-3 text-center text-xs leading-6 text-muted-foreground">
        {t("about.report")}
      </p>
    </div>
  );
}
