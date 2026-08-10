import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import type { QuizChoice } from "@/features/quiz/lib/quiz-types";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";

interface QuizChoiceSearchProps {
  choices: QuizChoice[];
  placeholder?: string;
  disabled?: boolean;
  onConfirm: (choiceId: string) => void;
}

export function QuizChoiceSearch({
  choices,
  placeholder = "ابحث عن الآية...",
  disabled = false,
  onConfirm,
}: QuizChoiceSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = normalizeArabicForMatch(searchTerm);
    if (!query) return [];

    return choices
      .filter((choice) =>
        normalizeArabicForMatch(choice.label).includes(query),
      )
      .slice(0, 8);
  }, [choices, searchTerm]);

  const selected = choices.find((choice) => choice.id === selectedId);

  return (
    <div className="relative mx-auto mt-6 max-w-xl">
      <Input
        placeholder={placeholder}
        value={searchTerm}
        disabled={disabled}
        onChange={(event) => {
          setSearchTerm(event.target.value);
          setSelectedId(null);
        }}
      />

      {searchTerm && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="block w-full px-4 py-2 text-start text-sm hover:bg-muted"
              onClick={() => {
                setSelectedId(choice.id);
                setSearchTerm(choice.label);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-xl border bg-card p-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">الآية المختارة</p>
          <p className="mb-4 font-medium">{selected.label}</p>
          <Button
            disabled={disabled}
            onClick={() => {
              onConfirm(selected.id);
              setSelectedId(null);
              setSearchTerm("");
            }}
          >
            تأكيد الاختيار
          </Button>
        </div>
      )}
    </div>
  );
}
