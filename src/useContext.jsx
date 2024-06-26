import React, { createContext, useState } from "react";

export const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const [quranSelection, setQuranSelection] = useState([]);

  return (
    <MyContext.Provider value={{ quranSelection, setQuranSelection }}>
      {children}
    </MyContext.Provider>
  );
};
