import type { ScheduleStatus } from './schedule';

/**
 * Exportação de tabelas para Excel (.xlsx) e PDF.
 *
 * As bibliotecas são carregadas por `import()` dinâmico — ou seja, só entram
 * no navegador quando o usuário clica em exportar. Elas NÃO pesam o bundle
 * principal do app.
 */

export interface ExportTable {
  /** Título impresso no topo do arquivo. */
  title: string;
  headers: string[];
  rows: (string | number)[][];
  /** Nome do arquivo, sem extensão. */
  fileName: string;
  /** Índice da coluna "Situação" (para colorir no PDF). -1 desliga. */
  statusColumn?: number;
  /** Semáforo de cada linha, na mesma ordem de `rows`. */
  statuses?: ScheduleStatus[];
}

/** Cores (RGB) do semáforo no PDF: [fundo, texto]. */
const PDF_STATUS_COLORS: Record<ScheduleStatus, [number[], number[]] | null> = {
  green: [[209, 250, 229], [6, 95, 70]],
  yellow: [[254, 243, 199], [146, 64, 14]],
  red: [[254, 226, 226], [153, 27, 27]],
  none: null,
};

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

/**
 * As fontes padrão do PDF (Helvetica/WinAnsi) não têm emoji: 🟢 virava
 * lixo ("Ø=ßã") e ainda comia a largura da célula. No PDF tiramos o emoji
 * — a cor da célula já diz a situação. No Excel ele continua.
 */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/gu;

function forPdf(value: string | number): string | number {
  if (typeof value !== 'string') return value;
  const stripped = value.replace(EMOJI, '');
  if (stripped === value) return value;
  // O emoji removido deixa um espaço sobrando no início da célula.
  return stripped.replace(/^ +/, '') || '—';
}

/**
 * Relatório: várias tabelas num arquivo só. No Excel cada bloco vira uma
 * **aba**; no PDF, uma seção embaixo da outra.
 */
export interface ExportReport {
  title: string;
  fileName: string;
  blocks: {
    /** Título da seção (vira o nome da aba no Excel). */
    heading: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
}

/** Nome de aba do Excel: 31 caracteres, sem os proibidos, e único. */
function sheetName(raw: string, taken: Set<string>): string {
  let name = raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Dados';
  let n = 2;
  while (taken.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = `${name.slice(0, 31 - suffix.length)}${suffix}`;
  }
  taken.add(name.toLowerCase());
  return name;
}

/** Gera e baixa o relatório em .xlsx — uma aba por bloco. */
export async function exportReportToXlsx(report: ExportReport): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const taken = new Set<string>();

  for (const block of report.blocks) {
    const aoa: (string | number)[][] = [
      [report.title],
      [block.heading],
      [new Date().toLocaleString()],
      [],
      block.headers,
      ...block.rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = block.headers.map((header, i) => {
      const longest = block.rows.reduce(
        (max, row) => Math.max(max, String(row[i] ?? '').length),
        header.length,
      );
      return { wch: Math.min(42, Math.max(11, longest + 2)) };
    });
    XLSX.utils.book_append_sheet(wb, ws, sheetName(block.heading, taken));
  }

  XLSX.writeFile(wb, `${sanitize(report.fileName)}.xlsx`);
}

/** Gera e baixa o relatório em PDF A4 retrato — uma seção por bloco. */
export async function exportReportToPdf(report: ExportReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default ?? autoTableModule.autoTable;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setFontSize(15);
  doc.setTextColor(20, 21, 42);
  doc.text(forPdf(report.title) as string, 40, 42);
  doc.setFontSize(8.5);
  doc.setTextColor(130, 130, 150);
  doc.text(new Date().toLocaleString(), 40, 58);

  let y = 76;
  for (const block of report.blocks) {
    if (y > doc.internal.pageSize.getHeight() - 140) {
      doc.addPage();
      y = 56;
    }
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 70);
    doc.text(forPdf(block.heading) as string, 40, y);

    autoTable(doc, {
      head: [block.headers.map(forPdf)],
      body: block.rows.map((row) => row.map(forPdf)),
      startY: y + 8,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', textColor: [58, 58, 82] },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [246, 247, 251] },
      didDrawPage: (data: any) => {
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 170);
        doc.text(
          `PERSONTASK — ${doc.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.getHeight() - 18,
        );
      },
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y) + 28;
  }

  doc.save(`${sanitize(report.fileName)}.pdf`);
}

/** Gera e baixa um .xlsx real (abre no Excel, LibreOffice, Google Sheets). */
export async function exportToXlsx(table: ExportTable): Promise<void> {
  const XLSX = await import('xlsx');

  const aoa: (string | number)[][] = [
    [table.title],
    [new Date().toLocaleString()],
    [],
    table.headers,
    ...table.rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largura das colunas: baseada no maior conteúdo (com limites).
  ws['!cols'] = table.headers.map((header, i) => {
    const longest = table.rows.reduce(
      (max, row) => Math.max(max, String(row[i] ?? '').length),
      header.length,
    );
    return { wch: Math.min(42, Math.max(9, longest + 2)) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cronograma');
  XLSX.writeFile(wb, `${sanitize(table.fileName)}.xlsx`);
}

/** Gera e baixa um PDF A4 paisagem, com a coluna de Situação colorida. */
export async function exportToPdf(table: ExportTable): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.default ?? autoTableModule.autoTable;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(15);
  doc.setTextColor(20, 21, 42);
  doc.text(table.title, 40, 38);

  doc.setFontSize(8.5);
  doc.setTextColor(130, 130, 150);
  doc.text(new Date().toLocaleString(), 40, 54);

  const statusColumn = table.statusColumn ?? -1;
  const statuses = table.statuses ?? [];

  autoTable(doc, {
    head: [table.headers.map(forPdf)],
    body: table.rows.map((row) => row.map(forPdf)),
    startY: 68,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 7.5, cellPadding: 3.5, overflow: 'linebreak', textColor: [58, 58, 82] },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    columnStyles:
      statusColumn >= 0 ? { [statusColumn]: { minCellWidth: 50, halign: 'center' } } : undefined,
    didParseCell: (data: any) => {
      if (data.section !== 'body' || data.column.index !== statusColumn) return;
      const colors = PDF_STATUS_COLORS[statuses[data.row.index] ?? 'none'];
      if (!colors) return;
      data.cell.styles.fillColor = colors[0];
      data.cell.styles.textColor = colors[1];
      data.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: (data: any) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 170);
      doc.text(
        `PERSONTASK — ${page}`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 18,
      );
    },
  });

  doc.save(`${sanitize(table.fileName)}.pdf`);
}
