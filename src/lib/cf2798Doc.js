// Pre-filled "Child Care Arrangement" head-start for the BC Affordable Child Care
// Benefit. The CF2798 needs BOTH the provider's and the parent's details + a
// provider signature — and Mitten already holds the provider side. We fill what
// we know and leave fillable lines for the rest, wearing the FACILITY's brand.
// This is a HEAD-START that accompanies the official CF2798 — not a replacement.

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n) => `$${Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`
const line = (val) => (val ? `<span class="filled">${esc(val)}</span>` : '<span class="blank"></span>')

export function openCf2798Print({ child = {}, parentName = '', monthlyFee = 0, today = '' } = {}, facility = {}) {
  const f = facility || {}
  const dateStr = today || new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Child Care Arrangement — ${esc(child.name || 'Child')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:13.5px/1.55 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;padding:48px;max-width:780px;margin:0 auto}
  .serif{font-family:Georgia,'Times New Roman',serif}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #0E74C1;padding-bottom:22px}
  .biz{display:flex;gap:16px;align-items:center}
  .biz img{height:60px;width:60px;object-fit:contain;border-radius:12px}
  .biz h1{font-size:21px;color:#0E74C1}
  .biz .meta{color:#64748b;font-size:12px;margin-top:4px;white-space:pre-line}
  .doc{text-align:right;max-width:240px}
  .doc .t{font-size:19px;letter-spacing:.04em;color:#0E74C1;line-height:1.2}
  .doc .n{color:#64748b;font-size:11px;margin-top:6px}
  .note{margin:20px 0 4px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;font-size:12.5px;color:#334155}
  .note b{color:#0E74C1}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#0E74C1;margin:26px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:5px}
  .row{display:flex;flex-wrap:wrap;gap:6px 28px;margin:7px 0}
  .fld{flex:1 1 240px;min-width:200px}
  .fld .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8}
  .filled{font-weight:700;color:#0f172a}
  .blank{display:inline-block;min-width:120px;border-bottom:1px solid #94a3b8;height:1.15em;vertical-align:bottom}
  .val{display:block;margin-top:2px;min-height:1.3em;border-bottom:1px solid #cbd5e1;padding-bottom:2px}
  .sigs{display:flex;gap:40px;margin-top:34px}
  .sig{flex:1}
  .sig .ln{border-bottom:1.5px solid #334155;height:42px}
  .sig .cap{font-size:11px;color:#64748b;margin-top:5px}
  footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:14px;color:#94a3b8;font-size:11.5px}
  footer a{color:#0E74C1}
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
      <div class="t serif">Child Care Arrangement</div>
      <div class="n">Head-start for the BC Affordable Child Care Benefit (CF2798) · ${esc(dateStr)}</div>
    </div>
  </header>

  <div class="note">Your provider, <b>${esc(f.name || 'this centre')}</b>, has filled in the provider details below to save you time. Finish the family fields, then complete and submit the official <b>Child Care Arrangement form (CF2798)</b> with your application at <b>gov.bc.ca/affordablechildcarebenefit</b>. This sheet is a head-start, not a replacement for the official form.</div>

  <h2>Child</h2>
  <div class="row">
    <div class="fld"><div class="lbl">Child's full name</div>${line(child.name)}</div>
    <div class="fld"><div class="lbl">Date of birth</div>${line('')}</div>
    <div class="fld"><div class="lbl">Age</div>${line(child.age)}</div>
  </div>

  <h2>Parent / Guardian (you)</h2>
  <div class="row">
    <div class="fld"><div class="lbl">Name</div>${line(parentName || child.parent)}</div>
    <div class="fld"><div class="lbl">Social Insurance Number</div>${line('')}</div>
  </div>
  <div class="row">
    <div class="fld"><div class="lbl">Home address</div>${line('')}</div>
    <div class="fld"><div class="lbl">Phone</div>${line('')}</div>
  </div>

  <h2>Child care provider</h2>
  <div class="row">
    <div class="fld"><div class="lbl">Facility / provider name</div>${line(f.name)}</div>
    <div class="fld"><div class="lbl">Licence / facility number</div>${line('')}</div>
  </div>
  <div class="row">
    <div class="fld"><div class="lbl">Address</div>${line(f.address)}</div>
    <div class="fld"><div class="lbl">Phone</div>${line(f.phone)}</div>
  </div>
  <div class="row">
    <div class="fld"><div class="lbl">Type of care</div>${line('Licensed group child care')}</div>
  </div>

  <h2>The arrangement</h2>
  <div class="row">
    <div class="fld"><div class="lbl">Care start date</div>${line('')}</div>
    <div class="fld"><div class="lbl">Full-time / part-time</div>${line('')}</div>
  </div>
  <div class="row">
    <div class="fld"><div class="lbl">Days per week</div>${line('')}</div>
    <div class="fld"><div class="lbl">Hours per day (from / to)</div>${line('')}</div>
  </div>
  <div class="row">
    <div class="fld"><div class="lbl">Fee charged to the family</div><span class="filled">${money(monthlyFee)} / month</span></div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="ln"></div><div class="cap">Parent / guardian signature &amp; date</div></div>
    <div class="sig"><div class="ln"></div><div class="cap">Provider signature &amp; date — ${esc(f.name || '')}</div></div>
  </div>

  <footer>Prepared by ${esc(f.name || 'your child care provider')} via Mitten. The figures shown reflect your current arrangement; confirm all details against the official CF2798 before submitting. Official form &amp; application: <a href="https://gov.bc.ca/affordablechildcarebenefit">gov.bc.ca/affordablechildcarebenefit</a></footer>
</body></html>`

  const w = window.open('', '_blank', 'width=840,height=940')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
