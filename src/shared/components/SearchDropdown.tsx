import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

interface SearchDropdownProps {
  placeholder: string;
  options: string[];
  onConfirm: (value: string) => void;
  selectedLabel?: string;
}

export function SearchDropdown({
  placeholder,
  options,
  onConfirm,
  selectedLabel = "الاجابة المختارة",
}: SearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = options
    .filter((option) => searchTerm !== "" && option.includes(searchTerm))
    .sort((a, b) => a.length - b.length)
    .slice(0, 4);

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected);
      setSelected(null);
      setSearchTerm("");
    }
  };

  return (
    <div className="relative mt-6 max-w-md mx-auto">
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowDropdown(e.target.value !== "");
        }}
        onFocus={() => setShowDropdown(searchTerm !== "")}
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {filtered.map((option) => (
            <button
              key={option}
              className="block w-full px-4 py-2 text-start text-sm hover:bg-muted"
              onClick={() => {
                setSelected(option);
                setShowDropdown(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="mt-4 rounded-lg border bg-card p-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">{selectedLabel}</p>
          <p className="mb-4 font-medium">{selected}</p>
          <Button onClick={handleConfirm}>تأكيد الاختيار</Button>
        </div>
      )}
    </div>
  );
}
