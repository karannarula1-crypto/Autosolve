import nodemailer from "nodemailer";
import { ReconResult } from "./reconService.ts";

// In a real app, these would come from environment variables
const CFO_EMAIL = process.env.CFO_EMAIL || "Karan.Narula1@magicbricks.com";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

export async function sendVendorEmails(reportData: ReconResult[]) {
  const vendorGroups: Record<string, { email: string; name: string; items: any[] }> = {};
  let emailCount = 0;
  const sentEmailsData: { pan: string; email: string; timestamp: string; }[] = [];

  for (const item of reportData) {
    const vEmail = item.vendorEmail;
    const vPan = item.vendorPan;
    const vName = item.vendorName;
    const invNo = item.invoiceNo;
    const date = item.invoiceDate;
    const gstAmt = item.gstAmount;

    if (item.status !== "Matched" && vEmail && vPan) {
      if (!vendorGroups[vPan]) vendorGroups[vPan] = { email: vEmail, name: vName, items: [] };
      vendorGroups[vPan].items.push({ invNo, date, gstAmt, status: item.status, remarks: item.remarks });
    }
  }

  if (Object.keys(vendorGroups).length === 0) {
    return { success: true, count: 0, message: "No mismatched vendors with email addresses found." };
  }

  const isMocked = !SMTP_USER || !SMTP_PASS;

  for (const pan in vendorGroups) {
    const group = vendorGroups[pan];
    const tableRows = group.items.map(item => `
      <tr>
        <td style="padding:8px; border:1px solid #ddd;">${item.invNo}</td>
        <td style="padding:8px; border:1px solid #ddd;">${new Date(item.date).toLocaleDateString()}</td>
        <td style="padding:8px; border:1px solid #ddd;">₹${item.gstAmt.toLocaleString('en-IN')}</td>
        <td style="padding:8px; border:1px solid #ddd; color:#d32f2f;"><b>${item.status}</b></td>
        <td style="padding:8px; border:1px solid #ddd;">${item.remarks}</td>
      </tr>`).join("");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <p>Dear ${group.name} Team,</p>
        <p>Discrepancies found in your GST filings for <b>Magicbricks (Home Loans)</b> under <b>PAN: ${pan}</b>:</p>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:#f2f2f2;"><th>Inv No</th><th>Date</th><th>GST Amount</th><th>Status</th><th>Remarks</th></tr>
          ${tableRows}
        </table>
        <p>Please rectify in your next GSTR-1 filing to ensure ITC availability.</p>
        <p>Regards,<br><b>Magicbricks Finance Team</b></p>
      </div>`;

    if (!isMocked) {
      await transporter.sendMail({
        from: `"Magicbricks Finance" <${SMTP_USER || 'noreply@magicbricks.com'}>`,
        to: group.email,
        subject: "GST Reconciliation Discrepancy - Action Required",
        html: htmlBody,
      });
    } else {
      console.log(`[MOCK EMAIL] To: ${group.email} | Subject: GST Reconciliation Discrepancy`);
    }
    
    // Record that the email was sent
    sentEmailsData.push({
      pan,
      email: group.email,
      timestamp: new Date().toISOString()
    });
    
    emailCount++;
  }

  return { success: true, count: emailCount, mocked: isMocked, sentEmailsData };
}

export async function sendCFOReport(reportData: ReconResult[], chartImageBase64?: string) {
  const stats: Record<string, number> = { "Matched": 0, "Mismatch": 0, "Not Found": 0, "Vendor/Supplier GSTIN Mismatch": 0 };
  const vendorRecon: Record<string, any> = {}; 
  let totalMismatchValue = 0;
  const uniqueVendorsEmailed = new Set();

  for (const item of reportData) {
    const vEmail = item.vendorEmail;
    const vPan = item.vendorPan;
    const vName = item.vendorName;
    const status = item.status;
    const amt = item.gstAmount || 0;
    
    stats[status] = (stats[status] || 0) + 1;
    
    // We only group statistics by valid PANs
    if (vPan) {
      if (!vendorRecon[vPan]) vendorRecon[vPan] = { name: vName, matchedAmt: 0, mismatchAmt: 0, totalCount: 0, matchCount: 0 };
      vendorRecon[vPan].totalCount++;
      
      if (status === "Matched") {
        vendorRecon[vPan].matchedAmt += amt;
        vendorRecon[vPan].matchCount++;
      } else {
        vendorRecon[vPan].mismatchAmt += amt;
        totalMismatchValue += amt;
        if (vEmail) uniqueVendorsEmailed.add(vPan);
      }
    }
  }

  const vendorArr = Object.values(vendorRecon);
  const top10Mismatch = vendorArr.filter(v => v.mismatchAmt > 0).sort((a,b) => b.mismatchAmt - a.mismatchAmt).slice(0, 10);
  const top5Perfect = vendorArr.filter(v => v.matchCount === v.totalCount).sort((a,b) => b.matchedAmt - a.matchedAmt).slice(0, 5);

  const htmlBody = `
    <div style="font-family:sans-serif; border:1px solid #eee; padding:20px; max-width:700px;">
      <h2 style="color:#d32f2f; border-bottom:2px solid #d32f2f;">CFO Summary: Home Loan GST Recon</h2>
      <div style="display:flex; justify-content:space-between; margin:20px 0;">
        <div style="background:#e8f5e9; padding:10px; border-radius:5px; text-align:center; width:30%;">Matched: <b>${stats['Matched']}</b></div>
        <div style="background:#ffebee; padding:10px; border-radius:5px; text-align:center; width:30%;">Mismatch: <b>${(stats['Mismatch'] || 0) + (stats['Vendor/Supplier GSTIN Mismatch'] || 0)}</b></div>
        <div style="background:#fff3e0; padding:10px; border-radius:5px; text-align:center; width:30%;">Not Found: <b>${stats['Not Found']}</b></div>
      </div>
      <p>Operational KPI: <b>${uniqueVendorsEmailed.size}</b> vendors notified via auto-emailer.</p>
      ${chartImageBase64 ? `<img src="cid:chart" style="width:100%;" />` : ''}
      <h3 style="color:#d32f2f;">Top 10 Mismatch Contributors</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:#f2f2f2;"><th>Vendor</th><th>Mismatch Amt</th><th>% of Total</th></tr>
        ${top10Mismatch.map(v => `<tr><td>${v.name}</td><td>₹${v.mismatchAmt.toLocaleString('en-IN')}</td><td>${((v.mismatchAmt/totalMismatchValue)*100).toFixed(1)}%</td></tr>`).join("")}
      </table>
      <h3 style="color:#388e3c;">Top 5 Perfect Compliance Vendors</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:#f2f2f2;"><th>Vendor</th><th>Matched Amt</th></tr>
        ${top5Perfect.map(v => `<tr><td>${v.name}</td><td>₹${v.matchedAmt.toLocaleString('en-IN')}</td></tr>`).join("")}
      </table>
    </div>`;

  const attachments = [];
  if (chartImageBase64) {
    attachments.push({
      filename: 'chart.png',
      content: chartImageBase64.split("base64,")[1],
      encoding: 'base64',
      cid: 'chart'
    });
  }

  const isMocked = !SMTP_USER || !SMTP_PASS;

  if (!isMocked) {
    await transporter.sendMail({
      from: `"Magicbricks Finance" <${SMTP_USER || 'noreply@magicbricks.com'}>`,
      to: CFO_EMAIL,
      subject: "Executive Report: GST Reconciliation - Magicbricks",
      html: htmlBody,
      attachments
    });
  } else {
    console.log(`[MOCK EMAIL] To: ${CFO_EMAIL} | Subject: Executive Report: GST Reconciliation - Magicbricks`);
  }

  return { success: true, mocked: isMocked };
}
