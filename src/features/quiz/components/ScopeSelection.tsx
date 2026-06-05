import { useState } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { SURAH_NAMES, JUZ_NAMES } from "@/shared/constants/quran";

interface ScopeSelectionProps {
  mode: "surah" | "juz";
  onConfirm: (indices: number[]) => void;
}

export function ScopeSelection({ mode, onConfirm }: ScopeSelectionProps) {
  const count = mode === "surah" ? 114 : 30;
  const names = mode === "surah" ? SURAH_NAMES : JUZ_NAMES;
  const title = mode === "surah" ? "اختيار السور" : "اختيار الأجزاء";

  const [checked, setChecked] = useState<boolean[]>(
    () => new Array(count).fill(false),
  );
  const [search, setSearch] = useState("");

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = checked.every(Boolean);
    setChecked(new Array(count).fill(!allSelected));
  };

  const selectedIndices = checked
    .map((isChecked, index) => (isChecked ? index + 1 : 0))
    .filter((i) => i > 0);

  const filtered = names
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name.includes(search));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      <Button variant="outline" onClick={toggleAll}>
        {checked.every(Boolean) ? "إلغاء اختيار الكل" : "اختيار الكل"}
      </Button>

      <Input
        placeholder={mode === "surah" ? "ابحث عن سورة..." : "ابحث عن جزء..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ name, index }) => (
          <label
            key={index}
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
          >
            <Checkbox
              checked={checked[index]}
              onCheckedChange={() => toggle(index)}
            />
            <span className="text-sm">
              {index + 1}: {name}
            </span>
          </label>
        ))}
      </div>

      <Button
        size="lg"
        disabled={selectedIndices.length === 0}
        onClick={() => onConfirm(selectedIndices)}
      >
        تأكيد الاختيار ({selectedIndices.length})
      </Button>
    </div>
  );
}
