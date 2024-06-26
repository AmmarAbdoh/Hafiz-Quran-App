import React, { useState, useContext } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { MyContext } from "../useContext";

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

const SurahSelection = () => {
  const { quranSelection, setQuranSelection } = useContext(MyContext);

  const [checkedState, setCheckedState] = useState(new Array(115).fill(false));
  checkedState[114] = true;

  const handleCheckboxChange = (index) => {
    const updatedCheckedState = checkedState.map((item, idx) =>
      idx === index ? !item : item
    );
    setCheckedState(updatedCheckedState);
  };

  const handleColClick = (e, index) => {
    if (e.target.tagName !== "INPUT") {
      handleCheckboxChange(index);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = checkedState.slice(0, 114).every((state) => state);
    const newState = checkedState.map((state, index) => {
      if (index < 114) {
        return !allSelected;
      }
      return state;
    });

    setCheckedState(newState);
  };

  const handleConfirmSelection = () => {
    setQuranSelection(checkedState); // Send the selected surahs to context
  };

  const allSelected = checkedState.every((state) => state);
  const isAnyCheckboxChecked = checkedState
    .slice(0, 114)
    .some((checked) => checked);
  return (
    <Container>
      <h2 className="mb-5">اختيار السور</h2>
      <button className="mb-3 mybtn" onClick={toggleSelectAll}>
        {allSelected ? "ازلة اختيار جميع السور" : "اختيار جميع السور"}
      </button>
      <form dir="rtl">
        <Row>
          {surahNames.map((name, index) => (
            <Col
              xs={3}
              md={2}
              lg={1}
              key={index}
              className="mb-3 checkbox-col"
              onClick={(e) => handleColClick(e, index)}
            >
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`surah-checkbox-${index}`}
                  checked={checkedState[index]}
                  onChange={() => handleCheckboxChange(index)}
                />
                <span className="form-check-label">
                  {index + 1}: {name}
                </span>
              </div>
            </Col>
          ))}
        </Row>
      </form>
      <button
        className="mt-3 mybtn"
        onClick={handleConfirmSelection}
        disabled={!isAnyCheckboxChecked}
      >
        تأكيد الاختيار
      </button>
    </Container>
  );
};

export default SurahSelection;
