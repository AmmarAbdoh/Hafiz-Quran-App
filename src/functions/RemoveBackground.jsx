import { useEffect } from "react";

const RemoveBackground = () => {

  document.body.classList.remove("background-image-class");
  document.body.classList.add("background-blank");

  return () => {
    document.body.classList.remove("background-blank");
    document.body.classList.add("background-image-class");
  };
};
export default RemoveBackground;
