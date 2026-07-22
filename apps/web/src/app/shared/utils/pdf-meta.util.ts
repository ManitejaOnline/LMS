import * as pdfjsLib from 'pdfjs-dist';
import { configurePdfJsWorker } from './pdfjs-setup';

/** ~1.5 minutes per page — typical corporate reading pace. */
const MINUTES_PER_PAGE = 1.5;

function pdfJs() {
  configurePdfJsWorker();
  return pdfjsLib;
}

export async function detectPdfPageCount(url: string): Promise<number> {
  const doc = await pdfJs().getDocument(url).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

export interface PdfPageThumb {
  page: number;
  dataUrl: string;
}

export async function renderPdfPageThumbnails(
  url: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ pageCount: number; thumbs: PdfPageThumb[] }> {
  const doc = await pdfJs().getDocument(url).promise;
  const pageCount = doc.numPages;
  const thumbs: PdfPageThumb[] = [];

  try {
    for (let page = 1; page <= pageCount; page++) {
      const pdfPage = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 0.28 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      thumbs.push({ page, dataUrl: canvas.toDataURL('image/jpeg', 0.72) });
      onProgress?.(page, pageCount);
      pdfPage.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return { pageCount, thumbs };
}

export interface ChapterDraft {
  clientId: string;
  lessonId?: string;
  title: string;
  pageStart: number;
  pageEnd: number;
}

export function newChapterClientId(): string {
  return `ch-${crypto.randomUUID()}`;
}

export function chapterPageCount(ch: Pick<ChapterDraft, 'pageStart' | 'pageEnd'>): number {
  return Math.max(0, ch.pageEnd - ch.pageStart + 1);
}

export function estimateReadingMinutes(pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.max(1, Math.ceil(pageCount * MINUTES_PER_PAGE));
}

export function chapterConfig(pageStart: number, pageEnd: number): Record<string, unknown> {
  return { kind: 'PDF_CHAPTER', pageStart, pageEnd };
}

export function readChapterBounds(
  quizConfig: Record<string, unknown> | null | undefined,
): { pageStart: number | null; pageEnd: number | null } {
  if (!quizConfig || quizConfig['kind'] !== 'PDF_CHAPTER') {
    return { pageStart: null, pageEnd: null };
  }
  const pageStart = Number(quizConfig['pageStart']) || null;
  const pageEnd = Number(quizConfig['pageEnd']) || null;
  return { pageStart, pageEnd };
}

/** Returns chapter clientId covering a page, if any. */
export function chapterCoveringPage(
  chapters: ChapterDraft[],
  page: number,
): ChapterDraft | null {
  return (
    chapters.find((c) => page >= c.pageStart && page <= c.pageEnd) ?? null
  );
}

export function pagesOverlapChapter(
  chapters: ChapterDraft[],
  start: number,
  end: number,
  excludeClientId?: string,
): boolean {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return chapters.some(
    (c) =>
      c.clientId !== excludeClientId &&
      !(hi < c.pageStart || lo > c.pageEnd),
  );
}
