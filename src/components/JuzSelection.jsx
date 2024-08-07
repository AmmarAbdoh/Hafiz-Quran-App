import React, { useState, useContext } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import { MyContext } from "../useContext";

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
  const { quranSelection, setQuranSelection } = useContext(MyContext);

  const [checkedState, setCheckedState] = useState(new Array(31).fill(false));
  const [searchQuery, setSearchQuery] = useState("");
  checkedState[30] = false;

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
    const allSelected = checkedState.slice(0, 30).every((state) => state);
    const newState = checkedState.map((state, index) => {
      if (index < 30) {
        return !allSelected;
      }
      return state;
    });
    setCheckedState(newState);
  };

  const handleConfirmSelection = () => {
    console.log(checkedState.filter((value) => value === true).length);
    console.log(checkedState.length);
    setQuranSelection(checkedState); // Send the selected surahs to context
  };

  const allSelected = checkedState.slice(0, 30).every((state) => state);
  const isAnyCheckboxChecked = checkedState.some((checked) => checked);

  const filteredJuzNames = juzNames
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name.includes(searchQuery));

  return (
    <Container>
      <h2 className="mb-5">اختيار الاجزاء</h2>
      <button className="mb-3 mybtn" onClick={toggleSelectAll}>
        {allSelected ? "ازلة الاختيار لجميع الاجزاء" : "اختيار جميع الاجزاء"}
      </button>
      <form dir="rtl">
        <Row>
          <Form.Control
            type="text"
            placeholder="ابحث عن جزء..."
            className="mb-3"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {filteredJuzNames.map(({ name, index }) => (
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

export default JuzSelection;
