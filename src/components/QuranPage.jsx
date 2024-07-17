import React, { useState, useContext, useEffect, useRef } from "react";
import { MyContext } from "../useContext";
import HeaderOfSurah from "./HeaderOfSurah";
import Verse from "./Verse";

const QuranPage = ({ page }) => {
  const { quranHafs } = useContext(MyContext);
  const [activeVerseId, setActiveVerseId] = useState(null);
  const containerRef = useRef(null);

  const handleVerseClick = (id) => {
    setActiveVerseId((prevId) => (prevId === id ? null : id));
  };

  const handleClickOutside = (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      setActiveVerseId(null);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Filter verses for the given page
  const versesForPage = quranHafs.filter((verse) => verse.page === page);

  return (
    <div ref={containerRef}>
      {versesForPage.map((verse, index) => (
        <span key={verse.id}>
          {verse.aya_no === 1 && <HeaderOfSurah surahName={verse.sura_name_ar} />}
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
