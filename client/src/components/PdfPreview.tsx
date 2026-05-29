import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface Props {
  pdfUrl: string;
  pageNumber: number;
  width?: number;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: (message: string) => void;
}

export default function PdfPreview({ pdfUrl, pageNumber, width = 320, onLoadSuccess, onLoadError }: Props) {
  return (
    <Document
      file={pdfUrl}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      onLoadError={(err) => onLoadError(err.message)}
      loading=""
      className="w-full"
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        className="mx-auto pointer-events-none"
        loading={<div className="h-[200px]" />}
      />
    </Document>
  );
}
