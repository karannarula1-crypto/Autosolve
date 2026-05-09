export interface ReconResult {
  status: string;
  remarks: string;
  row: any[];
  vendorName: string;
  vendorPan: string;
  vendorEmail: string;
  gstAmount: number;
  invoiceNo: string;
  invoiceDate: string;
  emailSent?: boolean;
  emailSentAt?: string;
}

const TOLERANCE_PERCENT = 0.005; // 0.5%

function normalizeInvoice(inv: any): string {
  return String(inv || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function extractPAN(gstin: any): string {
  const g = String(gstin || "").trim().toUpperCase();
  if (g.length === 15) return g.substring(2, 12);
  return g;
}

export interface ReconReport {
  inwardResults: ReconResult[];
  gstrResults: ReconResult[];
}

export function runReconciliation(inwardData: any[][], gstrData: any[][]): ReconReport {
  if (inwardData.length < 1 || gstrData.length < 1) return { inwardResults: [], gstrResults: [] };

  const inwardHeader = inwardData[0].map(h => String(h || "").trim().toLowerCase());
  const gstrHeader = gstrData[0].map(h => String(h || "").trim().toLowerCase());

  const findIdx = (header: string[], keywords: string[]) => 
    header.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));

  const idx = {
    inward: {
      vName: findIdx(inwardHeader, ["vendor name", "supplier name"]),
      vGstin: findIdx(inwardHeader, ["vendor gstin", "supplier gstin"]),
      rGstin: findIdx(inwardHeader, ["recipient gstin", "mb gstin"]),
      date: findIdx(inwardHeader, ["date"]),
      invNo: findIdx(inwardHeader, ["invoice no", "inv no"]),
      gstAmt: findIdx(inwardHeader, ["gst amount", "total gst", "igst", "cgst", "sgst", "taxable value"]),
      vEmail: findIdx(inwardHeader, ["vendor email", "email"]),
    },
    gstr: {
      vName: findIdx(gstrHeader, ["vendor name", "supplier name", "trade/legal name"]),
      vGstin: findIdx(gstrHeader, ["vendor gstin", "supplier gstin"]),
      rGstin: findIdx(gstrHeader, ["recipient gstin", "mb gstin"]),
      date: findIdx(gstrHeader, ["date"]),
      invNo: findIdx(gstrHeader, ["invoice no", "inv no"]),
      gstAmt: findIdx(gstrHeader, ["gst amount", "total gst", "igst", "cgst", "sgst", "taxable value"])
    }
  };

  // Fallbacks
  const INWARD_INV_NO = idx.inward.invNo !== -1 ? idx.inward.invNo : 7;
  const GSTR_INV_NO = idx.gstr.invNo !== -1 ? idx.gstr.invNo : 7;

  const gstrResults: ReconResult[] = [];
  const inwardResults: ReconResult[] = [];
  
  // Create maps for inward data
  const inwardMapByInvNo: Record<string, any[][]> = {};
  const inwardMapByVendorGstin: Record<string, any[][]> = {};
  const panToEmail: Record<string, string> = {};
  
  for (let i = 1; i < inwardData.length; i++) {
    const row = inwardData[i];
    const rawInvNo = String(row[INWARD_INV_NO] || "");
    const invNo = normalizeInvoice(rawInvNo);
    
    // Attempt to extract vendor email
    const vGstin = String(row[idx.inward.vGstin] || "").trim().toUpperCase();
    if (vGstin && idx.inward.vEmail !== -1) {
      const email = String(row[idx.inward.vEmail] || "").trim();
      const pan = extractPAN(vGstin);
      if (email && pan) {
        panToEmail[pan] = email;
      }
    }

    if (!invNo) continue;
    
    if (!inwardMapByInvNo[invNo]) inwardMapByInvNo[invNo] = [];
    inwardMapByInvNo[invNo].push(row);

    if (vGstin) {
      if (!inwardMapByVendorGstin[vGstin]) inwardMapByVendorGstin[vGstin] = [];
      inwardMapByVendorGstin[vGstin].push(row);
    }
  }

  // Create maps for GSTR data
  const gstrMapByInvNo: Record<string, any[][]> = {};
  const gstrMapByVendorGstin: Record<string, any[][]> = {};

  for (let j = 1; j < gstrData.length; j++) {
    const row = gstrData[j];
    const rawInvNo = String(row[GSTR_INV_NO] || "");
    const invNo = normalizeInvoice(rawInvNo);
    if (!invNo) continue;
    
    if (!gstrMapByInvNo[invNo]) gstrMapByInvNo[invNo] = [];
    gstrMapByInvNo[invNo].push(row);

    const vGstin = String(idx.gstr.vGstin !== -1 ? row[idx.gstr.vGstin] : "").trim().toUpperCase();
    if (vGstin) {
      if (!gstrMapByVendorGstin[vGstin]) gstrMapByVendorGstin[vGstin] = [];
      gstrMapByVendorGstin[vGstin].push(row);
    }
  }

  const statusPriority: Record<string, number> = {
    "Matched": 4,
    "Vendor/Supplier GSTIN Mismatch": 3,
    "Mismatch": 2,
    "Transaction appeared in Different Invoice no.": 1,
    "Not Found in Inward Register": 0,
    "Not Found in GSTR-2B": 0
  };

  // Iterate over GSTR-2B data
  for (let j = 1; j < gstrData.length; j++) {
    const gstrRow = gstrData[j];
    const rawInvNo = String(gstrRow[GSTR_INV_NO] || "");
    const invNo = normalizeInvoice(rawInvNo);
    if (!invNo) continue;

    const vendorName = String(idx.gstr.vName !== -1 ? gstrRow[idx.gstr.vName] : "");
    const vendorGstin = String(idx.gstr.vGstin !== -1 ? gstrRow[idx.gstr.vGstin] : "").trim().toUpperCase();
    const vendorPan = extractPAN(vendorGstin);
    const vendorEmail = panToEmail[vendorPan] || "";
    const gstAmt = parseFloat(idx.gstr.gstAmt !== -1 ? gstrRow[idx.gstr.gstAmt] : "0") || 0;
    const invDate = String(idx.gstr.date !== -1 ? gstrRow[idx.gstr.date] : "");

    let bestAnalysis = { status: "Not Found in Inward Register", remarks: "Invoice not found in Inward Register" };
    
    // 1. Check Exact Matches, GSTIN Mismatch, Mismatch by standard Invoice No
    const inwardMatches = inwardMapByInvNo[invNo];
    if (inwardMatches) {
      for (const inRow of inwardMatches) {
        const analysis = analyzeMatch(inRow, gstrRow, idx);
        if (statusPriority[analysis.status] > statusPriority[bestAnalysis.status]) {
          bestAnalysis = analysis;
        }
      }
    }

    // 2. Check "Different Invoice no."
    if (statusPriority[bestAnalysis.status] < 2) {
      const inwardMatchesByGstin = inwardMapByVendorGstin[vendorGstin];
      if (inwardMatchesByGstin) {
        for (const inRow of inwardMatchesByGstin) {
          const inInvNo = normalizeInvoice(String(inRow[INWARD_INV_NO] || ""));
          if (inInvNo !== invNo) {
            const inAmt = parseFloat(idx.inward.gstAmt !== -1 ? inRow[idx.inward.gstAmt] : "0") || 0;
            const amtM = (Math.abs(inAmt - gstAmt) <= (Math.abs(inAmt) * TOLERANCE_PERCENT));
            if (amtM) {
              const diffInvStatus = "Transaction appeared in Different Invoice no.";
              if (statusPriority[diffInvStatus] > statusPriority[bestAnalysis.status]) {
                bestAnalysis = { status: diffInvStatus, remarks: `Matched with Inward Invoice: ${String(inRow[INWARD_INV_NO] || "Unknown")}` };
              }
            }
          }
        }
      }
    }

    gstrResults.push({ 
      ...bestAnalysis, 
      row: gstrRow,
      vendorName,
      vendorPan,
      vendorEmail,
      gstAmount: gstAmt,
      invoiceNo: rawInvNo,
      invoiceDate: invDate
    });
  }

  // Iterate over Inward Register
  for (let i = 1; i < inwardData.length; i++) {
    const inRow = inwardData[i];
    const rawInvNo = String(inRow[INWARD_INV_NO] || "");
    const invNo = normalizeInvoice(rawInvNo);
    if (!invNo) continue;

    const vendorName = String(idx.inward.vName !== -1 ? inRow[idx.inward.vName] : "");
    const vendorGstin = String(idx.inward.vGstin !== -1 ? inRow[idx.inward.vGstin] : "").trim().toUpperCase();
    const vendorPan = extractPAN(vendorGstin);
    const vendorEmail = panToEmail[vendorPan] || (idx.inward.vEmail !== -1 ? String(inRow[idx.inward.vEmail] || "") : "");
    const gstAmt = parseFloat(idx.inward.gstAmt !== -1 ? inRow[idx.inward.gstAmt] : "0") || 0;
    const invDate = String(idx.inward.date !== -1 ? inRow[idx.inward.date] : "");

    let bestAnalysis = { status: "Not Found in GSTR-2B", remarks: "Invoice not found in GSTR-2B" };
    
    // 1. Check Exact Matches, GSTIN Mismatch, Mismatch by standard Invoice No
    const gstrMatches = gstrMapByInvNo[invNo];
    if (gstrMatches) {
      for (const gsRow of gstrMatches) {
        const analysis = analyzeMatch(inRow, gsRow, idx);
        // Replace "Not Found in Inward Register" from analyzeMatch to our local not found if applicable
        if (analysis.status === "Not Found in Inward Register") analysis.status = "Not Found in GSTR-2B";

        if (statusPriority[analysis.status] > statusPriority[bestAnalysis.status]) {
          bestAnalysis = analysis;
        }
      }
    }

    // 2. Check "Different Invoice no."
    if (statusPriority[bestAnalysis.status] < 2) {
      const gstrMatchesByGstin = gstrMapByVendorGstin[vendorGstin];
      if (gstrMatchesByGstin) {
        for (const gsRow of gstrMatchesByGstin) {
          const gsInvNo = normalizeInvoice(String(gsRow[GSTR_INV_NO] || ""));
          if (gsInvNo !== invNo) {
            const gsAmt = parseFloat(idx.gstr.gstAmt !== -1 ? gsRow[idx.gstr.gstAmt] : "0") || 0;
            const amtM = (Math.abs(gstAmt - gsAmt) <= (Math.abs(gstAmt) * TOLERANCE_PERCENT));
            if (amtM) {
              const diffInvStatus = "Transaction appeared in Different Invoice no.";
              if (statusPriority[diffInvStatus] > statusPriority[bestAnalysis.status]) {
                bestAnalysis = { status: diffInvStatus, remarks: `Matched with GSTR Invoice: ${String(gsRow[GSTR_INV_NO] || "Unknown")}` };
              }
            }
          }
        }
      }
    }

    inwardResults.push({ 
      ...bestAnalysis, 
      row: inRow,
      vendorName,
      vendorPan,
      vendorEmail,
      gstAmount: gstAmt,
      invoiceNo: rawInvNo,
      invoiceDate: invDate
    });
  }

  return { inwardResults, gstrResults };
}

