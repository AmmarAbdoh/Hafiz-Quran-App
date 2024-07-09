import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "../useContext";
import QuranPage from "../components/QuranPage";
import RemoveBackground from "../functions/RemoveBackground";
import "../style/QuranComponent.css";
const surahNames = [
  "الفاتحة",
  "البقرة",
  "آل عمران",
  "النساء",
  "المائدة",
  "الأنعام",
  "الأعراف",
  "الأنفال",
  "التوبة",
  "يونس",
  "هود",
  "يوسف",
  "الرعد",
  "إبراهيم",
  "الحجر",
  "النحل",
  "الإسراء",
  "الكهف",
  "مريم",
  "طه",
  "الأنبياء",
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
  "الأحزاب",
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
  "الإخلاص",
  "الفلق",
  "الناس",
];

const Quran = () => {
  RemoveBackground();
  const { quranHafs } = useContext(MyContext);
  const [currentPage, setCurrentPage] = useState(1); // State to track current page
  const [currentSurah, setCurrentSurah] = useState(null); // State to track current surah
  const [searchTerm, setSearchTerm] = useState(""); // State for search term

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

  return (
    <div className="quran-container" dir="rtl">
      {/* Search box */}

      {/* Left side for Surah selection */}
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
          <button onClick={goToPreviousPage} className="pagination-button">
            &lt; Prev
          </button>
          <input
            type="text"
            value={currentPage}
            onChange={handleInputChange}
            className="pagination-input"
          />
          <span className="pagination-total-pages"> / {totalPages}</span>
          <button onClick={goToNextPage} className="pagination-button">
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default Quran;
