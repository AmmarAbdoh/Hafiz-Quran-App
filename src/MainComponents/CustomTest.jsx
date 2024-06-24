import { useEffect, useState } from "react";
import CustomSettings from "../components/CustomSettings";

const CustomTest = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Change the chapter number as needed
    const chapterNumber = 1;
    fetch(`/Quran/Chapters_Uthmani/chapter_${chapterNumber}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error);
        setLoading(false);
      });

    document.body.classList.remove("background-image-class");
    document.body.classList.add("background-blank");

    return () => {
      document.body.classList.remove("background-blank");
      document.body.classList.add("background-image-class");
    };
  }, []);

  if (loading) {
    return <h3>جاري التحميل</h3>;
  }

  if (error) {
    return <div>حدث خطأ</div>;
  }

  return <CustomSettings></CustomSettings>;
};

export default CustomTest;
