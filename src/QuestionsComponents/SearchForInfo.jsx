import React, { useState, useContext } from "react";
import "../style/SearchForVerse.css";
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
const generateOptions = (type) => {
  switch (type) {
    case 1:
      return surahNames;
    case 2:
      return Array.from({ length: 286 }, (_, i) => (i + 1).toString());
    case 3:
      return Array.from({ length: 30 }, (_, i) => (i + 1).toString());
    case 4:
      return Array.from({ length: 60 }, (_, i) => (i + 1).toString());
    case 5:
      return Array.from({ length: 604 }, (_, i) => (i + 1).toString());
    default:
      return [];
  }
};

const SearchForInfo = ({ setAnswer, searchType }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null); // State to hold the selected option temporarily
  const options = generateOptions(searchType);

  const filteredOptions = options
    .filter((option) => option.includes(searchTerm))
    .sort((a, b) => a.length - b.length);

  const handleSelectOption = (option) => {
    setSelectedOption(option);
    setShowDropdown(false);
  };

  const confirmSelection = () => {
    if (selectedOption) {
      setAnswer(selectedOption);
      setSelectedOption(null);
      setSearchTerm("");
    }
  };

  return (
    <div className="search-container mt-5">
      <input
        className="input-field"
        type="text"
        placeholder="ابحث..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowDropdown(e.target.value !== "");
        }}
        onFocus={() => setShowDropdown(searchTerm !== "")}
      />
      {showDropdown && (
        <div className="dropdown">
          {filteredOptions.slice(0, 4).map((option, index) => (
            <div
              key={index}
              className="dropdown-item"
              onClick={() => handleSelectOption(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
      {selectedOption && (
        <div className="selected-verse">
          <h6 className="mb-3">الاجابة المختارة</h6>
          <h5>{selectedOption}</h5>
          <button className="btn btn-success mt-3" onClick={confirmSelection}>
            تأكيد الاختيار
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchForInfo;
