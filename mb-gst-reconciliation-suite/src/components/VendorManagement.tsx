import React, { useState, useRef } from 'react';
import { Upload, Download, Search, Edit2, Check, X } from 'lucide-react';
import Papa from 'papaparse';

interface VendorManagementProps {
  vendorMaster: Record<string, { name: string; email: string }>;
  onUpdateVendors: (newMaster: Record<string, { name: string; email: string }>) => void;
}

export function VendorManagement({ vendorMaster, onUpdateVendors }: VendorManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPan, setEditingPan] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");

  const vendorsList = Object.entries(vendorMaster).map(([pan, data]) => ({ pan, ...data }));
  
  const filteredVendors = vendorsList.filter(v => 
    v.pan.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadTemplate = () => {
    const csvContent = ["PAN,Vendor Name,Email\n"];
    csvContent.push("ABCDE1234F,Example Corp,finance@example.com\n");
    const blob = new Blob([csvContent.join("")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "vendor_email_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newMaster = { ...vendorMaster };
        let count = 0;
        results.data.forEach((row: any) => {
          const pan = row['PAN'] || row['pan'];
          const email = row['Email'] || row['email'];
          const name = row['Vendor Name'] || row['vendor name'] || row['Name'] || row['name'];
          if (pan && typeof pan === 'string' && email && typeof email === 'string') {
             newMaster[pan.trim()] = { 
               name: name?.trim() || vendorMaster[pan.trim()]?.name || '', 
               email: email.trim() 
             };
             count++;
          }
        });
        if (count > 0) {
          onUpdateVendors(newMaster);
          alert(`Successfully imported ${count} vendor emails.`);
        } else {
          alert('No valid data found in CSV. Please ensure columns PAN and Email exist.');
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const startEdit = (pan: string, currentEmail: string) => {
    setEditingPan(pan);
    setEditEmail(currentEmail);
  };

  const saveEdit = () => {
    if (editingPan) {
      const newMaster = {
        ...vendorMaster,
        [editingPan]: { ...vendorMaster[editingPan], email: editEmail }
      };
      onUpdateVendors(newMaster);
    }
    setEditingPan(null);
  };

  return (
    <div className="bg-white rounded-none border border-gray-200">
      <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 uppercase">Vendor Management</h2>
          <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mt-1">Configure Vendor Emails for Auto-Reconciliation</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border-2 border-gray-200 bg-white text-gray-600 font-bold text-xs uppercase tracking-widest hover:border-black hover:text-black transition-colors"
          >
            <Download size={14} />
            Template
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-mb-red text-white font-bold text-xs uppercase tracking-widest hover:bg-black transition-colors"
          >
            <Upload size={14} />
            Bulk Upload Emails
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv" 
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 min-w-4 max-w-4 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors by PAN, Name, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 text-sm focus:border-mb-red focus:ring-0 outline-none font-medium"
          />
        </div>

        <div className="overflow-x-auto border-2 border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-100">
              <tr>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 w-1/4">PAN</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 w-1/3">Vendor Name</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 w-1/3">Email Address</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.length > 0 ? (
                filteredVendors.map((vendor, i) => (
                  <tr key={vendor.pan} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600 font-bold">{vendor.pan}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{vendor.name || <span className="text-gray-300 italic">Unknown</span>}</td>
                    <td className="px-6 py-4">
                      {editingPan === vendor.pan ? (
                        <input
                          type="email"
                          autoFocus
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          className="w-full px-2 py-1 border-2 border-mb-red focus:outline-none text-sm font-medium"
                        />
                      ) : (
                        <span className={vendor.email ? "text-gray-600" : "text-gray-400 italic"}>
                          {vendor.email || "Not Configured"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingPan === vendor.pan ? (
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingPan(null)} className="p-1 text-red-600 hover:bg-red-50">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(vendor.pan, vendor.email)} className="p-1 text-gray-400 hover:text-mb-red">
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <p className="font-bold uppercase tracking-widest text-xs">No vendors found</p>
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
