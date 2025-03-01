import { useState, useEffect, useContext } from "react";
import { Container } from "react-bootstrap";
import PropTypes from "prop-types";
import GetVerseInfo from "../functions/GetVerseInfo";
import SearchForInfo from "./SearchForInfo";
import VerseInfo from "../components/VerseInfo";
import { MyContext } from "../useContext";

const InfoQuestion = ({ verse, onNextQuestion, selectedOption }) => {
  const [question, setQuestion] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const { surahNames } = useContext(MyContext);
  const verseID = verse.id;

  useEffect(() => {
    const verseInfo = GetVerseInfo({ verseID, surahNames });
    console.log("🚀 ~ useEffect ~ verseInfo:", verseInfo);

    const questions = [
      {
        key: "اسم السورة",
        value: verseInfo[0].value,
        searchType: 1,
        question: (
          <>
            <div className="mb-5">ما هو اسم السورة لهذه الاية:</div>
            <div>{verse.text_uthmani}</div>
          </>
        ),
      },
      {
        key: "رقم الاية",
        value: verseInfo[1].value,
        searchType: 2,
        question: (
          <>
            <div className="mb-5">ما هو رقم هذه الاية:</div>
            <div className="mb-5">{verse.text_uthmani}</div>
            <div>في سورة: {verseInfo[0].value}</div>
          </>
        ),
      },
      {
        key: "رقم الجزء",
        value: verseInfo[2].value,
        searchType: 3,
        question: (
          <>
            <div className="mb-5">ما هو رقم الجزء للآية:</div>
            <div className="mb-5">{verse.text_uthmani}</div>
            <div>في سورة: {verseInfo[0].value}</div>
          </>
        ),
      },
      {
        key: "رقم الحزب",
        value: verseInfo[3].value,
        searchType: 4,
        question: (
          <>
            <div className="mb-5">ما هو رقم الحزب للآية:</div>
            <div className="mb-5">{verse.text_uthmani}</div>
            <div>في سورة: {verseInfo[0].value}</div>
          </>
        ),
      },
      {
        key: "الصفحة",
        value: verseInfo[4].value,
        searchType: 5,
        question: (
          <>
            <div className="mb-5">ما هو رقم الصفحة للآية:</div>
            <div className="mb-5">{verse.text_uthmani}</div>
            <div>في سورة: {verseInfo[0].value}</div>
          </>
        ),
      },
    ];

    const randomQuestion = questions[selectedOption - 1];
    setQuestion(randomQuestion);
  }, [verse]);

  const handleSetAnswer = (answer) => {
    if (question) {
      setIsCorrect(answer === String(question.value));
    }
  };

  const handleNextQuestion = () => {
    setIsCorrect(null);
    setQuestion(null);
    onNextQuestion();
  };

  return (
    <Container dir="rtl">
      {question && (
        <div>
          <h4>{question.question}</h4>
          {isCorrect === null && (
            <SearchForInfo
              setAnswer={handleSetAnswer}
              searchType={question.searchType}
            />
          )}
        </div>
      )}

      {isCorrect !== null && (
        <div className="feedback mt-5">
          {isCorrect ? (
            <h3 style={{ color: "green" }}>صحيح! بارك الله فيك!</h3>
          ) : (
            <h3 style={{ color: "red" }}>اجابة خاطئة.</h3>
          )}

          <VerseInfo verse={verse} />

          <button className="mt-3 mybtn" onClick={handleNextQuestion}>
            السؤال التالي
          </button>
        </div>
      )}
    </Container>
  );
};

InfoQuestion.propTypes = {
  verse: PropTypes.object.isRequired,
  onNextQuestion: PropTypes.func.isRequired,
  selectedOption: PropTypes.number.isRequired,
};

export default InfoQuestion;
