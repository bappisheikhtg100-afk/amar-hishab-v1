import { jsPDF } from 'jspdf';
import { domToCanvas } from 'modern-screenshot';
import {
  Budget,
  ContactItem,
  DebtProfile,
  NumeralSystem,
  Transaction,
} from '../types/finance';
import {
  formatCurrency,
  formatMonthForDisplay,
  getCategoryLabel,
} from './formatters';
import { saveBlobOffline } from './fileSaver';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderHtmlContainerToPdf(
  htmlString: string,
  fileName: string
): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px'; // A4 width at 96 DPI
  wrapper.style.backgroundColor = '#FFFFFF';
  wrapper.style.color = '#0F172A';
  wrapper.style.fontFamily =
    '"Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  wrapper.innerHTML = htmlString;
  document.body.appendChild(wrapper);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    const canvas = await domToCanvas(wrapper, {
      scale: 2,
      backgroundColor: '#FFFFFF',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 10;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm * 2;

    const pxPerMm = canvas.width / contentWidthMm;
    const sliceHeightPx = Math.floor(contentHeightMm * pxPerMm);

    let yOffsetPx = 0;
    let pageIndex = 0;

    while (yOffsetPx < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }
      const currentSlicePx = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSlicePx;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          yOffsetPx,
          canvas.width,
          currentSlicePx,
          0,
          0,
          canvas.width,
          currentSlicePx
        );
      }

      const sliceHeightMm = currentSlicePx / pxPerMm;
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.94);
      pdf.addImage(
        imgData,
        'JPEG',
        marginMm,
        marginMm,
        contentWidthMm,
        sliceHeightMm
      );

      yOffsetPx += currentSlicePx;
      pageIndex++;
    }

    const pdfBlob = pdf.output('blob');
    await saveBlobOffline(pdfBlob, fileName);
  } finally {
    wrapper.remove();
  }
}

