import type { VerseInfoItem } from "@/shared/types/quran";

interface VerseMetadataProps {
  items: VerseInfoItem[];
}

export function VerseMetadata({ items }: VerseMetadataProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg bg-muted p-4">
      <h4 className="mb-3 font-semibold">معلومات الآية:</h4>
      <table className="w-full text-sm">
        <tbody>
          {items.map((info) => (
            <tr key={info.key} className="border-b border-border/50 last:border-0">
              <td className="py-2 font-medium">{info.key}</td>
              <td className="py-2 text-muted-foreground">{info.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
