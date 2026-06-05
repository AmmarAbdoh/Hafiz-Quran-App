/** Tajweed rule legend — labels match Quran.com; swatches are representative guide colors. */
export interface TajweedRuleLegend {
  id: string;
  label: string;
  description: string;
  color: string;
}

export const TAJWEED_LEGEND: TajweedRuleLegend[] = [
  {
    id: "sakin",
    label: "الحرف الساكن",
    description: "حرف ساكن أو حركة قصيرة بدون مد",
    color: "#4a4a4a",
  },
  {
    id: "madd-2",
    label: "مدّ حركتان",
    description: "مد طبيعي بمقدار حركتين",
    color: "#e53935",
  },
  {
    id: "madd-munfasil",
    label: "المد المنفصل (٢ / ٤ / ٦ حركات)",
    description: "مد همزة الوصل المنفصلة عن حرف المد",
    color: "#f57c00",
  },
  {
    id: "madd-muttasil",
    label: "المد المتصل (٤ أو ٥ حركات)",
    description: "مد همزة الوصل المتصلة بحرف المد",
    color: "#c62828",
  },
  {
    id: "madd-lazim",
    label: "المد اللازم (٦ حركات)",
    description: "مد لازم كلمي أو حرفي بست حركات",
    color: "#7b1fa2",
  },
  {
    id: "ghunnah",
    label: "غنة / إخفاء",
    description: "غنة أو إخفاء بمقدار حركتين",
    color: "#43a047",
  },
  {
    id: "qalqalah",
    label: "قلقلة",
    description: "قلقلة صغرى أو كبرى عند السكون",
    color: "#29b6f6",
  },
  {
    id: "tafkheem",
    label: "تفخيم الصوت",
    description: "تفخيم الحرف بصوت ممتلئ",
    color: "#1565c0",
  },
];
