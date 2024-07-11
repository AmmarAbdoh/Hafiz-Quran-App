import { useEffect, useState } from "react";
import CustomSettings from "../components/CustomSettings";
import RemoveBackground from "../functions/RemoveBackground";

const CustomTest = () => {
  RemoveBackground();
  return <CustomSettings></CustomSettings>;
};

export default CustomTest;
