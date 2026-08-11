import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";

interface BoundaryProps {
  children: ReactNode;
  title: string;
  description: string;
  retryLabel: string;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("Application render failed", error, details.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="route-state" role="alert">
        <span className="route-state__mark" aria-hidden="true">
          ۞
        </span>
        <h1>{this.props.title}</h1>
        <p>{this.props.description}</p>
        <Button type="button" onClick={() => window.location.reload()}>
          {this.props.retryLabel}
        </Button>
      </main>
    );
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation("errors");

  return (
    <Boundary
      title={t("unexpected.title", { defaultValue: "حدث خطأ غير متوقع" })}
      description={t("unexpected.description", {
        defaultValue: "تعذر عرض هذه الصفحة. حاول إعادة تحميل التطبيق.",
      })}
      retryLabel={t("retry", { defaultValue: "إعادة المحاولة" })}
    >
      {children}
    </Boundary>
  );
}
