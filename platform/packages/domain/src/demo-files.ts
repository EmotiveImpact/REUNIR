/** Fictional sample file for the browser demonstration. Generated, never real member content. */
export const DEMO_WORKSHEET_FILE = 'file_problem_worksheet';
/** The fictional cover library's one picture: the bundled landscape, cropped so no caption shows. No bytes are stored. */
export const DEMO_COVER_LIBRARY_FILE = 'file_cover_mountain';
const lines = [
    'Problem interview worksheet',
    'Fictional REUNIR demonstration resource',
    '',
    '1. Who did you speak to, and what are they trying to do?',
    '2. When did the problem last happen?',
    '3. How do they deal with it today?',
    '4. What did they say, in their own words?',
    '5. What are you assuming that they did not say?',
    '',
    'Keep what you heard separate from what you think it means.',
];
const escapePdf = (value: string) => value.replace(/[\\()]/g, c => '\\' + c);
/** A minimal one-page PDF built from ASCII text, so its byte length is stable across runtimes. */
export function demoWorksheetPdf(): Uint8Array<ArrayBuffer> {
    const text = lines.map((line, i) => `BT /F1 ${i === 0 ? 18 : 11} Tf 56 ${780 - i * 24} Td (${escapePdf(line)}) Tj ET`).join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = objects.map((body, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
}