export async function generateMonthlyFinancePdf(params: {
  monthKey: string;
  income: number;
  expense: number;
  closingBalance: number;
  previousBalance: number;
  transactions: Transaction[];
  debtProfiles?: DebtProfile[];
  budgets?: Budget[];
  includeDebt?: boolean;
  includeBudgets?: boolean;
  numerals: NumeralSystem;
}): Promise<void> {
  const {
    monthKey,
    income,
    expense,
    closingBalance,
    previousBalance,
    transactions,
    debtProfiles = [],
    budgets = [],
    includeDebt = true,
    includeBudgets = false,
    numerals,
  } = params;

  const monthTitle = formatMonthForDisplay(monthKey, numerals);
  const datePrinted = new Date().toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const txRows = [...transactions]
    .reverse()
    .map(
      (tx, idx) => `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 8px; font-size: 12px; color: #64748B;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-size: 13px; font-weight: 600; color: #0F172A;">${escapeHtml(
          tx.note
        )}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${escapeHtml(
          getCategoryLabel(tx.category, tx.type)
        )}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #64748B;">${escapeHtml(
          tx.time
        )}</td>
        <td style="padding: 10px 8px; font-size: 13px; font-weight: 700; text-align: right; color: ${
          tx.type === 'income' ? '#059669' : '#E11D48'
        };">
          ${tx.type === 'income' ? '+' : '−'}${escapeHtml(
        formatCurrency(tx.amount, numerals)
      )}
        </td>
      </tr>
    `
    )
    .join('');

  const debtSection =
    includeDebt && debtProfiles.length > 0
      ? `
      <div style="margin-top: 28px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0;">দেনা ও পাওনা খাতার সারাংশ</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <th style="padding: 9px 8px; text-align: left; font-size: 12px; color: #475569;">নাম ও ফোন</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 12px; color: #475569;">পাওনা</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 12px; color: #475569;">দেনা</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 12px; color: #475569;">নিট অবস্থান</th>
            </tr>
          </thead>
          <tbody>
            ${debtProfiles
              .map((p) => {
                const net = p.credit - p.debt;
                return `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 9px 8px; font-size: 13px; font-weight: 600;">${escapeHtml(
                    p.name
                  )} ${
                  p.phone
                    ? `<span style="color:#64748B;font-weight:400;">(${escapeHtml(
                        p.phone
                      )})</span>`
                    : ''
                }</td>
                  <td style="padding: 9px 8px; font-size: 12px; text-align: right; color: #059669;">${escapeHtml(
                    formatCurrency(p.credit, numerals)
                  )}</td>
                  <td style="padding: 9px 8px; font-size: 12px; text-align: right; color: #E11D48;">${escapeHtml(
                    formatCurrency(p.debt, numerals)
                  )}</td>
                  <td style="padding: 9px 8px; font-size: 13px; font-weight: 700; text-align: right; color: ${
                    net >= 0 ? '#059669' : '#E11D48'
                  };">
                    ${
                      net > 0
                        ? `পাওনা ${escapeHtml(formatCurrency(net, numerals))}`
                        : net < 0
                        ? `দেনা ${escapeHtml(formatCurrency(Math.abs(net), numerals))}`
                        : 'সমান'
                    }
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : '';

  const budgetSection =
    includeBudgets && budgets.length > 0
      ? `
      <div style="margin-top: 28px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0;">বাজেট তালিকা</h3>
        ${budgets
          .map((b) => {
            const total = b.items.reduce((s, i) => s + i.cost, 0);
            return `
            <div style="border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
              <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; margin-bottom:6px;">
                <span>${escapeHtml(b.name)}</span>
                <span>মোট: ${escapeHtml(formatCurrency(total, numerals))}</span>
              </div>
              <div style="font-size:12px; color:#475569;">
                ${b.items
                  .map(
                    (it) =>
                      `${it.bought ? '☑' : '☐'} ${escapeHtml(it.name)} (${escapeHtml(
                        formatCurrency(it.cost, numerals)
                      )})`
                  )
                  .join(' &nbsp;·&nbsp; ')}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `
      : '';

  const html = `
    <div style="padding: 28px 32px; background: #FFFFFF; color: #0F172A;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #0B2620;">
        <div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0B2620;">আমার হিসাব</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748B;">মাসিক আর্থিক বিবরণী — ${escapeHtml(
            monthTitle
          )}</p>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748B;">
          <div>প্রস্তুতের তারিখ: ${escapeHtml(datePrinted)}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px;">
        <div style="padding: 14px; border-radius: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 11px; color: #64748B;">মোট আয়</div>
          <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 4px;">${escapeHtml(
            formatCurrency(income, numerals)
          )}</div>
        </div>
        <div style="padding: 14px; border-radius: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 11px; color: #64748B;">মোট ব্যয়</div>
          <div style="font-size: 18px; font-weight: 800; color: #E11D48; margin-top: 4px;">${escapeHtml(
            formatCurrency(expense, numerals)
          )}</div>
        </div>
        <div style="padding: 14px; border-radius: 12px; background: #F8FAFC; border: 1px solid #E2E8F0;">
          <div style="font-size: 11px; color: #64748B;">পূর্ববর্তী জের</div>
          <div style="font-size: 18px; font-weight: 800; color: #334155; margin-top: 4px;">${escapeHtml(
            formatCurrency(previousBalance, numerals)
          )}</div>
        </div>
        <div style="padding: 14px; border-radius: 12px; background: #0B2620; color: #FFFFFF;">
          <div style="font-size: 11px; color: #A7F3D0;">সমাপনী ব্যালেন্স</div>
          <div style="font-size: 18px; font-weight: 800; color: #FFFFFF; margin-top: 4px;">${escapeHtml(
            formatCurrency(closingBalance, numerals)
          )}</div>
        </div>
      </div>

      <div style="margin-top: 26px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0;">লেনদেনের বিস্তারিত বিবরণ</h3>
        ${
          transactions.length === 0
            ? `<p style="font-size: 13px; color: #64748B; padding: 16px 0;">এই মাসে কোনো লেনদেন নথিভুক্ত নেই।</p>`
            : `<table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                    <th style="padding: 9px 8px; text-align: left; font-size: 12px; color: #475569; width: 36px;">#</th>
                    <th style="padding: 9px 8px; text-align: left; font-size: 12px; color: #475569;">বিবরণ</th>
                    <th style="padding: 9px 8px; text-align: left; font-size: 12px; color: #475569;">খাত</th>
                    <th style="padding: 9px 8px; text-align: left; font-size: 12px; color: #475569;">তারিখ</th>
                    <th style="padding: 9px 8px; text-align: right; font-size: 12px; color: #475569;">পরিমাণ</th>
                  </tr>
                </thead>
                <tbody>${txRows}</tbody>
              </table>`
        }
      </div>

      ${debtSection}
      ${budgetSection}

      <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8;">
        <span>আমার হিসাব — ব্যক্তিগত অফলাইন হিসাব ব্যবস্থাপনা</span>
        <span>Developed by Md. Wadud Hossain · 12606098 · NDCD 26</span>
      </div>
    </div>
  `;

  await renderHtmlContainerToPdf(html, `amar-hisab-report-${monthKey}.pdf`);
}

export async function generateContactsDirectoryPdf(
  contacts: ContactItem[]
): Promise<void> {
  const grouped = new Map<string, ContactItem[]>();
  contacts.forEach((c) => {
    const key = `${c.group || 'সাধারণ'} — ${c.subGroup || 'সকল'}`;
    const arr = grouped.get(key) || [];
    arr.push(c);
    grouped.set(key, arr);
  });

  const sectionsHtml = Array.from(grouped.entries())
    .map(
      ([groupLabel, list]) => `
      <div style="margin-top: 22px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #0B2620; background: #F1F5F9; padding: 7px 12px; border-radius: 8px; margin: 0 0 10px 0;">
          ${escapeHtml(groupLabel)} (${list.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${list
            .map(
              (c) => `
            <div style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 10px;">
              ${
                c.photoDataUrl
                  ? `<img src="${c.photoDataUrl}" alt="" style="width: 42px; height: 42px; border-radius: 10px; object-fit: cover; flex-shrink: 0;" />`
                  : `<div style="width: 42px; height: 42px; border-radius: 10px; background: #0B2620; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0;">${escapeHtml(
                      c.name.trim().charAt(0) || 'ক'
                    )}</div>`
              }
              <div style="min-width: 0; font-size: 12px; line-height: 1.45;">
                <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(
                  c.name
                )} ${
                c.bloodGroup
                  ? `<span style="color:#E11D48;font-size:11px;">(${escapeHtml(
                      c.bloodGroup
                    )})</span>`
                  : ''
              }</div>
                <div style="color: #059669; font-weight: 600;">${escapeHtml(
                  c.phone
                )}${
                c.secondaryPhone ? `, ${escapeHtml(c.secondaryPhone)}` : ''
              }</div>
                ${
                  c.email
                    ? `<div style="color: #475569;">${escapeHtml(c.email)}</div>`
                    : ''
                }
                ${
                  c.organization
                    ? `<div style="color: #475569;">${escapeHtml(c.organization)}</div>`
                    : ''
                }
                ${
                  c.address
                    ? `<div style="color: #64748B;">${escapeHtml(c.address)}</div>`
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
    )
    .join('');

  const html = `
    <div style="padding: 28px 32px; background: #FFFFFF; color: #0F172A;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0B2620;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0B2620;">আমার হিসাব — কন্টাক্ট ডিরেক্টরি</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748B;">মোট সংরক্ষিত কন্টাক্ট: ${
            contacts.length
          }টি</p>
        </div>
      </div>
      ${
        contacts.length === 0
          ? `<p style="padding: 20px 0; font-size: 13px; color: #64748B;">কোনো কন্টাক্ট সংরক্ষিত নেই।</p>`
          : sectionsHtml
      }
    </div>
  `;

  await renderHtmlContainerToPdf(
    html,
    `amar-hisab-contacts-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
