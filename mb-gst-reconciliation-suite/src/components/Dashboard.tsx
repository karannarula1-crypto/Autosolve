import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, Users, AlertCircle, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { ReconReport } from '../services/reconService';

interface DashboardProps {
  data: ReconReport;
  onSendCFOReport: (chartImage: string) => void;
  isSendingReport: boolean;
  role?: string;
}

export default function Dashboard({ data, onSendCFOReport, isSendingReport, role }: DashboardProps) {
  const stats = React.useMemo(() => {
    const dataArray = data.gstrResults;
    const s: Record<string, number> = { 
      "Matched": 0, 
      "Mismatch": 0, 
      "Not Found in Inward Register": 0, 
      "Vendor/Supplier GSTIN Mismatch": 0,
      "Transaction appeared in Different Invoice no.": 0
    };
    const vendorRecon: Record<string, any> = {};
    let totalMismatchValue = 0;

    dataArray.forEach(item => {
      const status = item.status;
      const amt = item.gstAmount || 0;
      const pan = item.vendorPan || 'UNKNOWN_PAN';
      const name = item.vendorName || 'Unknown Vendor';

      s[status] = (s[status] || 0) + 1;

      if (!vendorRecon[pan]) vendorRecon[pan] = { name, matchedAmt: 0, mismatchAmt: 0, notFoundAmt: 0, totalCount: 0, matchCount: 0 };
      vendorRecon[pan].totalCount++;
      if (status === "Matched") {
        vendorRecon[pan].matchedAmt += amt;
        vendorRecon[pan].matchCount++;
      } else if (status === "Not Found in Inward Register" || status === "Not Found in GSTR-2B") {
        vendorRecon[pan].notFoundAmt += amt;
        totalMismatchValue += amt;
      } else {
        vendorRecon[pan].mismatchAmt += amt;
        totalMismatchValue += amt;
      }
    });

    const pieData = [
      { name: 'Matched', value: s['Matched'], color: '#10b981' },
      { name: 'Mismatch/Differences', value: (s['Mismatch'] || 0) + (s['Vendor/Supplier GSTIN Mismatch'] || 0) + (s['Transaction appeared in Different Invoice no.'] || 0), color: '#f59e0b' },
      { name: 'Not Found', value: s['Not Found in Inward Register'], color: '#ef4444' },
    ];

    const generateShortName = (name: string) => name.length > 25 ? name.substring(0, 25) + '...' : name;

    const top10Mismatch = Object.values(vendorRecon)
      .map((v: any) => ({ ...v, shortName: generateShortName(v.name), totalDeficit: v.mismatchAmt + v.notFoundAmt }))
      .filter((v: any) => v.totalDeficit > 0)
      .sort((a: any, b: any) => b.totalDeficit - a.totalDeficit)
      .slice(0, 10);

    const top5Compliant = Object.values(vendorRecon)
      .map((v: any) => ({ ...v, shortName: generateShortName(v.name) }))
      .filter((v: any) => v.matchCount > 0 && v.mismatchAmt === 0 && v.notFoundAmt === 0)
      .sort((a: any, b: any) => b.matchedAmt - a.matchedAmt)
      .slice(0, 5);

    return { pieData, top10Mismatch, top5Compliant, s, totalMismatchValue };
  }, [data]);

  const handleSendReport = () => {
    // In a real browser we might use html2canvas to capture the chart
    // For now we'll just send the data
    onSendCFOReport('');
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Matched</span>
            <CheckCircle2 className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-black text-mb-gray">{stats.s['Matched']}</p>
          <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full" style={{ width: `${(stats.s['Matched'] / data.gstrResults.length) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Mismatch</span>
            <AlertCircle className="text-yellow-500" size={20} />
          </div>
          <p className="text-3xl font-black text-mb-gray">{(stats.s['Mismatch'] || 0) + (stats.s['Vendor/Supplier GSTIN Mismatch'] || 0) + (stats.s['Transaction appeared in Different Invoice no.'] || 0)}</p>
          <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
            <div className="bg-yellow-500 h-full" style={{ width: `${(((stats.s['Mismatch'] || 0) + (stats.s['Vendor/Supplier GSTIN Mismatch'] || 0) + (stats.s['Transaction appeared in Different Invoice no.'] || 0)) / data.gstrResults.length) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Not Found</span>
            <AlertCircle className="text-red-500" size={20} />
          </div>
          <p className="text-3xl font-black text-mb-gray">{stats.s['Not Found in Inward Register']}</p>
          <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
            <div className="bg-red-500 h-full" style={{ width: `${(stats.s['Not Found in Inward Register'] / data.gstrResults.length) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Value</span>
            <TrendingUp className="text-mb-yellow" size={20} />
          </div>
          <p className="text-3xl font-black text-mb-gray">₹{stats.totalMismatchValue.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Total Mismatch Amount</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Compliance Chart */}
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-mb-gray uppercase tracking-tight">Compliance Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Mismatch Contributors */}
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-mb-gray uppercase tracking-tight">Top 10 Mismatch & Not Found</h3>
              <p className="text-xs text-gray-400 font-medium">Vendors with highest deficit amount</p>
            </div>
            <button
              onClick={handleSendReport}
              disabled={isSendingReport || role === 'view_only'}
              className="mb-button-primary text-xs py-2 disabled:opacity-50 flex items-center gap-2"
            >
              <Mail size={14} />
              {isSendingReport ? 'Sending...' : 'Send CFO Report'}
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top10Mismatch} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="shortName" 
                  type="category" 
                  width={150} 
                  tick={{ fontSize: 10, fill: '#4b5563', fontWeight: 600 }} 
                  interval={0} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Deficit Amount']}
                />
                <Bar dataKey="totalDeficit" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={16}>
                  {stats.top10Mismatch.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#b91c1c' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-black text-mb-gray uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-green-500" size={24} />
              Top 5 Compliant Vendors
            </h3>
            <p className="text-xs text-gray-400 font-medium tracking-tight">Vendors with 100% matched transactions</p>
          </div>
        </div>
        <div className="h-64">
           {stats.top5Compliant.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top5Compliant} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="shortName" 
                  type="category" 
                  width={150} 
                  tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 600 }} 
                  interval={0} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Matched Amount']}
                />
                <Bar dataKey="matchedAmt" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
           ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <AlertCircle size={48} className="text-gray-200 mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">No fully compliant vendors found</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
