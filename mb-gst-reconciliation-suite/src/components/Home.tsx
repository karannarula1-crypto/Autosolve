import React from 'react';
import { 
  FileSpreadsheet, 
  LayoutDashboard, 
  ChevronRight, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Upload,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { ReconReport } from '../services/reconService';

interface HomeProps {
  reconData: ReconReport | null;
  onNavigate: (tab: any) => void;
  role?: string;
}

export default function Home({ reconData, onNavigate, role }: HomeProps) {
  // Mock recent activity - in a real app, this would come from Firestore
  const recentActivity = [
    { id: 1, type: 'upload', title: 'Inward Register Uploaded', time: '2 hours ago', user: 'Karan N.' },
    { id: 2, type: 'recon', title: 'Reconciliation Completed', time: '3 hours ago', user: 'System' },
    { id: 3, type: 'email', title: 'Vendor Emails Sent', time: '5 hours ago', user: 'Karan N.' },
    { id: 4, type: 'report', title: 'CFO Report Generated', time: 'Yesterday', user: 'Karan N.' },
  ];

  const stats = React.useMemo(() => {
    if (!reconData) return null;
    const array = reconData.gstrResults;
    const s: Record<string, number> = { "Matched": 0, "Mismatch": 0, "Not Found": 0, "Vendor/Supplier GSTIN Mismatch": 0 };
    array.forEach(item => {
      s[item.status] = (s[item.status] || 0) + 1;
    });
    const total = array.length;
    const matched = s['Matched'] || 0;
    const accuracy = total > 0 ? ((matched / total) * 100).toFixed(1) : "0.0";
    return { total, matched, accuracy, s };
  }, [reconData]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-mb-gray tracking-tight">Welcome back, Karan</h1>
          <p className="text-gray-500">Here's what's happening with your GST reconciliations today.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
          <Clock size={16} className="text-mb-red" />
          <span className="text-xs font-bold text-mb-gray uppercase tracking-widest">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {role !== 'view_only' ? (
          <motion.button
            whileHover={{ y: -4 }}
            onClick={() => onNavigate('upload')}
            className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group"
          >
            <div className="w-12 h-12 bg-mb-red/10 rounded-xl flex items-center justify-center text-mb-red mb-4 group-hover:bg-mb-red group-hover:text-white transition-colors">
              <Upload size={24} />
            </div>
            <h3 className="font-black text-mb-gray uppercase tracking-tight mb-1">Upload Data</h3>
            <p className="text-xs text-gray-400">Import Inward Register & GSTR-2B files</p>
            <div className="mt-4 flex items-center text-mb-red text-xs font-bold uppercase tracking-widest">
              Get Started <ChevronRight size={14} />
            </div>
          </motion.button>
        ) : (
          <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center space-y-2 opacity-60">
            <ShieldCheck size={32} className="text-gray-400" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upload Restricted</p>
          </div>
        )}

        <motion.button
          whileHover={{ y: -4 }}
          disabled={!reconData}
          onClick={() => onNavigate('dashboard')}
          className={`p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group ${!reconData ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          <div className="w-12 h-12 bg-mb-yellow/10 rounded-xl flex items-center justify-center text-mb-yellow mb-4 group-hover:bg-mb-yellow group-hover:text-mb-gray transition-colors">
            <LayoutDashboard size={24} />
          </div>
          <h3 className="font-black text-mb-gray uppercase tracking-tight mb-1">Analytics</h3>
          <p className="text-xs text-gray-400">View compliance trends & executive summaries</p>
          <div className="mt-4 flex items-center text-mb-yellow text-xs font-bold uppercase tracking-widest">
            View Insights <ChevronRight size={14} />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -4 }}
          disabled={!reconData}
          onClick={() => onNavigate('results')}
          className={`p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group ${!reconData ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          <div className="w-12 h-12 bg-mb-gray/10 rounded-xl flex items-center justify-center text-mb-gray mb-4 group-hover:bg-mb-gray group-hover:text-white transition-colors">
            <FileText size={24} />
          </div>
          <h3 className="font-black text-mb-gray uppercase tracking-tight mb-1">Reports</h3>
          <p className="text-xs text-gray-400">Detailed transaction-wise reconciliation report</p>
          <div className="mt-4 flex items-center text-mb-gray text-xs font-bold uppercase tracking-widest">
            Open Reports <ChevronRight size={14} />
          </div>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reconciliation Progress / Snapshot */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-black text-mb-gray uppercase tracking-tight">Reconciliation Snapshot</h3>
              {stats && (
                <span className="text-[10px] font-black bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100 uppercase tracking-widest">
                  Live Data
                </span>
              )}
            </div>
            <div className="p-8">
              {stats ? (
                <div className="space-y-8">
                  <div className="flex items-end gap-4">
                    <div className="text-6xl font-black text-mb-gray tracking-tighter">{stats.accuracy}%</div>
                    <div className="pb-2">
                      <div className="text-xs font-black text-green-600 uppercase tracking-widest">Match Accuracy</div>
                      <div className="text-[10px] text-gray-400">Based on {stats.total} transactions</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>Matched</span>
                        <span>{stats.matched}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(stats.matched / stats.total) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>Mismatch</span>
                        <span>{(stats.s['Mismatch'] || 0) + (stats.s['Vendor/Supplier GSTIN Mismatch'] || 0)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-mb-red" style={{ width: `${(((stats.s['Mismatch'] || 0) + (stats.s['Vendor/Supplier GSTIN Mismatch'] || 0)) / stats.total) * 100}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>Not Found</span>
                        <span>{stats.s['Not Found']}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-mb-gray" style={{ width: `${(stats.s['Not Found'] / stats.total) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => onNavigate('dashboard')}
                    className="w-full py-3 border border-gray-100 rounded-xl text-xs font-black text-mb-gray uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    View Detailed Analytics <ArrowUpRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-mb-gray">No Data Reconciled Yet</h4>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">Upload your Inward Register and GSTR-2B files to see your reconciliation progress here.</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('upload')}
                    className="mb-button-primary text-xs"
                  >
                    Upload Files Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-gray-50">
              <h3 className="font-black text-mb-gray uppercase tracking-tight">Recent Activity</h3>
            </div>
            <div className="p-0">
              {recentActivity.map((activity, i) => (
                <div 
                  key={activity.id} 
                  className={`p-4 flex gap-4 hover:bg-gray-50 transition-colors ${i !== recentActivity.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activity.type === 'upload' ? 'bg-blue-50 text-blue-600' :
                    activity.type === 'recon' ? 'bg-green-50 text-green-600' :
                    activity.type === 'email' ? 'bg-purple-50 text-purple-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {activity.type === 'upload' && <Upload size={14} />}
                    {activity.type === 'recon' && <CheckCircle2 size={14} />}
                    {activity.type === 'email' && <AlertCircle size={14} />}
                    {activity.type === 'report' && <FileText size={14} />}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-mb-gray">{activity.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                      <span>{activity.time}</span>
                      <span>â€¢</span>
                      <span>By {activity.user}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50/50">
              <button className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-mb-red transition-colors">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
