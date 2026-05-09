import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { runReconciliation } from "./src/services/reconService.ts";
import { sendVendorEmails, sendCFOReport } from "./src/services/emailService.ts";
import { fetchInvoicesFromDrive } from "./server/driveSync.ts";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  console.log("Starting server in mode:", process.env.NODE_ENV || "development");
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.post("/api/fetch-invoices", async (req, res) => {
    try {
      const { folderId } = req.body;
      if (!folderId) {
        return res.status(400).json({ success: false, message: "Folder ID is required" });
      }

      // Allow falling back to mock implementation if creds are not present
      // const hasDriveCreds = !!(process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64);
      // if (!hasDriveCreds) { ... }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          success: false, 
          message: "GEMINI_API_KEY is not configured in environment variables." 
        });
      }

      const extractedInvoices = await fetchInvoicesFromDrive(folderId);
      res.json({ success: true, data: extractedInvoices });
    } catch (error: any) {
      console.error("Fetch Invoices Error:", error);
      res.status(500).json({ success: false, message: error?.message || String(error) });
    }
  });

  // API Routes
  app.post("/api/reconcile", upload.fields([
    { name: 'inward', maxCount: 1 },
    { name: 'gstr', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files.inward || !files.gstr) {
        return res.status(400).json({ error: "Both Inward Register and GSTR-2B files are required." });
      }

      const inwardWorkbook = XLSX.read(files.inward[0].buffer);
      const gstrWorkbook = XLSX.read(files.gstr[0].buffer);

      const inwardSheet = inwardWorkbook.Sheets[inwardWorkbook.SheetNames[0]];
      const gstrSheet = gstrWorkbook.Sheets[gstrWorkbook.SheetNames[0]];

      const inwardData = XLSX.utils.sheet_to_json(inwardSheet, { header: 1 }) as any[][];
      const gstrData = XLSX.utils.sheet_to_json(gstrSheet, { header: 1 }) as any[][];

      const results = runReconciliation(inwardData, gstrData);
      res.json(results);
    } catch (error) {
      console.error("Reconciliation error:", error);
      res.status(500).json({ error: "Failed to process reconciliation." });
    }
  });

  app.post("/api/email-vendors", async (req, res) => {
    try {
      const { reportData } = req.body;
      const result = await sendVendorEmails(reportData);
      res.json(result);
    } catch (error: any) {
      console.error("Email error:", error);
      res.status(500).json({ success: false, message: error?.message || String(error) });
    }
  });

  app.post("/api/email-cfo", async (req, res) => {
    try {
      const { reportData, chartImage } = req.body;
      const result = await sendCFOReport(reportData, chartImage);
      res.json(result);
    } catch (error: any) {
      console.error("CFO Report error:", error);
      res.status(500).json({ success: false, message: error?.message || String(error) });
    }
  });

  app.get("/api/templates/:type", (req, res) => {
    const { type } = req.params;
    const headers = [
      "Vendor Name", "Vendor GSTIN", "Vendor PAN", 
      "Recipient Name", "Recipient GSTIN", "Recipient PAN", 
      "Date", "Invoice No", "CGST", "SGST", "IGST", 
      "GST Amount", "Taxable Value", "Invoice Value", "Vendor Email"
    ];
    
    const sampleData = [
      headers,
      [
        "Sample Vendor", "27AAAAA0000A1Z5", "AAAAA0000A", 
        "Magicbricks HL", "27BBBBB0000B1Z5", "BBBBB0000B", 
        "2024-03-01", "INV-001", 90, 90, 0, 
        180, 1000, 1180, "vendor@example.com"
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${type}_template.xlsx`);
    res.send(buffer);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Initializing Vite server...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached.");
    } catch (err) {
      console.error("Failed to initialize Vite server:", err);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
