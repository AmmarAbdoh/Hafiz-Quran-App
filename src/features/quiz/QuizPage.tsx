import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ScopeSelection } from "@/features/quiz/components/ScopeSelection";
import { QuestionTypeSelector } from "@/features/quiz/components/QuestionTypeSelector";
import { ActiveQuiz } from "@/features/quiz/components/ActiveQuiz";
import type { QuestionType, QuizSelection } from "@/shared/types/quran";

type QuizStep = "scope" | "types" | "active";

export function QuizPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<QuizStep>("scope");
  const [mode, setMode] = useState<"surah" | "juz">("surah");
  const [selection, setSelection] = useState<QuizSelection | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);

  const handleScopeConfirm = (indices: number[]) => {
    setSelection({ mode, indices, questionTypes: [] });
    setStep("types");
  };

  const handleStartQuiz = () => {
    if (!selection) return;
    setSelection({ ...selection, questionTypes: selectedTypes });
    setStep("active");
  };

  const handleReset = () => {
    setStep("scope");
    setSelection(null);
    setSelectedTypes([]);
  };

  if (step === "active" && selection) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">الاختبار</h1>
        <ActiveQuiz selection={selection} onBack={handleReset} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">اختبار مخصص</h1>
        <Button variant="outline" onClick={() => navigate("/")}>
          العودة للرئيسية
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === "scope" && (
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "surah" | "juz")}
            >
              <TabsList className="mb-6 w-full">
                <TabsTrigger value="surah" className="flex-1">
                  اختيار السور
                </TabsTrigger>
                <TabsTrigger value="juz" className="flex-1">
                  اختيار الأجزاء
                </TabsTrigger>
              </TabsList>
              <TabsContent value="surah">
                <ScopeSelection mode="surah" onConfirm={handleScopeConfirm} />
              </TabsContent>
              <TabsContent value="juz">
                <ScopeSelection mode="juz" onConfirm={handleScopeConfirm} />
              </TabsContent>
            </Tabs>
          )}

          {step === "types" && selection && (
            <QuestionTypeSelector
              selection={selection}
              selectedTypes={selectedTypes}
              onTypesChange={setSelectedTypes}
              onStart={handleStartQuiz}
              onBack={() => setStep("scope")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
