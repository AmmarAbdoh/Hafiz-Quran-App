import GetVerseInfo from "../functions/GetVerseInfo"; // Adjust the import path as necessary
import { useContext } from "react";
import { MyContext } from "../useContext";

const VerseInfo = ({ verse }) => {
  const { surahNames } = useContext(MyContext);

  const verseID = verse.id;
  const verseInfo = GetVerseInfo({ verseID, surahNames });
  return (
    <div className="verse-info mt-5">
      <h4>معلومات الآية:</h4>
      <table className="verse-info-table">
        <tbody>
          {verseInfo.map((info, index) => (
            <tr key={index}>
              <td>
                <strong>{info.key}:</strong>
              </td>
              <td>{info.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default VerseInfo;
