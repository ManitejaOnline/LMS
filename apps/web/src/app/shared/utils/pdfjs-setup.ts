import { GlobalWorkerOptions } from 'pdfjs-dist';

/**
 * Configure PDF.js to use the real worker served from Angular assets.
 * The worker file is copied from `pdfjs-dist` via angular.json — never use
 * `new URL(..., import.meta.url)` with the Vite application builder (it
 * resolves to an unusable `/@fs/...` path and falls back to a fake worker).
 */
export function configurePdfJsWorker(): void {
  const workerUrl = new URL('assets/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  if (GlobalWorkerOptions.workerSrc === workerUrl) {
    return;
  }
  GlobalWorkerOptions.workerSrc = workerUrl;
}
