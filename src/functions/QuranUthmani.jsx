export const fetchQuranData = async () => {
  try {
    const response = await fetch("/public/Quran/Quran_Uthmani.json"); // Adjust the path as necessary
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const QuranData = await response.json();
    return QuranData.verses;
  } catch (error) {
    console.error("Error fetching Quran data:", error);
    return [];
  }
};
