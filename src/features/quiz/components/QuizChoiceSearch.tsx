import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type { QuizChoice } from "../model/types";

interface QuizChoiceSearchProps {
  choices: QuizChoice[];
  disabled?: boolean;
  onConfirm: (choiceId: string) => void;
}

export function QuizChoiceSearch({
  choices,
  disabled = false,
  onConfirm,
}: QuizChoiceSearchProps) {
  const { t } = useTranslation("quiz");
  const inputId = useId();
  const listboxId = `${inputId}-results`;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchableChoices = useMemo(
    () =>
      choices.map((choice) => ({
        choice,
        normalizedLabel: normalizeArabicForMatch(choice.label),
      })),
    [choices],
  );
  const normalizedQuery = normalizeArabicForMatch(searchTerm);
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? searchableChoices
            .filter(({ normalizedLabel }) =>
              normalizedLabel.includes(normalizedQuery),
            )
            .slice(0, 8)
            .map(({ choice }) => choice)
        : [],
    [normalizedQuery, searchableChoices],
  );
  const selected = choices.find((choice) => choice.id === selectedId);
  const activeChoice = filtered[activeIndex];
  const showResults = normalizedQuery.length > 0 && !selected;

  function selectChoice(choice: QuizChoice): void {
    setSelectedId(choice.id);
    setSearchTerm(choice.label);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!showResults || filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + filtered.length) % filtered.length,
      );
    } else if (event.key === "Enter" && activeChoice) {
      event.preventDefault();
      selectChoice(activeChoice);
    } else if (event.key === "Escape") {
      setSearchTerm("");
      setSelectedId(null);
    }
  }

  return (
    <div className="relative mx-auto mt-6 max-w-xl">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium">
        {t("search.label")}
      </label>
      <Input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showResults}
        aria-controls={listboxId}
        aria-activedescendant={
          activeChoice ? `${listboxId}-${activeChoice.id}` : undefined
        }
        placeholder={t("search.placeholder")}
        value={searchTerm}
        disabled={disabled}
        autoComplete="off"
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setSearchTerm(event.target.value);
          setSelectedId(null);
          setActiveIndex(0);
        }}
      />

      {showResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("search.results")}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground" role="status">
              {t("search.noResults")}
            </p>
          ) : (
            filtered.map((choice, index) => (
              <button
                id={`${listboxId}-${choice.id}`}
                key={choice.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className="block min-h-11 w-full rounded-lg px-4 py-2 text-start text-sm hover:bg-muted aria-selected:bg-muted"
                dir="rtl"
                lang="ar"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectChoice(choice)}
              >
                {choice.label}
              </button>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-xl border bg-card p-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">
            {t("search.selected")}
          </p>
          <p className="mb-4 font-medium" dir="rtl" lang="ar">
            {selected.label}
          </p>
          <Button disabled={disabled} onClick={() => onConfirm(selected.id)}>
            {t("search.confirm")}
          </Button>
        </div>
      )}
    </div>
  );
}
