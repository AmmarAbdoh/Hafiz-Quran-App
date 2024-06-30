import React, { createContext, useState, useEffect } from "react";

import versesData from "../src/Quran/quran_verses_imlaei_cleaned.json"; // Import your JSON file

export const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const [quranSelection, setQuranSelection] = useState([]);
  const [verses, setVerses] = useState([]);
  const [answer, setAnswer] = useState("");
  useEffect(() => {
    // Preprocess the data once
    const uniqueVerses = Array.from(
      new Set(versesData.verses.map((verse) => verse.text_imlaei))
    ).map((uniqueText) =>
      versesData.verses.find((verse) => verse.text_imlaei === uniqueText)
    );

    setVerses(uniqueVerses);
  }, []);
  return (
    <MyContext.Provider
      value={{ quranSelection, setQuranSelection, verses, answer, setAnswer }}
    >
      {children}
    </MyContext.Provider>
  );
};
