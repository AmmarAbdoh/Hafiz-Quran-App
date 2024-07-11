import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "../useContext";
import QuranPage from "../components/QuranPage";
import RemoveBackground from "../functions/RemoveBackground";
import "../style/QuranComponent.css";
import GetVerseInfo from "../functions/GetVerseInfo";

const Quran = () => {
  RemoveBackground();
  const { surahNames, quranHafs } = useContext(MyContext);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSurah, setCurrentSurah] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [verseInfo, setVerseInfo] = useState([]); // State for verse info

  // Get the total number of pages dynamically
  const totalPages = quranHafs.reduce(
    (maxPage, verse) => Math.max(maxPage, verse.page),
    0
  );

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleInputChange = (e) => {
    const newPage = parseInt(e.target.value, 10);
    if (!isNaN(newPage)) {
      handlePageChange(newPage);
    }
  };

  const goToPreviousPage = () => {
    handlePageChange(currentPage - 1);
  };

  const goToNextPage = () => {
    handlePageChange(currentPage + 1);
  };

  const handleSurahChange = (surahIndex) => {
    const firstVerse = quranHafs.find(
      (verse) => verse.sura_no === surahIndex + 1
    );
    if (firstVerse) {
      setCurrentSurah(surahIndex);
      setCurrentPage(firstVerse.page);
    }
  };

  // Update search term state
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentSurah(null); // Reset currentSurah when searching
  };

  // Filter surahNames based on search term
  const filteredSurahs = surahNames.filter((surah, index) =>
    surah.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find the first verse on the current page
  const firstVerseOnPage = quranHafs.find((verse) => verse.page === currentPage);

  useEffect(() => {
    if (firstVerseOnPage) {
      const verseID = firstVerseOnPage.id;
      const info = GetVerseInfo({ verseID, surahNames });
      setVerseInfo(info);
    }
  }, [firstVerseOnPage]);

  return (
    <div className="quran-container" dir="rtl">
      {/* Search box */}
      <div className="surah-navigator">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="ابحث عن السورة..."
          className="surah-search-box"
        />
        <div className="surah-list">
          {filteredSurahs.map((surah, index) => {
            const surahIndex = surahNames.findIndex((name) => name === surah);
            const ayatCount = quranHafs.filter(
              (verse) => verse.sura_no === surahIndex + 1
            ).length;

            return (
              <div
                key={index}
                className={`surah-list-item ${surahIndex === currentSurah ? "active" : ""
                  }`}
                onClick={() => handleSurahChange(surahIndex)}
              >
                <div className="surah-list-item-text">
                  <span className="surah-list-item-text-en">{surah}</span>
                  <span className="surah-list-item-text-arabic">
                    {surahIndex + 1}
                  </span>
                </div>
                <div className="surah-list-item-count">
                  {`${ayatCount} `}
                  :عدد الايات &nbsp;
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side for displaying Quran page */}
      <div className="quran-page-container">
        <div className="quran-page">
          <QuranPage page={currentPage} />
        </div>
        <div className="pagination">
          <button
            onClick={goToPreviousPage}
            className="pagination-button mybtn"
          >
            &lt;
          </button>
          <input
            type="text"
            value={currentPage}
            onChange={handleInputChange}
            className="pagination-input"
          />
          <span className="pagination-total-pages"> / {totalPages}</span>
          <button onClick={goToNextPage} className="pagination-button mybtn">
            &gt;
          </button>
        </div>

      </div>
      {firstVerseOnPage && (
        <div className="first-verse-info w-100">
          {verseInfo.slice(2, 4).map((info, index) => (
            <h5 key={index}>
              <strong>{info.key}:</strong> {info.value}
            </h5>
          ))}
        </div>
      )}

    </div>
  );
};

export default Quran;
