// Utilitários de relatório compartilhados (Lojinha, Cantina, Financeiro).
// Exportação para Excel (CSV com BOM, aceito pelo Excel em pt-BR) e para PDF
// (janela de impressão formatada — "Salvar como PDF"). Sem dependências novas.

export const fmtBRL = (n: number | string | null | undefined): string =>
  `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Converte 'yyyy-MM-ddTHH:mm:ssZ' (ou Date) em 'yyyy-MM-dd'
export const dateKey = (d?: string | Date | null): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// true se a data (string ISO ou 'yyyy-MM-dd') está dentro do intervalo [start, end].
// start/end em 'yyyy-MM-dd' (inclusivos). null = sem limite daquele lado.
export const inRange = (dateStr?: string | null, start?: string | null, end?: string | null): boolean => {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

const br = (s: string) => s.split('-').reverse().join('/'); // 'yyyy-MM-dd' -> 'dd/MM/yyyy'

export const rangeLabel = (start?: string | null, end?: string | null): string => {
  if (start && end) return start === end ? br(start) : `${br(start)} a ${br(end)}`;
  if (start) return `A partir de ${br(start)}`;
  if (end) return `Até ${br(end)}`;
  return 'Todo o período';
};

// ---------- Exportar para Excel (CSV) ----------
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))];
  const content = '﻿' + lines.join('\r\n'); // BOM p/ acentuação no Excel
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- Exportar para PDF (janela de impressão) ----------
export interface ReportTable {
  title?: string;
  headers: string[];
  rows: (string | number)[][];
  align?: ('left' | 'right' | 'center')[];
  totals?: (string | number)[]; // linha de totais (opcional)
  emptyText?: string;
}

export interface ReportOptions {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  kpis?: { label: string; value: string; tone?: 'green' | 'red' | 'blue' | 'gray' }[];
  tables: ReportTable[];
  filename?: string;
}

const toneColor: Record<string, string> = {
  green: '#059669', red: '#dc2626', blue: '#2563eb', gray: '#334155'
};

const escapeHtml = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function tableHtml(t: ReportTable): string {
  const align = (i: number) => t.align?.[i] || (i === 0 ? 'left' : 'right');
  const head = `<tr>${t.headers.map((h, i) => `<th style="text-align:${align(i)}">${escapeHtml(h)}</th>`).join('')}</tr>`;
  const body = t.rows.length
    ? t.rows.map(r => `<tr>${r.map((c, i) => `<td style="text-align:${align(i)}">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${t.headers.length}" style="text-align:center;color:#94a3b8;padding:18px">${escapeHtml(t.emptyText || 'Sem registros no período.')}</td></tr>`;
  const totals = t.totals
    ? `<tr class="totals">${t.totals.map((c, i) => `<td style="text-align:${align(i)}">${escapeHtml(c)}</td>`).join('')}</tr>`
    : '';
  return `
    ${t.title ? `<h2>${escapeHtml(t.title)}</h2>` : ''}
    <table><thead>${head}</thead><tbody>${body}${totals}</tbody></table>`;
}

export function openPrintableReport(opts: ReportOptions) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Não foi possível abrir a janela do relatório. Permita pop-ups para este site e tente novamente.');
    return;
  }
  const logo = `${window.location.origin}/logos/logo-grupo.PNG`;
  const now = new Date().toLocaleString('pt-BR');

  const kpisHtml = opts.kpis?.length
    ? `<div class="kpis">${opts.kpis.map(k => `
        <div class="kpi">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value" style="color:${toneColor[k.tone || 'gray']}">${escapeHtml(k.value)}</div>
        </div>`).join('')}</div>`
    : '';

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(opts.filename || opts.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; margin:0; padding:32px; }
  .top { display:flex; align-items:center; gap:16px; border-bottom:3px solid #2563eb; padding-bottom:16px; margin-bottom:20px; }
  .top img { height:56px; width:auto; }
  .top h1 { font-size:20px; margin:0; }
  .top .sub { color:#64748b; font-size:12px; margin-top:2px; }
  .meta { margin-left:auto; text-align:right; font-size:11px; color:#64748b; }
  .period { display:inline-block; background:#eff6ff; color:#1d4ed8; font-weight:700; font-size:12px; padding:6px 12px; border-radius:999px; margin-bottom:18px; }
  .kpis { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:22px; }
  .kpi { flex:1; min-width:140px; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; }
  .kpi-label { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; font-weight:700; }
  .kpi-value { font-size:20px; font-weight:800; margin-top:4px; }
  h2 { font-size:14px; margin:22px 0 8px; color:#1e293b; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px; }
  th { background:#f1f5f9; color:#475569; text-transform:uppercase; font-size:10px; letter-spacing:.04em; padding:8px 10px; border-bottom:2px solid #e2e8f0; }
  td { padding:7px 10px; border-bottom:1px solid #eef2f7; }
  tbody tr:nth-child(even) td { background:#fafbfc; }
  tr.totals td { font-weight:800; background:#eff6ff !important; border-top:2px solid #cbd5e1; }
  .foot { margin-top:26px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; text-align:center; }
  .btns { margin-bottom:18px; }
  .btns button { font:inherit; font-weight:700; font-size:13px; padding:9px 16px; border-radius:10px; border:0; cursor:pointer; margin-right:8px; }
  .btns .p { background:#2563eb; color:#fff; }
  .btns .c { background:#e2e8f0; color:#334155; }
  @media print { .btns { display:none; } body { padding:0; } }
</style></head><body>
  <div class="btns">
    <button class="p" onclick="window.print()">Imprimir / Salvar PDF</button>
    <button class="c" onclick="window.close()">Fechar</button>
  </div>
  <div class="top">
    <img src="${logo}" onerror="this.style.display='none'" alt="">
    <div>
      <h1>${escapeHtml(opts.title)}</h1>
      ${opts.subtitle ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>` : ''}
    </div>
    <div class="meta">Grupo Escoteiro<br>Gerado em ${escapeHtml(now)}</div>
  </div>
  ${opts.periodLabel ? `<div class="period">Período: ${escapeHtml(opts.periodLabel)}</div>` : ''}
  ${kpisHtml}
  ${opts.tables.map(tableHtml).join('')}
  <div class="foot">Documento gerado automaticamente pelo sistema GESCS.</div>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  const go = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
  w.onload = go;
  setTimeout(go, 700);
}
