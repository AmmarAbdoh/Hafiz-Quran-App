import { Link } from "react-router-dom";
import { Info, Moon, Sun } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { ReciterSelect } from "@/features/settings/components/ReciterSelect";
import { RECITERS } from "@/shared/constants/reciters";
import { useReciter } from "@/shared/hooks/use-reciter";
import { useTheme } from "@/shared/hooks/use-theme";

export function SettingsPage() {
  const { reciter, setReciterId } = useReciter();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تخصيص تجربة القراءة والاستماع
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">القارئ</CardTitle>
          <CardDescription>
            تسجيلات آية بآية من EveryAyah و islamic.app. صوت الكلمة يبقى من
            تسجيل كلمة بكلمة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="reciter-select">اختر القارئ</Label>
          <ReciterSelect
            id="reciter-select"
            value={reciter.id}
            onValueChange={setReciterId}
          />
          <p className="text-xs text-muted-foreground">
            {RECITERS.length} قارئ — تلاوة آية بآية (مجاني)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المظهر</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={toggleTheme}
          >
            <span>الوضع {theme === "dark" ? "الفاتح" : "الداكن"}</span>
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            عن التطبيق والمصادر
          </CardTitle>
          <CardDescription>
            شكر وتقدير لمن جعل هذه الموارد متاحة لخدمة كتاب الله
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" className="w-full" asChild>
            <Link to="/about">عرض المصادر والشكر</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