function analyzeMatch(inward: any[], gstr: any[], idx: any) {
  const i = idx.inward;
  const g = idx.gstr;

  const inVGstin = String(inward[i.vGstin] || "").trim().toUpperCase();
  const gsVGstin = String(gstr[g.vGstin] || "").trim().toUpperCase();
  const inRGstin = String(inward[i.rGstin] || "").trim().toUpperCase();
  const gsRGstin = String(gstr[g.rGstin] || "").trim().toUpperCase();

  const vGstinM = (inVGstin === gsVGstin);
  const rGstinM = (inRGstin === gsRGstin);
  
  const vPanM = (extractPAN(inVGstin) === extractPAN(gsVGstin) && extractPAN(inVGstin) !== "");

  const inDate = String(inward[i.date] || "").trim();
  const gsDate = String(gstr[g.date] || "").trim();
  const dateM = (inDate === gsDate);
  
  const amtIn = parseFloat(inward[i.gstAmt]) || 0;
  const amtGs = parseFloat(gstr[g.gstAmt]) || 0;
  const amtM = (Math.abs(amtIn - amtGs) <= (Math.abs(amtIn) * TOLERANCE_PERCENT));

  // Matched
  if (vGstinM && rGstinM && dateM && amtM) return { status: "Matched", remarks: "Exact Match" };
  
  // GSTIN Mismatch
  if (!vGstinM && vPanM && dateM && amtM) return { status: "Vendor/Supplier GSTIN Mismatch", remarks: "GSTIN Mismatch, PAN Matched" };

  // Mismatch (Only 1 differs)
  let fails = [];
  if (!vGstinM) fails.push("Vendor GSTIN");
  if (!rGstinM) fails.push("Recipient GSTIN");
  if (!dateM) fails.push("Date");
  if (!amtM) fails.push("GST Amount");
  
  if (fails.length === 1) return { status: "Mismatch", remarks: "Mismatch: " + fails[0] };
  
  return { status: "Not Found in Inward Register", remarks: fails.length + " columns differ" };
}
