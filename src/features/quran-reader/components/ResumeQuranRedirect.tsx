import { Navigate } from "react-router-dom";
import { getResumeReaderPath } from "@/features/quran-reader/services/readerPositionStorage";

export function ResumeQuranRedirect() {
  return <Navigate to={getResumeReaderPath()} replace />;
}
