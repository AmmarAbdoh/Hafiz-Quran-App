import React, { createContext, useState, useEffect } from "react";

import versesData from "../src/Quran/quran_verses_imlaei_cleaned.json"; // Import your JSON file
import UthmaniVersesData from "../src/Quran/Quran_Uthmani.json";
import QuranHafs from "../src/Quran/hafsData_v2-0.json";
export const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const surahNames = [
    "الفاتحة",
    "البقرة",
    "ال عمران",
    "النساء",
    "المائدة",
    "الانعام",
    "الاعراف",
    "الانفال",
    "التوبة",
    "يونس",
    "هود",
    "يوسف",
    "الرعد",
    "ابراهيم",
    "الحجر",
    "النحل",
    "الاسراء",
    "الكهف",
    "مريم",
    "طه",
    "الانبياء",
    "الحج",
    "المؤمنون",
    "النور",
    "الفرقان",
    "الشعراء",
    "النمل",
    "القصص",
    "العنكبوت",
    "الروم",
    "لقمان",
    "السجدة",
    "الاحزاب",
    "سبأ",
    "فاطر",
    "يس",
    "الصافات",
    "ص",
    "الزمر",
    "غافر",
    "فصلت",
    "الشورى",
    "الزخرف",
    "الدخان",
    "الجاثية",
    "الأحقاف",
    "محمد",
    "الفتح",
    "الحجرات",
    "ق",
    "الذاريات",
    "الطور",
    "النجم",
    "القمر",
    "الرحمن",
    "الواقعة",
    "الحديد",
    "المجادلة",
    "الحشر",
    "الممتحنة",
    "الصف",
    "الجمعة",
    "المنافقون",
    "التغابن",
    "الطلاق",
    "التحريم",
    "الملك",
    "القلم",
    "الحاقة",
    "المعارج",
    "نوح",
    "الجن",
    "المزمل",
    "المدثر",
    "القيامة",
    "الإنسان",
    "المرسلات",
    "النبأ",
    "النازعات",
    "عبس",
    "التكوير",
    "الإنفطار",
    "المطففين",
    "الإنشقاق",
    "البروج",
    "الطارق",
    "الأعلى",
    "الغاشية",
    "الفجر",
    "البلد",
    "الشمس",
    "الليل",
    "الضحى",
    "الشرح",
    "التين",
    "العلق",
    "القدر",
    "البينة",
    "الزلزلة",
    "العاديات",
    "القارعة",
    "التكاثر",
    "العصر",
    "الهمزة",
    "الفيل",
    "قريش",
    "الماعون",
    "الكوثر",
    "الكافرون",
    "النصر",
    "المسد",
    "الاخلاص",
    "الفلق",
    "الناس",
  ];
  const [quranSelection, setQuranSelection] = useState([]);
  const [verses, setVerses] = useState([]);
  const [UthmaniVersesMap, setUthmaniVersesMap] = useState({});
  const [SimpleVersesMap, setSimpleVersesMap] = useState({});
  const [answer, setAnswer] = useState("");
  const [uthmaniQuran, setUthmaniQuran] = useState({});
  const [quranHafs, setQuranHafs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Preprocess the data once
      const uniqueVerses = Array.from(
        new Set(versesData.verses.map((verse) => verse.text_imlaei))
      ).map((uniqueText) =>
        versesData.verses.find((verse) => verse.text_imlaei === uniqueText)
      );

      setVerses(uniqueVerses);
      setUthmaniQuran(UthmaniVersesData);
      setQuranHafs(QuranHafs);

      // Create a map for Uthmani verses
      const uthmaniMap = {};
      UthmaniVersesData.verses.forEach((verse) => {
        uthmaniMap[verse.verse_key] = verse;
      });
      setUthmaniVersesMap(uthmaniMap);

      // Create a map for Simple verses
      const simpleMap = {};
      versesData.verses.forEach((verse) => {
        simpleMap[verse.verse_key] = verse;
      });
      setSimpleVersesMap(simpleMap);

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return <h1>الرجاء الانتظار...</h1>;
  }

  return (
    <MyContext.Provider
      value={{
        quranSelection,
        setQuranSelection,
        verses,
        UthmaniVersesMap,
        SimpleVersesMap,
        answer,
        setAnswer,
        surahNames,
        uthmaniQuran,
        quranHafs,
      }}
    >
      {children}
    </MyContext.Provider>
  );
};
