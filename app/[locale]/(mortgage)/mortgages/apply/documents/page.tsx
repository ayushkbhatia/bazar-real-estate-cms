import { UploadDocuments } from "../_steps/upload-documents";

/**
 * W5 · Salaried documents and W6 · Business Owner documents: one route, the
 * employment type picks the set (docs/mortgage/frontend/W5, W6).
 */
export default function DocumentsPage() {
  return <UploadDocuments />;
}
