// Branded, downloadable invoice document. Opens a standalone print window
// wearing the FACILITY's brand (their uploaded logo + business profile from
// onboarding/Account), so what families download looks like it came from the
// daycare — not from Mitten. Browser print → "Save as PDF" = the download.

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (n) => `$${Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`

export function openInvoicePrint(inv, facility) {
  const f = facility || {}
  const status = (inv.status || 'due').toUpperCase()
  const stamp =
    inv.status === 'paid'
      ? `<div class="stamp paid">PAID${inv.paidOn ? ` · ${esc(inv.paidOn)}` : ''}</div>`
      : inv.status === 'processing'
        ? '<div class="stamp processing">PAYMENT IN TRANSIT</div>'
        : `<div class="stamp due">DUE ${esc(inv.due || '')}</div>`

  const rows = (inv.items && inv.items.length ? inv.items : [{ label: `Tuition — ${inv.period}`, amt: inv.amount }])
    .map((it) => `<tr><td>${esc(it.label)}</td><td class="num">${money(it.amt)}</td></tr>`)
    .join('')

  const etransfer =
    inv.status !== 'paid' && f.etransferEmail
      ? `<div class="paybox">
          <strong>Pay by Interac e-Transfer</strong>
          <p>Send to <b>${esc(f.etransferEmail)}</b> and put <b>${esc(inv.id)}</b> in the message so we can match your payment. Then tap “I've sent it” in the app — we'll confirm receipt.</p>
        </div>`
      : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.id)} · ${esc(f.name || 'Invoice')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:14px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;padding:48px;max-width:760px;margin:0 auto}
  .serif{font-family:Georgia,'Times New Roman',serif}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #0E74C1;padding-bottom:24px}
  .biz{display:flex;gap:16px;align-items:center}
  .biz img{height:64px;width:64px;object-fit:contain;border-radius:12px}
  .biz h1{font-size:22px;color:#0E74C1}
  .biz .meta{color:#64748b;font-size:12px;margin-top:4px;white-space:pre-line}
  .doc{text-align:right}
  .doc .t{font-size:28px;letter-spacing:.12em;color:#0E74C1}
  .doc .n{color:#64748b;font-size:12px;margin-top:4px}
  .stamp{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:.06em}
  .stamp.paid{background:#dcfce7;color:#15803d}
  .stamp.due{background:#fee2e2;color:#b91c1c}
  .stamp.processing{background:#fef9c3;color:#a16207}
  .grid{display:flex;justify-content:space-between;gap:24px;margin:28px 0}
  .grid h3{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0}
  td{padding:12px;border-bottom:1px solid #f1f5f9}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tfoot td{border:none;padding-top:18px;font-size:18px;font-weight:800}
  tfoot .label{text-align:right;color:#64748b;font-weight:600;font-size:13px}
  .paybox{margin-top:28px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 18px}
  .paybox p{margin-top:6px;color:#334155}
  .gst{margin-top:18px;color:#94a3b8;font-size:12px}
  footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;color:#94a3b8;font-size:12px;white-space:pre-line}
  @media print{body{padding:24px}.noprint{display:none}}
  .noprint{position:fixed;top:16px;right:16px}
  .noprint button{background:#0E74C1;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer}
</style></head><body>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
  <header>
    <div class="biz">
      ${f.logoUrl ? `<img src="${esc(f.logoUrl)}" alt="">` : ''}
      <div>
        <h1 class="serif">${esc(f.name || '')}</h1>
        <div class="meta">${esc([f.address, f.phone, f.billingEmail].filter(Boolean).join('\n'))}</div>
      </div>
    </div>
    <div class="doc">
      <div class="t serif">INVOICE</div>
      <div class="n">${esc(inv.id)}</div>
      ${stamp}
    </div>
  </header>
  <div class="grid">
    <div><h3>Billed to</h3><div><b>${esc(inv.billTo || 'Family')}</b>${inv.childName ? `<br><span style="color:#64748b">for ${esc(inv.childName)}</span>` : ''}</div></div>
    <div><h3>Period</h3><div>${esc(inv.period || '')}</div></div>
    <div style="text-align:right"><h3>Amount ${status === 'PAID' ? 'paid' : 'due'}</h3><div style="font-size:20px;font-weight:800;color:#0E74C1">${money(inv.amount)}</div></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="label">Total (CAD)</td><td class="num">${money(inv.amount)}</td></tr></tfoot>
  </table>
  ${etransfer}
  ${f.gstNumber ? `<div class="gst">GST/HST #: ${esc(f.gstNumber)}</div>` : ''}
  ${inv.notes ? `<footer>${esc(inv.notes)}</footer>` : ''}
  ${f.invoiceFooter ? `<footer>${esc(f.invoiceFooter)}</footer>` : ''}
</body></html>`

  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
