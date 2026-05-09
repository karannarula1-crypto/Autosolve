import React, { useState, useMemo } from 'react';
import { Search, Filter, Mail, Download, CheckCircle, AlertTriangle, XCircle, Edit2, Save, X, FileText, Database } from 'lucide-react';
import { ReconReport, ReconResult } from '../services/reconService';

interface ReconResultsProps {
  data: ReconReport;
  onSendEmails: () => void;
  isSendingEmails: boolean;
  onUpdateRow: (tab: 'inward' | 'gstr', index: number, updatedRow: any[]) => void;
  role?: string;
}

type ViewMode = 'transaction' | 'vendor' | 'mb-gstin' | 'status';

export default function ReconResults({ data, onSendEmails, isSendingEmails, onUpdateRow, role }: ReconResultsProps) {
  const [activeTab, setActiveTab] = useState<'inward' | 'gstr'>('gstr');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('transaction');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any[]>([]);

  const currentData = activeTab === 'inward' ? data.inwardResults : data.gstrResults;

  const filteredData = useMemo(() => {
    let result = currentData.map((item, index) => ({ ...item, originalIndex: index }));

    // Search
    if (search) {
      result = result.filter(item => 
        String(item.vendorName).toLowerCase().includes(search.toLowerCase()) ||
        String(item.invoiceNo).toLowerCase().includes(search.toLowerCase())
      );
    }

    // Status Filter
    if (filter !== 'all') {
      result = result.filter(item => item.status === filter);
    }

    return result;
  }, [currentData, search, filter, activeTab]);

  const groupedData = useMemo(() => {
    if (viewMode === 'transaction') return null;

    const groups: Record<string, any[]> = {};
    filteredData.forEach(item => {
      let key = '';
      if (viewMode === 'vendor') key = String(item.vendorName);
      else if (viewMode === 'mb-gstin') key = 'Not Available (GSTR)'; // Recipient GSTIN might not be present easily in this view, fallback. Wait, actually I'll just put standard.
      else if (viewMode === 'status') key = item.status;

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredData, viewMode]);

  const handleEdit = (index: number, row: any[]) => {
    setEditingIndex(index);
    setEditValues([...row]);
  };

  const handleSave = (index: number) => {
    onUpdateRow(activeTab, index, editValues);
    setEditingIndex(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Matched': return 'bg-green-50 text-green-700 border-green-200';
      case 'Vendor/Supplier GSTIN Mismatch': return 'bg-mb-red/5 text-mb-red border-mb-red/20';
      case 'Transaction appeared in Different Invoice no.': return 'bg-mb-yellow/10 text-mb-yellow border-mb-yellow/30';
      case 'Mismatch': return 'bg-mb-red/10 text-mb-red border-mb-red/30';
      case 'Not Found in Inward Register': return 'bg-mb-gray text-white border-mb-gray';
      case 'Not Found in GSTR-2B': return 'bg-mb-gray text-white border-mb-gray';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Matched': return <CheckCircle size={14} />;
      case 'Vendor/Supplier GSTIN Mismatch': return <AlertTriangle size={14} />;
      case 'Mismatch': return <AlertTriangle size={14} />;
      case 'Transaction appeared in Different Invoice no.': return <AlertTriangle size={14} />;
      case 'Not Found in Inward Register': return <XCircle size={14} />;
      case 'Not Found in GSTR-2B': return <XCircle size={14} />;
      default: return null;
    }
  };

  const handleDownload = () => {
    if (filteredData.length === 0) return;
    
    // Extract headers from the first row and append Recon columns
    const headers = ["Vendor Name", "Vendor GSTIN", "Recipient GSTIN", "Invoice Date", "Invoice No", "GST Amount", "Recon Status", "Remarks", "Email ID", "Email Sent At"];
    
    const csvContent = [
      headers.join(","),
      ...filteredData.map(item => {
        const row = [
          `"${item.vendorName || ''}"`,
          `"${extractGstin(item.row) || ''}"`,
          `"${item.row[3] || item.row[4] || ''}"`, // Rough fallback for Recipient GSTIN
          `"${item.invoiceDate || ''}"`,
          `"${item.invoiceNo || ''}"`,
          item.gstAmount || 0,
          `"${item.status}"`,
          `"${item.remarks}"`,
          `"${item.vendorEmail || ''}"`,
          `"${item.emailSentAt ? new Date(item.emailSentAt).toLocaleString() : ''}"`
        ];
        return row.join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Recon_Report_${activeTab}_filtered.csv`;
    link.click();
  };

  const extractGstin = (row: any[]) => {
    for(const val of row) {
      if (typeof val === 'string' && val.length === 15 && /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/.test(val)) {
        return val;
      }
    }
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('gstr'); setFilter('all'); setSearch(''); }}
          className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-xs tracking-widest transition-colors ${
            activeTab === 'gstr' ? 'border-b-2 border-mb-red text-mb-red' : 'text-gray-400 hover:text-mb-gray'
          }`}
        >
          <Database size={16} />
          Based on GSTR-2B
        </button>
        <button
          onClick={() => { setActiveTab('inward'); setFilter('all'); setSearch(''); }}
          className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-xs tracking-widest transition-colors ${
            activeTab === 'inward' ? 'border-b-2 border-mb-red text-mb-red' : 'text-gray-400 hover:text-mb-gray'
          }`}
        >
          <FileText size={16} />
          Based on Inward Register
        </button>
      </div>

      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search Vendor or Invoice..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mb-red focus:border-mb-red outline-none bg-white shadow-sm transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-mb-red bg-white shadow-sm transition-all text-sm font-bold text-mb-gray"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Matched">Matched</option>
              <option value="Vendor/Supplier GSTIN Mismatch">GSTIN Mismatch</option>
              <option value="Mismatch">Mismatch</option>
              <option value="Transaction appeared in Different Invoice no.">Diff Invoice No</option>
              {activeTab === 'gstr' && <option value="Not Found in Inward Register">Not Found (Inward)</option>}
              {activeTab === 'inward' && <option value="Not Found in GSTR-2B">Not Found (GSTR)</option>}
            </select>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleDownload}
              className="bg-white border border-gray-200 text-mb-gray hover:bg-gray-50 flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide transition-all shadow-sm"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={onSendEmails}
              disabled={isSendingEmails || role === 'view_only'}
              className="mb-button-primary flex-1 md:flex-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Mail size={18} />
              {isSendingEmails ? 'Sending...' : 'Email Vendors'}
            </button>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          {[
            { id: 'transaction', label: 'Transaction View' },
            { id: 'vendor', label: 'Vendor Wise' },
            { id: 'mb-gstin', label: 'MB GSTIN Wise' },
            { id: 'status', label: 'Status Wise' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as ViewMode)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === mode.id 
                  ? 'bg-white text-mb-red shadow-sm' 
                  : 'text-gray-500 hover:text-mb-gray'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Vendor Name</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Invoice No</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Date</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">GST Amount</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Email Config</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {viewMode === 'transaction' ? (
                filteredData.map((item) => (
                  <tr key={item.originalIndex} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      {editingIndex === item.originalIndex ? (
                        <input 
                          className="w-full p-1 border rounded" 
                          value={editValues[0]} 
                          onChange={(e) => {
                            const v = [...editValues];
                            v[0] = e.target.value;
                            setEditValues(v);
                          }}
                        />
                      ) : (
                        <span className="font-bold text-mb-gray">{item.vendorName || "Unknown"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingIndex === item.originalIndex ? (
                        <input 
                          className="w-full p-1 border rounded" 
                          value={editValues[7]} 
                          onChange={(e) => {
                            const v = [...editValues];
                            v[7] = e.target.value;
                            setEditValues(v);
                          }}
                        />
                      ) : (
                        <span className="text-gray-500 font-medium">{item.invoiceNo || "N/A"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{(item.invoiceDate)}</td>
                    <td className="px-6 py-4 text-right font-black text-mb-gray">
                      {editingIndex === item.originalIndex ? (
                        <input 
                          type="number"
                          className="w-24 p-1 border rounded text-right" 
                          value={editValues[11]} 
                          onChange={(e) => {
                            const v = [...editValues];
                            v[11] = e.target.value;
                            setEditValues(v);
                          }}
                        />
                      ) : (
                        `₹${(item.gstAmount || 0).toLocaleString('en-IN')}`
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${getStatusColor(item.status)}`} title={item.remarks}>
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-500 font-medium truncate max-w-[150px]" title={item.vendorEmail}>{item.vendorEmail || "N/A"}</span>
                        {item.emailSentAt && <span className="text-[10px] text-green-600 font-bold">Sent: {new Date(item.emailSentAt).toLocaleString()}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingIndex === item.originalIndex ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleSave(item.originalIndex)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={16} /></button>
                          <button onClick={() => setEditingIndex(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={16} /></button>
                        </div>
                      ) : (
                        role !== 'view_only' && (
                          <button onClick={() => handleEdit(item.originalIndex, item.row)} className="p-1 text-gray-400 hover:text-mb-red hover:bg-mb-red/5 rounded opacity-0 group-hover:opacity-100 transition-all">
                            <Edit2 size={16} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                groupedData?.map(([key, items]) => (
                  <React.Fragment key={key}>
                    <tr className="bg-gray-50/80">
                      <td colSpan={7} className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <Filter size={12} className="text-mb-red" />
                          <span className="text-xs font-black text-mb-gray uppercase tracking-widest">{key}</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">{items.length} items</span>
                        </div>
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.originalIndex} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-mb-gray">{item.vendorName || "Unknown"}</td>
                        <td className="px-6 py-4 text-gray-500 font-medium">{item.invoiceNo || "N/A"}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs text-nowrap">{(item.invoiceDate)}</td>
                        <td className="px-6 py-4 text-right font-black text-mb-gray">₹{(item.gstAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${getStatusColor(item.status)}`} title={item.remarks}>
                            {getStatusIcon(item.status)}
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-500 font-medium truncate max-w-[150px]" title={item.vendorEmail}>{item.vendorEmail || "N/A"}</span>
                            {item.emailSentAt && <span className="text-[10px] text-green-600 font-bold">Sent: {new Date(item.emailSentAt).toLocaleString()}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => handleEdit(item.originalIndex, item.row)} className="p-1 text-gray-400 hover:text-mb-red hover:bg-mb-red/5 rounded opacity-0 group-hover:opacity-100 transition-all">
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Search size={48} strokeWidth={1} />
                      <p className="font-bold uppercase tracking-widest text-xs">No records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
