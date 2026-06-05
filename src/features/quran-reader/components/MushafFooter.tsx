import { PageControls } from "@/features/quran-reader/components/PageControls";

interface MushafFooterProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  surahNumber?: number;
  surahAyahCount?: number;
  juzNumber?: number | string;
  hizbNumber?: number | string;
}

function MetaItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap text-[10px] text-muted-foreground sm:text-[11px]">
      {children}
    </span>
  );
}

export function MushafFooter({
  currentPage,
  totalPages,
  onPageChange,
  surahNumber,
  surahAyahCount,
  juzNumber,
  hizbNumber,
}: MushafFooterProps) {
  const hasStartMeta = surahNumber !== undefined || surahAyahCount !== undefined;
  const hasEndMeta = juzNumber !== undefined || hizbNumber !== undefined;

  return (
    <footer className="z-20 shrink-0 border-t border-border bg-background/95 px-2 py-2.5 backdrop-blur-md sm:px-3">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1">
        <div className="flex min-w-0 items-center justify-start gap-1.5 overflow-hidden">
          {hasStartMeta && (
            <>
              {surahNumber !== undefined && (
                <MetaItem>سورة {surahNumber}</MetaItem>
              )}
              {surahAyahCount !== undefined && (
                <MetaItem>{surahAyahCount} آية</MetaItem>
              )}
            </>
          )}
        </div>

        <PageControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />

        <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden">
          {hasEndMeta && (
            <>
              {juzNumber !== undefined && <MetaItem>جزء {juzNumber}</MetaItem>}
              {hizbNumber !== undefined && <MetaItem>حزب {hizbNumber}</MetaItem>}
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
