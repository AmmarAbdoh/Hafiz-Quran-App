import React, { useState, useEffect } from "react";
import { Container, Form, Button } from "react-bootstrap";
import GetVerseInfo from "../functions/GetVerseInfo"; // Adjust the import path as necessary

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

const InfoQuestion = ({ verse, onNextQuestion }) => {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState(null);

  useEffect(() => {
    // Retrieve verse info
    const verseInfo = GetVerseInfo({ verse });

    // Define possible questions
    const questions = [
      {
        key: "اسم السورة",
        value: verseInfo[0].value,
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
        question: (
          <>
            <div className="mb-5">ما هو رقم الصفحة للآية:</div>
            <div className="mb-5">{verse.text_uthmani}</div>
            <div>في سورة: {verseInfo[0].value}</div>
          </>
        ),
      },
    ];

    // Randomly select a question
    const randomQuestion =
      questions[Math.floor(Math.random() * questions.length)];
    setQuestion(randomQuestion);
  }, [verse]);

  const handleAnswerChange = (event) => {
    setAnswer(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsCorrect(answer === String(question.value));
  };

  return (
    <Container dir="rtl">
      {question && (
        <div>
          <h4>{question.question}</h4>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="answer">
              <Form.Label>الإجابة</Form.Label>
              <Form.Control
                type="text"
                value={answer}
                onChange={handleAnswerChange}
              />
            </Form.Group>
            <btn className="mt-3 mybtn" type="submit">
              تحقق
            </btn>
          </Form>
        </div>
      )}

      {isCorrect !== null && (
        <div className="feedback mt-5">
          {isCorrect ? (
            <h3 style={{ color: "green" }}>صحيح! بارك الله فيك!</h3>
          ) : (
            <h3 style={{ color: "red" }}>اجابة خاطئة.</h3>
          )}
          <btn className="mt-3 mybtn" onClick={onNextQuestion}>
            السؤال التالي
          </btn>
        </div>
      )}
    </Container>
  );
};

export default InfoQuestion;
