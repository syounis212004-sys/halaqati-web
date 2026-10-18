// OCR remains Tesseract-based because Arabic is required.
// The engine is no longer part of the startup path; it is fetched only for image OCR.
export const OCR_ENGINE = 'tesseract-arabic-lazy';
