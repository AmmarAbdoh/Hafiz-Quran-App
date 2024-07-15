import React, { useContext } from "react";
import { MyContext } from "../useContext";
import HeaderOfSurah from "./HeaderOfSurah";

const QuranPage = ({ page }) => {
  const { quranHafs } = useContext(MyContext);

  // Filter verses for the given page
  const versesForPage = quranHafs.filter((verse) => verse.page === page);

  return (
    <div>
      {versesForPage.map((verse, index) => (
        <span key={verse.id}>
          {verse.aya_no === 1 && (
            <HeaderOfSurah surahName={verse.sura_name_ar} />
          )}
          <span className="quran-verse"> {verse.aya_text} </span>
        </span>
      ))}
    </div>
  );
};

export default QuranPage;
