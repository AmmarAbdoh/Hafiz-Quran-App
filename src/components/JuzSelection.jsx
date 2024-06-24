import React, { useState } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";

const juzNames = [
  "البسملة",
  "سيقول السفهاء",
  "تلك الرسل",
  "لن تنالوا البر",
  "والمحصنات",
  "لا يحب الله",
  "لتجدن",
  "ولو أننا نزلنا",
  "قال الملأ",
  "واعلموا",
  "إنما السبيل",
  "ومامن دابة",
  "وما أبرئ نفسي",
  "الـر",
  "سبحان",
  "قال ألم",
  "اقترب للناس",
  "قد أفلح",
  "وقال الذين لا يرجون",
  "فما كان جواب قومه",
  "ولا تجادلوا",
  "ومن يقنت",
  "وما أنزلنا",
  "فمن أظلم",
  "إليه يرد",
  "حـم",
  "قال فما خطبكم",
  "قد سمع",
  "تبارك",
  "عمّ",
];

const JuzSelection = () => {
  const [checkedState, setCheckedState] = useState(new Array(30).fill(false));

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
    const allSelected = checkedState.every((state) => state);
    setCheckedState(new Array(30).fill(!allSelected));
  };

  const allSelected = checkedState.every((state) => state);

  return (
    <Container>
      <h2 className="mb-5">اختيار الاجزاء</h2>
      <button className="mb-3 mybtn" onClick={toggleSelectAll}>
        {allSelected ? "ازلة الاختيار لجميع الاجزاء" : "اختيار جميع الاجزاء"}
      </button>
      <form dir="rtl">
        <Row>
          {juzNames.map((name, index) => (
            <Col
              xs={12}
              md={6}
              lg={4}
              key={index}
              className="mb-3 checkbox-col"
              onClick={(e) => handleColClick(e, index)}
            >
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`juz-checkbox-${index}`}
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
    </Container>
  );
};

export default JuzSelection;
