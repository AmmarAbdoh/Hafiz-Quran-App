import { useContext, useState, useEffect } from "react";
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
  const [verseInfo, setVerseInfo] = useState([]);
  const [showSurahSelection, setShowSurahSelection] = useState(false);

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
      setShowSurahSelection(false); // Hide Surah selection after choosing a Surah
    }
  };

  // Update search term state
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentSurah(null); // Reset currentSurah when searching
  };

  const filteredSurahs = surahNames.filter((surah) =>
    surah.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const firstVerseOnPage = quranHafs.find(
    (verse) => verse.page === currentPage
  );

  useEffect(() => {
    if (firstVerseOnPage) {
      const verseID = firstVerseOnPage.id;
      const info = GetVerseInfo({ verseID, surahNames });
      setVerseInfo(info);
    }
  }, [firstVerseOnPage]);

  return (
    <div className="quran-container" dir="rtl">
      <div
        className={`surah-navigator ${
          showSurahSelection ? "d-block" : "d-none d-lg-block"
        }`}
      >
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
                className={`surah-list-item ${
                  surahIndex === currentSurah ? "active" : ""
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
                  {`${ayatCount} `}:عدد الايات &nbsp;
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!showSurahSelection && (
        <>
          <div className="quran-page-container">
            <div className="quran-page">
              <QuranPage page={currentPage} />
            </div>
            <div className="pagination">
              <button
                onClick={goToPreviousPage}
                className="pagination-button mybtn"
              >
                السابق
              </button>
              <input
                type="text"
                value={currentPage}
                onChange={handleInputChange}
                className="pagination-input"
              />
              <span className="pagination-total-pages"> / {totalPages}</span>
              <button
                onClick={goToNextPage}
                className="pagination-button mybtn"
              >
                التالي
              </button>
            </div>
          </div>
          {firstVerseOnPage && (
            <div className="first-verse-info w-100 ">
              {verseInfo.slice(0, 1).map((info, index) => (
                <h5 className="page-info" key={index}>
                  <strong>{info.key}:</strong> {info.value}
                </h5>
              ))}
              {verseInfo.slice(2, 4).map((info, index) => (
                <h5 className="page-info" key={index}>
                  <strong>{info.key}:</strong> {info.value}
                </h5>
              ))}
            </div>
          )}
        </>
      )}

      <button
        className="d-lg-none surah-btn"
        onClick={() => setShowSurahSelection(true)}
        style={{ display: showSurahSelection ? "none" : "block" }}
      >
        اختيار السور
      </button>
    </div>
  );
};

export default Quran;
