import { Link, useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap, Settings } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

const features = [
  {
    title: "القرآن الكريم",
    description: "تصفح المصحف صفحة بصفحة مع البحث عن السور والتفسير",
    icon: BookOpen,
    path: "/quran",
  },
  {
    title: "اختبار مخصص",
    description: "اختبر حفظك بأسئلة متنوعة على سور أو أجزاء محددة",
    icon: GraduationCap,
    path: "/quiz",
  },
] as const;

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
          حافظ القرآن
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground text-balance">
          رفيقك في رحلة حفظ القرآن الكريم — اقرأ، راجع، واختبر نفسك
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {features.map((feature) => (
          <Card
            key={feature.path}
            className="group transition-shadow hover:shadow-md"
          >
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate(feature.path)}
              >
                ابدأ
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            الإعدادات والمصادر
          </Link>
        </Button>
      </div>
    </div>
  );
}
