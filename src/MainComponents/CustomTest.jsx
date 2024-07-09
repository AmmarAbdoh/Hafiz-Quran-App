import { useEffect, useState } from "react";
import CustomSettings from "../components/CustomSettings";
import RemoveBackground from "../functions/RemoveBackground";

const CustomTest = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  RemoveBackground();

  if (loading) {
    return <h3>جاري التحميل</h3>;
  }

  if (error) {
    return <div>حدث خطأ</div>;
  }

  return <CustomSettings></CustomSettings>;
};

export default CustomTest;
