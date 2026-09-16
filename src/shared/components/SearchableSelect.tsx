import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { useListNavigation } from "@/shared/hooks/useListNavigation";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import { cn } from "@/shared/lib/utils";

interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}

export function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onValueChange,
  triggerClassName,
}: SearchableSelectProps) {
  const { t, i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const resolvedPlaceholder = placeholder ?? t("select.choose");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("select.search");
  const resolvedEmptyMessage = emptyMessage ?? t("select.empty");

  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalizeArabicForMatch(query);

  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        normalizeArabicForMatch(option.label).includes(normalizedQuery),
      )
    : options;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const openDropdown = () => {
    setOpen(true);
    setQuery("");
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(Math.max(0, selectedIndex));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    closeDropdown();
    inputRef.current?.focus();
  };

  const {
    activeIndex,
    setActiveIndex,
    onKeyDown: listKeyDown,
  } = useListNavigation({
    count: filteredOptions.length,
    onSelect: (index) => {
      const option = filteredOptions[index];
      if (option) handleSelect(option.value);
    },
    onDismiss: closeDropdown,
    resetKey: query,
  });

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Closed, the field is a button: the same two keys that open a native
    // select open this one, and nothing else applies until it is open.
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    listKeyDown(event);
  };

  return (
    <div
      ref={containerRef}
      dir={i18n.dir()}
      className="relative w-full text-start"
    >
      <div
        className={cn(
          "flex min-h-12 w-full items-center gap-1 rounded-xl border border-input bg-background text-body shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring",
          triggerClassName,
        )}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={id}
            ref={inputRef}
            dir="auto"
            readOnly={!open}
            value={open ? query : (selected?.label ?? "")}
            placeholder={open ? resolvedSearchPlaceholder : resolvedPlaceholder}
            onClick={() => {
              if (!open) openDropdown();
            }}
            onChange={(event) => {
              if (!open) return;
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && filteredOptions[activeIndex]
                ? `${listboxId}-option-${activeIndex}`
                : undefined
            }
            className={cn(
              "h-11 border-0 bg-transparent pe-3 ps-9 text-start shadow-none focus-visible:ring-0",
              !open && "cursor-pointer",
            )}
          />
        </div>

        <button
          type="button"
          aria-label={open ? t("select.close") : t("select.open")}
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => (open ? closeDropdown() : openDropdown())}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-e-xl text-muted-foreground transition-colors duration-fast ease-standard hover:bg-surface-hover"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          id={listboxId}
          className="absolute z-overlay mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-overlay)]"
        >
          <div className="app-main-scroll max-h-[min(16rem,45vh)] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-label text-muted-foreground">
                {resolvedEmptyMessage}
              </p>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-3 py-2.5 text-start text-body transition-colors duration-fast ease-standard",
                    "hover:bg-surface-hover",
                    index === activeIndex && "bg-surface-hover",
                    option.value === value && "bg-surface-selected",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {open ? t("select.resultCount", { count: filteredOptions.length }) : ""}
      </span>
    </div>
  );
}
