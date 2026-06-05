import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  getReciterById,
  getRecitersByCategory,
} from "@/shared/constants/reciters";
import { cn } from "@/shared/lib/utils";

interface ReciterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
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

export function ReciterSelect({
  value,
  onValueChange,
  id,
}: ReciterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = getReciterById(value);
  const groups = useMemo(() => getRecitersByCategory(), []);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        reciters: group.reciters.filter((reciter) => {
          const haystack = normalizeSearchText(
            `${reciter.nameAr} ${reciter.nameEn}`,
          );
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.reciters.length > 0);
  }, [groups, query]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        dir="rtl"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "grid h-11 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors",
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="truncate text-right font-medium">
          {selected.nameAr}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          dir="rtl"
          role="listbox"
          aria-label="قائمة القراء"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن قارئ..."
                dir="rtl"
                className="h-9 pe-3 ps-9 text-right"
              />
            </div>
          </div>

          <div className="app-main-scroll max-h-[min(18rem,50vh)] overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </p>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.category} className="mb-1">
                  <p className="px-2 py-1.5 text-xs font-semibold text-primary">
                    {group.label}
                  </p>
                  {group.reciters.map((reciter) => {
                    const isSelected = reciter.id === value;
                    return (
                      <button
                        key={reciter.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onValueChange(reciter.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-sm px-2 py-2 text-right text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent/70",
                        )}
                      >
                        <span className="truncate">{reciter.nameAr}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
