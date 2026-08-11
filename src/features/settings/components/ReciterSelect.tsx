import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/app/i18n";
import {
  DEMO_AYAH,
  DEMO_SURAH,
  RECITERS,
  getAyahAudioUrl,
  getReciterById,
  getRecitersByCategory,
  supportsAyahWordHighlight,
  type ReciterCategory,
  type ReciterOption,
  usePreviewAudio,
} from "@/domain/quran";
import { Input } from "@/shared/components/ui/input";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import { cn } from "@/shared/lib/utils";

interface ReciterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  onWordHighlightGuideClick?: () => void;
  id?: string;
}

const categoryKeys: Record<
  ReciterCategory,
  | "recitation.categories.hafs"
  | "recitation.categories.warsh"
  | "recitation.categories.translation"
> = {
  hafs: "recitation.categories.hafs",
  warsh: "recitation.categories.warsh",
  translation: "recitation.categories.translation",
};

function reciterName(reciter: ReciterOption, locale: "ar" | "en"): string {
  return locale === "ar" ? reciter.nameAr : reciter.nameEn;
}

function sortReciters(
  reciters: ReciterOption[],
  locale: "ar" | "en",
): ReciterOption[] {
  return [...reciters].sort((first, second) => {
    const firstHighlight = supportsAyahWordHighlight(first.id) ? 0 : 1;
    const secondHighlight = supportsAyahWordHighlight(second.id) ? 0 : 1;
    if (firstHighlight !== secondHighlight)
      return firstHighlight - secondHighlight;
    return reciterName(first, locale).localeCompare(
      reciterName(second, locale),
      locale,
    );
  });
}

function matchesQuery(reciter: ReciterOption, query: string): boolean {
  return normalizeArabicForMatch(
    `${reciter.nameAr} ${reciter.nameEn}`,
  ).includes(query);
}

