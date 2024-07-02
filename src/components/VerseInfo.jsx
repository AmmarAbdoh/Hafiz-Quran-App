import GetVerseInfo from "../functions/GetVerseInfo"; // Adjust the import path as necessary

const VerseInfo = ({ verse }) => {
  const verseInfo = GetVerseInfo({ verse });
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
