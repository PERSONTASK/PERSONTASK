import type { ScheduleStatus } from './schedule';

/**
 * Impressão do **Gantt em PDF**. O gráfico é desenhado direto no PDF com
 * retângulos e linhas (sem html2canvas), então sai vetorial — dá zoom sem
 * serrilhar e o arquivo fica leve. A `jspdf` entra por `import()`
 * dinâmico, igual às outras exportações.
 */

export interface GanttRow {
  wbs: string;
  name: string;
  indent: number;
  start: string | null;
  end: string | null;
  /** % concluído informado (0–100). */
  progress: number;
  /** % previsto pelo tempo decorrido (null quando faltam datas). */
  planned: number | null;
  status: ScheduleStatus;
}

export interface GanttPdfInput {
  title: string;
  fileName: string;
  rows: GanttRow[];
  /** Desenha a segunda barra (previsto) embaixo da barra real. */
  compare: boolean;
  /** Rótulos traduzidos usados na legenda. */
  labels: { real: string; planned: string; today: string };
}

const BAR: Record<ScheduleStatus, { bg: [number, number, number]; fill: [number, number, number] }> = {
  green: { bg: [209, 250, 229], fill: [16, 185, 129] },
  yellow: { bg: [254, 243, 199], fill: [245, 158, 11] },
  red: { bg: [254, 226, 226], fill: [239, 68, 68] },
  none: { bg: [230, 231, 240], fill: [152, 152, 184] },
};

const PLANNED_BG: [number, number, number] = [232, 233, 242];
const PLANNED_FILL: [number, number, number] = [120, 120, 150];

const DAY = 86_400_000;
const MONTHS_SHORT = { month: 'short' } as const;

