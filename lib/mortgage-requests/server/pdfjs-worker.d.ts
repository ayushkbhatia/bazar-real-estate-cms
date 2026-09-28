// pdfjs-dist ships no types for its worker module; verify.ts only imports it
// for the side effect of registering the in-thread worker.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
