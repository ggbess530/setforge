// ▸ Place at: lib/pdf-export.ts
// Client-side PDF generation for public sets — same "no server needed"
// philosophy as the Rekordbox/Serato/Traktor exporters in export-utils.ts.
// Light/print-friendly theme (not the app's dark UI) since PDFs are meant to
// be viewed and printed, not just displayed on screen.

import { jsPDF } from 'jspdf'

export interface PdfTrack {
  n: number; artist: string; title: string; bpm: number; key: string; energy: number; transition?: string
}

const CYAN: [number, number, number]    = [0, 180, 200]
const MAGENTA: [number, number, number] = [220, 20, 120]
const INK: [number, number, number]     = [25, 25, 35]
const GRAY: [number, number, number]    = [130, 130, 140]
const LIGHT_GRAY: [number, number, number] = [225, 225, 232]

export function generateSetPdf(setTitle: string, summary: string, tracks: PdfTrack[], tags: (string | number | undefined | null)[] = []): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44
  const bottomMargin = 46
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...CYAN)
  doc.text('SET', margin, y)
  doc.setTextColor(...MAGENTA)
  doc.text('FORGE', margin + doc.getTextWidth('SET'), y)
  y += 30

  doc.setTextColor(...INK)
  doc.setFontSize(20)
  const titleLines = doc.splitTextToSize(setTitle, pageWidth - margin * 2)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 22 + 4

  if (summary) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY)
    const summaryLines = doc.splitTextToSize(summary, pageWidth - margin * 2)
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 13 + 8
  }

  const tagText = tags.filter(Boolean).join('   ·   ')
  if (tagText) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text(tagText, margin, y)
    y += 18
  }

  y += 8
  doc.setDrawColor(...LIGHT_GRAY)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  const col = { n: margin, track: margin + 32, bpm: pageWidth - margin - 130, key: pageWidth - margin - 82, energy: pageWidth - margin - 30 }
  const trackColWidth = col.bpm - col.track - 10

  function drawTableHeader() {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    doc.text('#', col.n, y)
    doc.text('TRACK', col.track, y)
    doc.text('BPM', col.bpm, y)
    doc.text('KEY', col.key, y)
    doc.text('NRG', col.energy, y)
    y += 8
    doc.setDrawColor(...LIGHT_GRAY)
    doc.line(margin, y, pageWidth - margin, y)
    y += 16
  }
  drawTableHeader()

  tracks.forEach(t => {
    const trackLine = `${t.artist} — ${t.title}`
    const trackLines = doc.splitTextToSize(trackLine, trackColWidth)
    const noteLines  = t.transition ? doc.splitTextToSize(`↳ ${t.transition}`, trackColWidth) : []
    const rowHeight = Math.max(trackLines.length, 1) * 12 + noteLines.length * 11 + 10

    if (y + rowHeight > pageHeight - bottomMargin) {
      doc.addPage()
      y = margin
      drawTableHeader()
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(String(t.n).padStart(2, '0'), col.n, y)
    doc.setFont('helvetica', 'normal')
    doc.text(trackLines, col.track, y)
    doc.setTextColor(...CYAN)
    doc.text(String(t.bpm), col.bpm, y)
    doc.setTextColor(...INK)
    doc.text(t.key, col.key, y)
    doc.text(String(t.energy), col.energy, y)

    y += trackLines.length * 12 + 2
    if (noteLines.length) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRAY)
      doc.text(noteLines, col.track, y)
      y += noteLines.length * 11
    }
    y += 8
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Generated with SetForge — setforge.online', margin, pageHeight - 22)
    doc.text(`${i} / ${pageCount}`, pageWidth - margin - 30, pageHeight - 22)
  }

  return doc.output('blob')
}

// Opens the PDF in a new tab for viewing — browsers render blob: PDF URLs
// natively. Deliberately doesn't revoke the object URL: the new tab needs it
// to stay valid for as long as that tab is open.
export function viewPdfInNewTab(blob: Blob) {
  window.open(URL.createObjectURL(blob), '_blank')
}
