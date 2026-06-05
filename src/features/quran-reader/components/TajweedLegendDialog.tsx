import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { TAJWEED_LEGEND } from "@/shared/constants/tajweed";

interface TajweedLegendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TajweedLegendDialog({
  open,
  onOpenChange,
}: TajweedLegendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>دليل ألوان التجويد</DialogTitle>
          <DialogDescription>
            شرح قواعد التجويد لكل لون في المصحف الملوّن
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3">
          {TAJWEED_LEGEND.map((rule) => (
            <li
              key={rule.id}
              className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3"
            >
              <span
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: rule.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="font-medium leading-snug">{rule.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {rule.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
