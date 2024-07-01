import React, { createContext, useState, useEffect } from "react";

import versesData from "../src/Quran/quran_verses_imlaei_cleaned.json"; // Import your JSON file
import UthmaniVersesData from "../src/Quran/Quran_Uthmani.json";

export const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const [quranSelection, setQuranSelection] = useState([]);
  const [verses, setVerses] = useState([]);
  const [UthmaniVersesMap, setUthmaniVersesMap] = useState({});
  const [SimpleVersesMap, setSimpleVersesMap] = useState({});
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    // Preprocess the data once
    const uniqueVerses = Array.from(
      new Set(versesData.verses.map((verse) => verse.text_imlaei))
    ).map((uniqueText) =>
      versesData.verses.find((verse) => verse.text_imlaei === uniqueText)
    );

    setVerses(uniqueVerses);

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
  }, []);

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
      }}
    >
      {children}
    </MyContext.Provider>
  );
};
