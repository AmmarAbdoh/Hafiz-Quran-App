import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export interface SearchableRtlOption {
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

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function SearchableRtlSelect({
  id,
  value,
  options,
  placeholder = "اختر...",
  searchPlaceholder = "ابحث...",
  emptyMessage = "لا توجد نتائج",
  onValueChange,
  triggerClassName,
}: SearchableRtlSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalizeSearchText(query);

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      normalizeSearchText(option.label).includes(normalizedQuery),
    );
  }, [normalizedQuery, options]);

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
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
  };

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    closeDropdown();
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} dir="rtl" className="relative w-full text-right">
      <div
        className={cn(
          "flex h-11 w-full items-center gap-1 rounded-md border border-input bg-background text-sm shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring",
          triggerClassName,
        )}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            ref={inputRef}
            dir="rtl"
            readOnly={!open}
            value={open ? query : (selected?.label ?? "")}
            placeholder={open ? searchPlaceholder : placeholder}
            onClick={() => {
              if (!open) openDropdown();
            }}
            onChange={(event) => {
              if (!open) return;
              setQuery(event.target.value);
            }}
            className={cn(
              "h-11 border-0 bg-transparent pe-3 ps-9 text-right shadow-none focus-visible:ring-0",
              !open && "cursor-pointer",
            )}
          />
        </div>

        <button
          type="button"
          aria-label="فتح القائمة"
          onClick={() => (open ? closeDropdown() : openDropdown())}
          className="inline-flex h-11 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="app-main-scroll max-h-[min(16rem,45vh)] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-sm px-3 py-2.5 text-right text-base transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    option.value === value && "bg-accent/70",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
