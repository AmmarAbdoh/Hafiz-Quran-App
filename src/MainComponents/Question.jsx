import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import FillTheBlank from "../QuestionsComponents/FillTheBlank";
import InfoQuestion from "../QuestionsComponents/InfoQuestion";
import { fetchRandomAyah } from "../functions/RandomAyah";

const Question = ({ quranSelection }) => {
  var surahNameDisabled = false;
  var juzNameDisabled = false;
  if (
    quranSelection.length === 115 &&
    quranSelection.filter((value) => value === true).length === 2
  ) {
    surahNameDisabled = true;
  }

  if (
    quranSelection.length === 31 &&
    quranSelection.filter((value) => value === true).length === 1
  ) {
    juzNameDisabled = true;
  }

  const [randomVerse, setRandomVerse] = useState(null);
  const [questionType, setQuestionType] = useState(null);
  const [showAllOptions, setShowAllOptions] = useState(false); // State to manage whether to show all options
  const [selectedOptions, setSelectedOptions] = useState([]); // State to manage selected checkboxes
  const [randomSelectedOption, setRandomSelectedOption] = useState(null); // State to store random selected option
  const [isAnyCheckboxSelected, setIsAnyCheckboxSelected] = useState(false); // State to track if any checkbox is selected
  const navigate = useNavigate(); // Use the useNavigate hook

  const fetchNewRandomVerse = () => {
    fetchRandomAyah(quranSelection, setRandomVerse);
    // Randomly select between FillTheBlank and InfoQuestion
    const types = ["FillTheBlank", "InfoQuestion"];
    setQuestionType(types[Math.floor(Math.random() * types.length)]);
    // Update random selected option
    selectRandomOption();
  };

  const selectRandomOption = () => {
    if (selectedOptions.length > 0) {
      const randomIndex = Math.floor(Math.random() * selectedOptions.length);
      const randomOption = selectedOptions[randomIndex];
      setRandomSelectedOption(randomOption);
      console.log("Randomly selected option:", randomOption);
    }
  };

  useEffect(() => {
    fetchNewRandomVerse();
  }, [quranSelection]);

  const handleCheckboxChange = (event) => {
    const value = event.target.value;
    setSelectedOptions((prevSelectedOptions) =>
      prevSelectedOptions.includes(value)
        ? prevSelectedOptions.filter((option) => option !== value)
        : [...prevSelectedOptions, value]
    );
  };

  useEffect(() => {
    setIsAnyCheckboxSelected(selectedOptions.length > 0);
  }, [selectedOptions]);

  const handleShowAllOptions = () => {
    console.log("Selected options:", selectedOptions);
    selectRandomOption();
    setShowAllOptions(true);
  };

  const handleBack = () => {
    setShowAllOptions(false);
  };

  const handleCustomTest = () => {
    navigate("/custom-test");
  };

  if (!randomVerse || !questionType) {
    return (
      <div className="tabs">
        <div>تحميل...</div>
      </div>
    );
  }

  return (
    <div>
      {!showAllOptions && (
        <div className="question-selector">
          <h3 className="mb-5">الرجاء اختيار نوع الاسئلة</h3>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="0"
                onChange={handleCheckboxChange}
              />
              املأ الفراغ
              <span className="checkmark"></span>
            </label>
          </div>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="1"
                onChange={handleCheckboxChange}
                disabled={surahNameDisabled}
              />
              اسم السورة
              <span className="checkmark"></span>
            </label>
          </div>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="2"
                onChange={handleCheckboxChange}
              />
              رقم الاية
              <span className="checkmark"></span>
            </label>
          </div>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="3"
                onChange={handleCheckboxChange}
                disabled={juzNameDisabled}
              />
              رقم الجزء
              <span className="checkmark"></span>
            </label>
          </div>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="4"
                onChange={handleCheckboxChange}
              />
              رقم الحزب
              <span className="checkmark"></span>
            </label>
          </div>
          <div className="checkbox-container">
            <label>
              <input
                type="checkbox"
                value="5"
                onChange={handleCheckboxChange}
              />
              رقم الصفحة
              <span className="checkmark"></span>
            </label>
          </div>

          <button className="mybtn mt-5 me-5" onClick={handleCustomTest}>
            عودة
          </button>
          <button
            className="mybtn mt-5"
            onClick={handleShowAllOptions}
            disabled={!isAnyCheckboxSelected} // Disable the button if no checkbox is selected
          >
            بدأ الاختبار
          </button>
        </div>
      )}

      {showAllOptions && (
        <>
          {randomSelectedOption === "0" && (
            <FillTheBlank
              verse={randomVerse}
              onNextQuestion={fetchNewRandomVerse}
            />
          )}

          {randomSelectedOption !== "0" && (
            <InfoQuestion
              verse={randomVerse}
              onNextQuestion={fetchNewRandomVerse}
              selectedOption={randomSelectedOption} // Pass the selected option as a prop
            />
          )}
          <button className="mybtn mt-3 mb-3" onClick={handleBack}>
            عودة
          </button>
        </>
      )}
    </div>
  );
};

Question.propTypes = {
  quranSelection: PropTypes.arrayOf(PropTypes.bool).isRequired, // Add prop validation
};

export default Question;