function ReciterRow({
  reciter,
  optionId,
  selected,
  active,
  showHighlightBadge,
  previewPlaying,
  onSelect,
  onPreview,
}: {
  reciter: ReciterOption;
  optionId: string;
  selected: boolean;
  active: boolean;
  showHighlightBadge: boolean;
  previewPlaying: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("settings");
  const name = reciterName(reciter, locale);

  return (
    <div
      role="none"
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-1 rounded-lg p-1",
        (selected || active) && "bg-muted",
      )}
    >
      <button
        id={optionId}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-md px-2 text-start hover:bg-accent hover:text-accent-foreground"
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center">
          {selected && (
            <Check aria-hidden="true" className="h-4 w-4 text-primary" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {showHighlightBadge && supportsAyahWordHighlight(reciter.id) && (
          <span className="hidden shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] font-semibold text-primary sm:inline">
            {t("recitation.wordHighlight")}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={t("recitation.previewReciter", { name })}
      >
        <Volume2
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            previewPlaying && "animate-pulse text-primary",
          )}
        />
      </button>
    </div>
  );
}

export function ReciterSelect({
  value,
  onValueChange,
  onWordHighlightGuideClick,
  id,
}: ReciterSelectProps) {
  const { locale } = useLocale();
  const { t } = useTranslation("settings");
  const { t: tA11y } = useTranslation("a11y");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const { playUrl, playingUrl } = usePreviewAudio();

  const selected = getReciterById(value);
  const groups = getRecitersByCategory();
  const pinned = sortReciters(
    RECITERS.filter((reciter) => supportsAyahWordHighlight(reciter.id)),
    locale,
  );
  const normalizedQuery = normalizeArabicForMatch(query);
  const filteredPinned = normalizedQuery
    ? pinned.filter((reciter) => matchesQuery(reciter, normalizedQuery))
    : pinned;
  const pinnedIds = new Set(filteredPinned.map((reciter) => reciter.id));
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      reciters: sortReciters(
        group.reciters.filter(
          (reciter) =>
            !pinnedIds.has(reciter.id) &&
            (!normalizedQuery || matchesQuery(reciter, normalizedQuery)),
        ),
        locale,
      ),
    }))
    .filter((group) => group.reciters.length > 0);
  const visibleReciters = [
    ...filteredPinned,
    ...filteredGroups.flatMap((group) => group.reciters),
  ];
  const activeReciter = visibleReciters[activeIndex];

  const previewReciter = (reciter: ReciterOption) => {
    void playUrl(getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH));
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const openDropdown = () => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const selectReciter = (reciter: ReciterOption) => {
    onValueChange(reciter.id);
    closeDropdown();
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node))
        closeDropdown();
    };

    document.addEventListener("mousedown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("mousedown", closeOnOutsidePointer);
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (visibleReciters.length === 0) return 0;
        return (
          (current + direction + visibleReciters.length) %
          visibleReciters.length
        );
      });
      return;
    }

    if (event.key === "Enter" && open && activeReciter) {
      event.preventDefault();
      selectReciter(activeReciter);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full text-start">
      <div className="flex min-h-12 w-full items-center gap-1 rounded-xl border border-input bg-background text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={id}
            ref={inputRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && activeReciter
                ? `${generatedId}-${activeReciter.id}`
                : undefined
            }
            readOnly={!open}
            value={open ? query : reciterName(selected, locale)}
            placeholder={t("recitation.searchPlaceholder")}
            onClick={() => {
              if (!open) openDropdown();
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="h-12 border-0 bg-transparent pe-3 ps-9 text-start font-medium shadow-none focus-visible:ring-0"
          />
        </div>

        {supportsAyahWordHighlight(selected.id) && (
          <button
            type="button"
            onClick={() => onWordHighlightGuideClick?.()}
            className="hidden min-h-11 shrink-0 rounded-full px-2 text-[0.65rem] font-semibold text-primary hover:bg-primary/10 sm:inline-flex sm:items-center"
          >
            {t("recitation.wordHighlight")}
          </button>
        )}

        <button
          type="button"
          aria-label={tA11y("openReciterList")}
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => (open ? closeDropdown() : openDropdown())}
          className="inline-flex h-12 w-11 shrink-0 items-center justify-center rounded-e-xl text-muted-foreground hover:bg-muted"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={tA11y("reciterList")}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="app-main-scroll max-h-[min(22rem,55vh)] overflow-y-auto p-1.5">
            {visibleReciters.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("recitation.empty")}
              </p>
            ) : (
              <>
                {filteredPinned.length > 0 && (
                  <div role="group" aria-label={t("recitation.wordHighlight")}>
                    <p className="px-3 py-2 text-xs font-bold text-primary">
                      {t("recitation.wordHighlight")}
                    </p>
                    {filteredPinned.map((reciter) => (
                      <ReciterRow
                        key={reciter.id}
                        optionId={`${generatedId}-${reciter.id}`}
                        reciter={reciter}
                        selected={reciter.id === value}
                        active={activeReciter?.id === reciter.id}
                        showHighlightBadge={false}
                        previewPlaying={
                          playingUrl ===
                          getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH)
                        }
                        onPreview={() => previewReciter(reciter)}
                        onSelect={() => selectReciter(reciter)}
                      />
                    ))}
                  </div>
                )}

                {filteredGroups.map((group) => (
                  <div
                    key={group.category}
                    role="group"
                    aria-label={t(categoryKeys[group.category])}
                  >
                    <p className="px-3 py-2 text-xs font-bold text-primary">
                      {t(categoryKeys[group.category])}
                    </p>
                    {group.reciters.map((reciter) => (
                      <ReciterRow
                        key={reciter.id}
                        optionId={`${generatedId}-${reciter.id}`}
                        reciter={reciter}
                        selected={reciter.id === value}
                        active={activeReciter?.id === reciter.id}
                        showHighlightBadge
                        previewPlaying={
                          playingUrl ===
                          getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH)
                        }
                        onPreview={() => previewReciter(reciter)}
                        onSelect={() => selectReciter(reciter)}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
