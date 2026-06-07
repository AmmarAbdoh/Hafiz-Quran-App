import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Volume2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  DEMO_AYAH,
  DEMO_SURAH,
} from "@/shared/constants/demoAyah";
import { getAyahAudioUrl } from "@/shared/constants/audio";
import {
  getReciterById,
  getRecitersByCategory,
  RECITERS,
  type ReciterOption,
} from "@/shared/constants/reciters";
import { supportsAyahWordHighlight } from "@/shared/constants/quranComReciters";
import { usePreviewAudio } from "@/shared/hooks/use-preview-audio";
import { cn } from "@/shared/lib/utils";

interface ReciterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  onWordHighlightGuideClick?: () => void;
  id?: string;
}

const WORD_HIGHLIGHT_LABEL = "تمييز كلمة بكلمة";

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function sortReciters(reciters: ReciterOption[]): ReciterOption[] {
  return [...reciters].sort((a, b) => {
    const aHighlight = supportsAyahWordHighlight(a.id) ? 0 : 1;
    const bHighlight = supportsAyahWordHighlight(b.id) ? 0 : 1;
    if (aHighlight !== bHighlight) return aHighlight - bHighlight;
    return a.nameAr.localeCompare(b.nameAr, "ar");
  });
}

function matchesQuery(reciter: ReciterOption, normalizedQuery: string): boolean {
  const haystack = normalizeSearchText(`${reciter.nameAr} ${reciter.nameEn}`);
  return haystack.includes(normalizedQuery);
}

function ReciterOptionButton({
  reciter,
  isSelected,
  showHighlightBadge,
  previewPlaying,
  onSelect,
  onPreview,
}: {
  reciter: ReciterOption;
  isSelected: boolean;
  showHighlightBadge: boolean;
  previewPlaying: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      dir="rtl"
      className={cn(
        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-1 rounded-sm px-1 py-1 text-sm transition-colors",
        isSelected && "bg-accent/70",
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPreview();
        }}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          previewPlaying && "text-primary",
        )}
        aria-label={`استمع إلى ${reciter.nameAr}`}
        title="استمع للتجربة"
      >
        <Volume2 className={cn("h-4 w-4", previewPlaying && "animate-pulse")} />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 rounded-sm px-1 py-1 text-right transition-colors hover:bg-accent/60 hover:text-accent-foreground"
      >
        <span className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate">{reciter.nameAr}</span>
          {showHighlightBadge && supportsAyahWordHighlight(reciter.id) && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {WORD_HIGHLIGHT_LABEL}
            </span>
          )}
        </span>
      </button>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </span>
    </div>
  );
}

export function ReciterSelect({
  value,
  onValueChange,
  onWordHighlightGuideClick,
  id,
}: ReciterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playUrl, playingUrl } = usePreviewAudio();

  const selected = getReciterById(value);
  const groups = useMemo(() => getRecitersByCategory(), []);
  const pinnedReciters = useMemo(
    () =>
      sortReciters(RECITERS.filter((reciter) =>
        supportsAyahWordHighlight(reciter.id),
      )),
    [],
  );
  const normalizedQuery = normalizeSearchText(query);

  const filteredPinned = useMemo(() => {
    if (!normalizedQuery) return pinnedReciters;
    return pinnedReciters.filter((reciter) =>
      matchesQuery(reciter, normalizedQuery),
    );
  }, [normalizedQuery, pinnedReciters]);

  const pinnedInResults = useMemo(
    () => new Set(filteredPinned.map((reciter) => reciter.id)),
    [filteredPinned],
  );

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        reciters: sortReciters(
          group.reciters.filter((reciter) => {
            if (pinnedInResults.has(reciter.id)) return false;
            return normalizedQuery
              ? matchesQuery(reciter, normalizedQuery)
              : true;
          }),
        ),
      }))
      .filter((group) => group.reciters.length > 0);
  }, [groups, normalizedQuery, pinnedInResults]);

  const previewReciter = (reciter: ReciterOption) => {
    const url = getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH);
    void playUrl(url);
  };

  const getPreviewUrl = (reciter: ReciterOption) =>
    getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH);

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
  };

  const openDropdown = () => {
    setOpen(true);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const showPinnedSection = filteredPinned.length > 0;
  const hasResults = showPinnedSection || filteredGroups.length > 0;

  return (
    <div ref={containerRef} dir="rtl" className="relative w-full text-right">
      <div
        className={cn(
          "flex h-11 w-full items-center gap-1 rounded-md border border-input bg-background text-sm shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            ref={inputRef}
            dir="rtl"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            readOnly={!open}
            value={open ? query : selected.nameAr}
            placeholder="ابحث عن قارئ..."
            onClick={() => {
              if (!open) openDropdown();
            }}
            onChange={(event) => {
              if (!open) return;
              setQuery(event.target.value);
            }}
            className={cn(
              "h-11 border-0 bg-transparent pe-3 ps-9 text-right font-medium shadow-none focus-visible:ring-0",
              !open && "cursor-pointer",
            )}
          />
        </div>

        {supportsAyahWordHighlight(selected.id) && (
          <button
            type="button"
            onClick={() => onWordHighlightGuideClick?.()}
            className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
            title="شرح تمييز كلمة بكلمة"
          >
            {WORD_HIGHLIGHT_LABEL}
          </button>
        )}

        <button
          type="button"
          aria-label="فتح قائمة القراء"
          onClick={() => (open ? closeDropdown() : openDropdown())}
          className="inline-flex h-11 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && (
        <div
          dir="rtl"
          role="listbox"
          aria-label="قائمة القراء"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-right text-popover-foreground shadow-lg"
        >
          <div className="app-main-scroll max-h-[min(18rem,50vh)] overflow-y-auto p-1">
            {!hasResults ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </p>
            ) : (
              <>
                {showPinnedSection && (
                  <div className="mb-1">
                    <p className="px-2 py-1.5 text-right text-xs font-semibold text-primary">
                      {WORD_HIGHLIGHT_LABEL}
                    </p>
                    {filteredPinned.map((reciter) => (
                      <ReciterOptionButton
                        key={reciter.id}
                        reciter={reciter}
                        isSelected={reciter.id === value}
                        showHighlightBadge={false}
                        previewPlaying={playingUrl === getPreviewUrl(reciter)}
                        onPreview={() => previewReciter(reciter)}
                        onSelect={() => {
                          onValueChange(reciter.id);
                          closeDropdown();
                          inputRef.current?.blur();
                        }}
                      />
                    ))}
                  </div>
                )}

                {filteredGroups.map((group) => (
                  <div key={group.category} className="mb-1">
                    <p className="px-2 py-1.5 text-right text-xs font-semibold text-primary">
                      {group.label}
                    </p>
                    {group.reciters.map((reciter) => (
                      <ReciterOptionButton
                        key={reciter.id}
                        reciter={reciter}
                        isSelected={reciter.id === value}
                        showHighlightBadge
                        previewPlaying={playingUrl === getPreviewUrl(reciter)}
                        onPreview={() => previewReciter(reciter)}
                        onSelect={() => {
                          onValueChange(reciter.id);
                          closeDropdown();
                          inputRef.current?.blur();
                        }}
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