function dayStart(value: string | number | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

export async function exportGanttToPdf(input: GanttPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 30;
  const labelW = 196;
  const chartX = margin + labelW;
  const chartW = pageW - margin - chartX;
  const rowH = 15;
  const headerY = 78;
  const firstRowY = headerY + 16;
  const bottom = pageH - 42;

  // ── Escala de tempo ───────────────────────────────────────────────────
  const dated = input.rows.filter((r) => r.start && r.end);
  const times = dated.flatMap((r) => [dayStart(r.start!), dayStart(r.end!)]);
  const today = dayStart(new Date());
  const from = (times.length ? Math.min(...times) : today) - DAY;
  const to = (times.length ? Math.max(...times) : today + 14 * DAY) + DAY;
  const totalDays = Math.max(1, Math.round((to - from) / DAY) + 1);
  const pxPerDay = chartW / totalDays;
  const xOf = (when: string | number | Date) => chartX + ((dayStart(when) - from) / DAY) * pxPerDay;

  /** Marcas da régua: semanal em projetos curtos, mensal nos longos. */
  const ticks: { x: number; label: string; strong: boolean }[] = [];
  const cursor = new Date(from);
  if (totalDays <= 70) {
    // Próxima segunda-feira como primeira marca.
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));
    while (cursor.getTime() <= to) {
      ticks.push({
        x: xOf(cursor.getTime()),
        label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
        strong: cursor.getDate() <= 7,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    cursor.setDate(1);
    while (cursor.getTime() <= to) {
      ticks.push({
        x: xOf(cursor.getTime()),
        label: `${cursor.toLocaleDateString(undefined, MONTHS_SHORT)}/${String(cursor.getFullYear()).slice(2)}`,
        strong: cursor.getMonth() === 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // ── Cabeçalho da página (repetido em cada folha) ──────────────────────
  let page = 1;
  function drawFrame() {
    doc.setFontSize(14);
    doc.setTextColor(20, 21, 42);
    doc.text(doc.splitTextToSize(input.title, pageW - 2 * margin)[0], margin, 40);

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 150);
    doc.text(new Date().toLocaleString(), margin, 55);

    // Régua de datas + grade vertical.
    doc.setFontSize(7);
    for (const tick of ticks) {
      doc.setDrawColor(...strongOrFaint(tick.strong));
      doc.setLineWidth(tick.strong ? 0.7 : 0.35);
      doc.line(tick.x, headerY, tick.x, bottom);
      doc.setTextColor(130, 130, 150);
      doc.text(tick.label, tick.x + 2, headerY - 4);
    }

    // Linha do "hoje".
    const tx = xOf(today);
    if (tx >= chartX && tx <= chartX + chartW) {
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(1);
      doc.setLineDashPattern([3, 2], 0);
      doc.line(tx, headerY - 2, tx, bottom);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6.5);
      doc.setTextColor(239, 68, 68);
      doc.text(input.labels.today, tx + 2, headerY - 13);
    }

    // Separador da coluna de rótulos.
    doc.setDrawColor(200, 200, 215);
    doc.setLineWidth(0.6);
    doc.line(chartX - 6, headerY, chartX - 6, bottom);

    drawFooter();
  }

  function strongOrFaint(strong: boolean): [number, number, number] {
    return strong ? [205, 206, 220] : [230, 231, 240];
  }

  function drawFooter() {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 170);
    doc.text(`PERSONTASK — ${page}`, margin, pageH - 18);

    // Legenda real × previsto.
    let lx = margin + 90;
    const ly = pageH - 22;
    const chip = (color: [number, number, number], text: string) => {
      doc.setFillColor(...color);
      doc.rect(lx, ly, 14, 5, 'F');
      doc.setTextColor(110, 110, 135);
      doc.text(text, lx + 18, ly + 4.5);
      lx += 24 + doc.getTextWidth(text);
    };
    chip(BAR.green.fill, input.labels.real);
    if (input.compare) chip(PLANNED_FILL, input.labels.planned);
  }

  drawFrame();
  let y = firstRowY;

  for (const row of input.rows) {
    if (y + rowH > bottom) {
      doc.addPage();
      page += 1;
      drawFrame();
      y = firstRowY;
    }

    // Rótulo (EDT + nome, recuado pelo nível).
    const indentPt = Math.min(2, Math.max(0, row.indent)) * 9;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 170);
    doc.text(row.wbs, margin + indentPt, y + 9);
    const wbsW = doc.getTextWidth(row.wbs) + 4;

    doc.setTextColor(45, 45, 70);
    doc.setFontSize(row.indent === 0 ? 7.5 : 7);
    const nameW = labelW - indentPt - wbsW - 8;
    const name = doc.splitTextToSize(row.name || '—', Math.max(20, nameW))[0];
    doc.text(name, margin + indentPt + wbsW, y + 9);

    // Barras.
    if (row.start && row.end) {
      const bx = xOf(row.start);
      const bw = Math.max(2.5, xOf(row.end) + pxPerDay - bx);
      const colors = BAR[row.status];
      const pct = Math.min(100, Math.max(0, row.progress));

      if (input.compare) {
        const h = 4.2;
        const gap = 1.6;
        const topY = y + 2.5;
        doc.setFillColor(...colors.bg);
        doc.rect(bx, topY, bw, h, 'F');
        doc.setFillColor(...colors.fill);
        doc.rect(bx, topY, (bw * pct) / 100, h, 'F');

        const planned = row.planned === null ? 0 : Math.min(100, Math.max(0, row.planned));
        const botY = topY + h + gap;
        doc.setFillColor(...PLANNED_BG);
        doc.rect(bx, botY, bw, h, 'F');
        if (row.planned !== null) {
          doc.setFillColor(...PLANNED_FILL);
          doc.rect(bx, botY, (bw * planned) / 100, h, 'F');
        }
      } else {
        const h = 8;
        doc.setFillColor(...colors.bg);
        doc.rect(bx, y + 3, bw, h, 'F');
        doc.setFillColor(...colors.fill);
        doc.rect(bx, y + 3, (bw * pct) / 100, h, 'F');
      }

      doc.setFontSize(6);
      doc.setTextColor(140, 140, 165);
      doc.text(`${Math.round(pct)}%`, Math.min(bx + bw + 3, pageW - margin - 14), y + 9);
    }

    // Linha divisória da raia.
    doc.setDrawColor(238, 239, 246);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowH - 1, pageW - margin, y + rowH - 1);

    y += rowH;
  }

  doc.save(`${sanitize(input.fileName)}.pdf`);
}
