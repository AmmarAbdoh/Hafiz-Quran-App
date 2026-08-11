import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import { cn } from "@/shared/lib/utils";

interface SearchableRtlOption {
  value: string;
  label: string;
}

interface SearchableRtlSelectProps {
  id?: string;
  value: string;
  options: SearchableRtlOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}

export function SearchableRtlSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onValueChange,
  triggerClassName,
}: SearchableRtlSelectProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
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

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (filteredOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredOptions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) =>
          (current - 1 + filteredOptions.length) % filteredOptions.length,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = filteredOptions[activeIndex];
      if (activeOption) handleSelect(activeOption.value);
    }
  };

  return (
    <div ref={containerRef} dir="rtl" className="relative w-full text-right">
      <div
        className={cn(
          "flex min-h-12 w-full items-center gap-1 rounded-xl border border-input bg-background text-sm shadow-sm",
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
            dir="rtl"
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
              "h-11 border-0 bg-transparent pe-3 ps-9 text-right shadow-none focus-visible:ring-0",
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/30"
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
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="app-main-scroll max-h-[min(16rem,45vh)] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
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
                    "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-sm px-3 py-2.5 text-right text-base transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    index === activeIndex && "bg-accent text-accent-foreground",
                    option.value === value && "bg-accent/70",
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
