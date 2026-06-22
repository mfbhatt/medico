// ─── Print Receipt ────────────────────────────────────────────────────────────

export function printReceipt(sale: any, clinicName: string) {
  const w = window.open('', '_blank', 'width=420,height=800');
  if (!w) return;

  const itemRows = sale.items
    .map(
      (i: any) => `
        <tr>
          <td style="padding:3px 0 0">
            <b>${i.drug_name}</b>
            ${i.sig_instructions ? `<div style="font-size:10px;color:#444;margin-top:1px">Directions: ${i.sig_instructions}</div>` : ''}
            ${i.batch_number ? `<div style="font-size:10px;color:#777">Batch: ${i.batch_number}${i.expiry_date ? ` · Exp: ${i.expiry_date}` : ''}</div>` : ''}
          </td>
          <td style="text-align:right;padding:3px 4px 0;vertical-align:top">${i.quantity}</td>
          <td style="text-align:right;padding:3px 4px 0;vertical-align:top">${i.unit_price.toFixed(2)}</td>
          <td style="text-align:right;padding:3px 0 0;vertical-align:top">${i.line_total.toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html>
<html><head><title>Receipt ${sale.sale_number}</title>
<style>
  body{font-family:monospace;font-size:12px;margin:0;padding:16px;max-width:380px}
  h2{text-align:center;margin:0 0 2px;font-size:15px}
  .clinic-sub{text-align:center;font-size:11px;color:#555;margin-bottom:2px}
  .doc-title{text-align:center;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px}
  hr{border:none;border-top:1px dashed #999;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-align:left;border-bottom:1px solid #ccc;padding-bottom:3px}
  th:not(:first-child){text-align:right}
  .totals td{padding:1px 0}
  .total-row td{font-weight:bold;font-size:13px;padding-top:4px}
  .footer{text-align:center;margin-top:12px;font-size:11px;color:#666}
  .partial-note{text-align:center;font-size:11px;color:#b45309;font-weight:bold;margin:4px 0}
</style></head><body>
<h2>${clinicName}</h2>
<div class="clinic-sub">Pharmacy Department</div>
<div class="doc-title">DISPENSING RECEIPT</div>
<hr/>
<table>
  <tr><td>Receipt #:</td><td style="text-align:right"><b>${sale.sale_number}</b></td></tr>
  <tr><td>Date:</td><td style="text-align:right">${new Date(sale.created_at).toLocaleString()}</td></tr>
  ${sale.patient_name ? `<tr><td>Patient:</td><td style="text-align:right"><b>${sale.patient_name}</b></td></tr>` : ''}
  ${sale.patient_id ? `<tr><td>Patient ID:</td><td style="text-align:right">${sale.patient_id}</td></tr>` : ''}
  ${sale.prescription_number ? `<tr><td>Prescription #:</td><td style="text-align:right">${sale.prescription_number}</td></tr>` : ''}
  <tr><td>Payment:</td><td style="text-align:right;text-transform:capitalize">${sale.payment_method}</td></tr>
</table>
<hr/>
<table>
  <thead><tr>
    <th>Drug / Directions</th><th>Qty</th><th>Price</th><th>Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr/>
${sale.is_partial ? '<div class="partial-note">⚠ PARTIAL DISPENSE — patient to return for balance</div><hr/>' : ''}
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${sale.subtotal.toFixed(2)}</td></tr>
  ${sale.discount_amount > 0 ? `<tr><td>Discount${sale.discount_percent ? ` (${sale.discount_percent}%)` : ''}</td><td style="text-align:right">-${sale.discount_amount.toFixed(2)}</td></tr>` : ''}
  ${sale.tax_amount > 0 ? `<tr><td>Tax</td><td style="text-align:right">${sale.tax_amount.toFixed(2)}</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${sale.total_amount.toFixed(2)}</td></tr>
  <tr><td>Paid</td><td style="text-align:right">${sale.paid_amount.toFixed(2)}</td></tr>
  ${sale.change_amount > 0 ? `<tr><td>Change</td><td style="text-align:right">${sale.change_amount.toFixed(2)}</td></tr>` : ''}
</table>
<hr/>
<div class="footer">Thank you for your visit!<br/>Keep this receipt for your records.</div>
<script>window.onload=()=>{window.print();window.close();}</script>
</body></html>`);
  w.document.close();
}
