import React, { useState, useCallback } from 'react';
import { Upload, FileCheck, AlertCircle, Loader2, Download, CloudDownload } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onFilesReady: (inward: File, gstr: File) => void;
  isProcessing: boolean;
  isAdmin?: boolean;
}

export default function FileUpload({ onFilesReady, isProcessing, isAdmin }: FileUploadProps) {
  const [inwardFile, setInwardFile] = useState<File | null>(null);
  const [gstrFile, setGstrFile] = useState<File | null>(null);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState("1QF8q2OiauPW1W3y_aXu05xQVpW7ZIHGX");
  const [generatedRegisterUrl, setGeneratedRegisterUrl] = useState<string | null>(null);
  const [fetchLogs, setFetchLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setFetchLogs(prev => [...prev, msg]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'inward' | 'gstr') => {
    if (e.target.files && e.target.files[0]) {
      if (type === 'inward') setInwardFile(e.target.files[0]);
      else setGstrFile(e.target.files[0]);
    }
  };

  const handleReconcile = () => {
    if (inwardFile && gstrFile) {
      onFilesReady(inwardFile, gstrFile);
    }
  };

  const downloadTemplate = (type: string) => {
    window.open(`/api/templates/${type}`, '_blank');
  };

  const handleFetchDrive = async () => {
    if (!driveFolderId.trim()) {
      alert("Please enter a Google Drive Folder ID.");
      return;
    }
    
    setIsFetchingDrive(true);
    setFetchLogs(["Started fetch from Google Drive..."]);
    setGeneratedRegisterUrl(null);
    try {
      const response = await fetch('/api/fetch-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: driveFolderId.trim() })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        addLog(`Error: ${result.message}`);
        throw new Error(result.message || "Failed to fetch invoices");
      }
      
      if (!result.data || result.data.length === 0) {
        addLog("No valid invoices found or extracted in the specified folder.");
        alert("No valid invoices found or extracted in the specified folder.");
        return;
      }

      addLog(`Extracted ${result.data.length} invoices. Generating Excel...`);
      
      // Convert to excel sheet
      const headers = ["Vendor Name", "Vendor PAN", "Vendor GSTIN", "Recipient GSTIN", "Invoice Date", "Invoice No", "GST Amount"];
      const rows = result.data.map((item: any) => [
        item.vendorName || '',
        item.vendorPan || '',
        item.vendorGstin || '',
        item.recipientGstin || '',
        item.invoiceDate || '',
        item.invoiceNo || '',
        item.gstAmount || 0
      ]);
      
      const sheetData = [headers, ...rows];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Inward Register");
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], "inward_register_from_drive.xlsx", { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      setInwardFile(file);
      const url = URL.createObjectURL(blob);
      setGeneratedRegisterUrl(url);
      addLog(`Success! Inward Register loaded and ready. Note: You can download the generated file below.`);
      
    } catch (error: any) {
      addLog(`Fatal Error: ${error.message}`);
    } finally {
      setIsFetchingDrive(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      {/* Magicbricks Hero Ad */}
      <div className="relative h-48 rounded-2xl overflow-hidden shadow-xl mb-8 group">
        <img 
          src="https://picsum.photos/seed/magicbricks-home/1200/400" 
          alt="Magicbricks Home" 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-mb-red/90 to-transparent flex flex-col justify-center px-12 text-white">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-4xl font-black tracking-tight">Property Sahi.</h2>
            <h3 className="text-2xl font-bold opacity-90">Milega Yahin.</h3>
            <div className="mt-4 flex items-center gap-2 bg-white/20 backdrop-blur-sm w-fit px-3 py-1 rounded-full text-sm">
              <span className="w-2 h-2 bg-mb-yellow rounded-full animate-pulse" />
              India's No. 1 Property Site
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-mb-gray">GST Reconciliation Suite</h1>
            <p className="text-gray-500">Automate your ITC reconciliation with Magicbricks precision.</p>
          </div>

          {isAdmin && (
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <CloudDownload className="text-blue-600" size={24} />
                <div>
                  <h3 className="font-bold text-blue-900">Fetch Invoices from Google Drive</h3>
                  <p className="text-xs text-blue-600">Scan OCR and extract data directly from Drive to dynamically build Inward Register.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  placeholder="Paste Google Drive Folder ID here..."
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-md text-sm outline-none focus:border-blue-400 bg-white"
                />
                <button
                  onClick={handleFetchDrive}
                  disabled={isFetchingDrive || !driveFolderId.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold shadow hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isFetchingDrive ? <Loader2 size={16} className="animate-spin" /> : "Fetch & Process"}
                </button>
              </div>
              
              {fetchLogs.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded-md border border-blue-100 text-xs text-slate-700 font-mono max-h-32 overflow-y-auto space-y-1">
                  {fetchLogs.map((log, index) => (
                    <div key={index} className={log.includes("Error") ? "text-red-500" : "text-slate-600"}>
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {generatedRegisterUrl && (
                <div className="mt-4">
                  <a 
                    href={generatedRegisterUrl} 
                    download="inward_register_from_drive.xlsx"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md text-sm font-bold shadow hover:bg-green-600 transition"
                  >
                    <Download size={16} /> Download Generated Inward Register
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inward Register Upload */}
            <div className="space-y-2">
              <div className={`p-8 border-2 border-dashed rounded-xl transition-all duration-300 ${inwardFile ? 'border-green-500 bg-green-50 shadow-inner' : 'border-gray-300 hover:border-mb-red bg-white shadow-sm'}`}>
                <label className="flex flex-col items-center cursor-pointer space-y-4">
                  <div className={`p-4 rounded-full transition-colors ${inwardFile ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {inwardFile ? <FileCheck size={32} /> : <Upload size={32} />}
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-mb-gray">Inward Register</span>
                    <span className="text-sm text-gray-400">{inwardFile ? inwardFile.name : 'Click to upload Excel/CSV'}</span>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileChange(e, 'inward')} />
                </label>
              </div>
              <button 
                onClick={() => downloadTemplate('inward')}
                className="text-xs text-mb-red hover:text-mb-red-dark font-semibold flex items-center gap-1 mx-auto transition-colors"
              >
                <Download size={12} /> Download Inward Template
              </button>
            </div>

            {/* GSTR-2B Upload */}
            <div className="space-y-2">
              <div className={`p-8 border-2 border-dashed rounded-xl transition-all duration-300 ${gstrFile ? 'border-green-500 bg-green-50 shadow-inner' : 'border-gray-300 hover:border-mb-red bg-white shadow-sm'}`}>
                <label className="flex flex-col items-center cursor-pointer space-y-4">
                  <div className={`p-4 rounded-full transition-colors ${gstrFile ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {gstrFile ? <FileCheck size={32} /> : <Upload size={32} />}
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-mb-gray">GSTR-2B Data</span>
                    <span className="text-sm text-gray-400">{gstrFile ? gstrFile.name : 'Click to upload Excel/CSV'}</span>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileChange(e, 'gstr')} />
                </label>
              </div>
              <button 
                onClick={() => downloadTemplate('gstr')}
                className="text-xs text-mb-red hover:text-mb-red-dark font-semibold flex items-center gap-1 mx-auto transition-colors"
              >
                <Download size={12} /> Download GSTR-2B Template
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReconcile}
              disabled={!inwardFile || !gstrFile || isProcessing}
              className="mb-button-primary w-full md:w-auto flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                'Start Reconciliation'
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Ad */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-mb-gray flex items-center gap-2">
              <AlertCircle size={18} className="text-mb-red" />
              Recon Logic (v2.2)
            </h4>
            <ul className="space-y-3">
              {[
                "0.5% Tolerance on GST Amount",
                "PAN-based matching for GSTIN discrepancies",
                "Priority: Exact Match > PAN Match"
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-mb-red rounded-full mt-1.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
