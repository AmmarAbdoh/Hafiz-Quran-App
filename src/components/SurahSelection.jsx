import React, { useState, useContext } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import { MyContext } from "../useContext";

const SurahSelection = () => {
  const { setQuranSelection, surahNames } = useContext(MyContext);
  const [checkedState, setCheckedState] = useState(new Array(115).fill(false));
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredSurahNames = surahNames
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name.includes(searchQuery));

  return (
    <Container>
      <h2 className="mb-5">اختيار السور</h2>
      <button className="mb-3 mybtn" onClick={toggleSelectAll}>
        {allSelected ? "ازلة اختيار جميع السور" : "اختيار جميع السور"}
      </button>
      <form dir="rtl">
        <Row>
          <Form.Control
            type="text"
            placeholder="ابحث عن سورة..."
            className="mb-3"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {filteredSurahNames.map(({ name, index }) => (
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
