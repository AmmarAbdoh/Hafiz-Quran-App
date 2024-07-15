import React, { useState, useContext } from "react";
import { MyContext } from "../useContext";
import HeaderOfSurah from "./HeaderOfSurah";
import Verse from "./Verse";

const QuranPage = ({ page }) => {
  const { quranHafs } = useContext(MyContext);
  const [activeVerseId, setActiveVerseId] = useState(null);

  const handleVerseClick = (id) => {
    setActiveVerseId(id);
  };
  // Filter verses for the given page
  const versesForPage = quranHafs.filter((verse) => verse.page === page);

  return (
    <div>
      {versesForPage.map((verse, index) => (
        <span key={verse.id}>
          {verse.aya_no === 1 && (
            <HeaderOfSurah surahName={verse.sura_name_ar} />
          )}
          <Verse
            key={verse.id}
            verse={verse}
            isActive={verse.id === activeVerseId}
            onVerseClick={() => handleVerseClick(verse.id)}
          />
        </span>
      ))}
    </div>
  );
};

export default QuranPage;
