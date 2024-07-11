import React from "react";
import QuranInfo from "../Quran/Chapters_Info/Quran_info.json"; // Adjust the import path as necessary
const GetVerseInfo = ({ verseID, surahNames }) => {
  // Function to find verse information by verseID
  console.log("Verse ID:", verseID);
  const findVerseByKey = (key) => {
    return QuranInfo.find((v) => v.id === key);
  };

  // Retrieve verse information based on verseID
  const verseInfo = findVerseByKey(verseID);

  if (!verseInfo) {
    return [];
  }

  const verseSurahNumber = parseInt(verseInfo.verse_key.split(":")[0], 10);

  // Return the verse information in an array
  return [
    {
      key: "اسم السورة",
      value: surahNames[verseSurahNumber - 1],
    },
    {
      key: "رقم الاية",
      value: verseInfo.verse_number,
    },
    {
      key: "رقم الجزء",
      value: verseInfo.juz_number,
    },
    {
      key: "رقم الحزب",
      value: verseInfo.hizb_number,
    },
    {
      key: "الصفحة",
      value: verseInfo.page_number,
    },
  ];
};

export default GetVerseInfo;
