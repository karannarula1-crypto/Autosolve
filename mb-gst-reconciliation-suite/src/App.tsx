import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileSpreadsheet, Settings, LogOut, Menu, X, ChevronRight, Users, Download, Home as HomeIcon, ShieldCheck, Trash2 } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ReconResults from './components/ReconResults';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import Login from './components/Login';
import Unauthorized from './components/Unauthorized';
import AdminPanel from './components/AdminPanel';
import { VendorManagement } from './components/VendorManagement';
import { auth, logOut, getUserProfile, createUserProfile, UserProfile, logActivity } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ReconReport } from './services/reconService';

import * as XLSX from 'xlsx';

type Tab = 'home' | 'dashboard' | 'upload' | 'results' | 'vendors' | 'settings' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reconData, setReconData] = useState<ReconReport | null>(null);
  const [vendorMaster, setVendorMaster] = useState<Record<string, { name: string; email: string }>>(() => {
    const saved = localStorage.getItem('mb_vendor_master');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('mb_vendor_master', JSON.stringify(vendorMaster));
  }, [vendorMaster]);

  useEffect(() => {
    const saved = localStorage.getItem('mb_recon_data');
    if (saved) {
      try {
        setReconData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved recon data");
      }
    }
  }, []);

  const handleReconDataUpdate = (data: ReconReport | null) => {
    setReconData(data);
    if (data) {
      try {
        localStorage.setItem('mb_recon_data', JSON.stringify(data));
      } catch (e) {
        console.error("Local storage quota exceeded. Unable to save recon data persistently.", e);
      }
    } else {
      localStorage.removeItem('mb_recon_data');
    }
  };

  const patchReconWithVendors = (data: ReconReport, master: Record<string, { name: string; email: string }>) => {
    return {
      ...data,
      gstrResults: data.gstrResults.map(item => ({
        ...item,
        vendorEmail: master[item.vendorPan]?.email || item.vendorEmail
      })),
      inwardResults: data.inwardResults.map(item => ({
        ...item,
        vendorEmail: master[item.vendorPan]?.email || item.vendorEmail
      }))
    };
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure you want to delete all imported data and reconciliation results?")) {
      handleReconDataUpdate(null);
      setActiveTab('home');
    }
  };

  const handleUpdateVendors = (newMaster: Record<string, { name: string; email: string }>) => {
    setVendorMaster(newMaster);
    setReconData(prev => prev ? patchReconWithVendors(prev, newMaster) : null);
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        let userProfile = await getUserProfile(firebaseUser.uid);
        if (!userProfile) {
          userProfile = await createUserProfile(firebaseUser);
        }
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFilesReady = async (inward: File, gstr: File) => {
    if (profile?.role === 'view_only') {
      alert("Access Denied: You do not have permission to perform this action.");
      return;
    }
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('inward', inward);
    formData.append('gstr', gstr);

    try {
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        // Extract new vendors
        setVendorMaster((prevMaster) => {
          const newMaster = { ...prevMaster };
          const extractFrom = (results: any[]) => {
            results.forEach(row => {
              if (row.vendorPan) {
                if (!newMaster[row.vendorPan]) {
                  newMaster[row.vendorPan] = { name: row.vendorName || '', email: row.vendorEmail || '' };
                } else if (row.vendorName && !newMaster[row.vendorPan].name) {
                  newMaster[row.vendorPan].name = row.vendorName;
                }
              }
            });
          };
          extractFrom(data.gstrResults);
          extractFrom(data.inwardResults);
          
          handleReconDataUpdate(patchReconWithVendors(data, newMaster));
          return newMaster;
        });

        setActiveTab('dashboard');
        
        // Log the upload action
        if (user) {
          logActivity({
            type: 'upload',
            title: 'Data Uploaded',
            description: `Inward Register and GSTR-2B processed`,
            userEmail: user.email || '',
            userId: user.uid,
            metadata: { count: data.gstrResults.length }
          });
        }
      } else {
        alert(data.error || 'Failed to process reconciliation');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during reconciliation');
    } finally {
      setIsProcessing(false);
    }
  };



  const handleUpdateRow = (tab: 'inward' | 'gstr', index: number, updatedRow: any[]) => {
    if (profile?.role === 'view_only') {
      alert("Access Denied: You do not have permission to edit data.");
      return;
    }
    if (!reconData) return;
    
    if (tab === 'inward') {
      const newInward = [...reconData.inwardResults];
      newInward[index] = { ...newInward[index], row: updatedRow };
      handleReconDataUpdate({ ...reconData, inwardResults: newInward });
    } else {
      const newGstr = [...reconData.gstrResults];
      newGstr[index] = { ...newGstr[index], row: updatedRow };
      handleReconDataUpdate({ ...reconData, gstrResults: newGstr });
    }
  };

  const handleSendEmails = async () => {
    if (!reconData) return;
    setIsSendingEmails(true);
    try {
      const response = await fetch('/api/email-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: reconData.gstrResults }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.sentEmailsData && data.sentEmailsData.length > 0) {
          const newGstr = reconData.gstrResults.map(res => {
            const sentInfo = data.sentEmailsData.find((d: any) => d.pan === res.vendorPan);
            if (sentInfo && res.status !== "Matched") {
              return { ...res, emailSent: true, emailSentAt: sentInfo.timestamp };
            }
            return res;
          });
          const newInward = reconData.inwardResults.map(res => {
            const sentInfo = data.sentEmailsData.find((d: any) => d.pan === res.vendorPan);
            if (sentInfo && res.status !== "Matched") {
              return { ...res, emailSent: true, emailSentAt: sentInfo.timestamp };
            }
            return res;
          });
          handleReconDataUpdate({ ...reconData, gstrResults: newGstr, inwardResults: newInward });
        }
        
        if (data.mocked) {
          alert(`${data.count} Vendor emails simulated successfully! (SMTP not configured)`);
        } else {
          alert(`${data.count} Vendor emails sent successfully!`);
        }
      } else {
        alert(data.message || 'Failed to send emails');
      }
    } catch (error) {
      console.error(error);
      alert('Error sending emails');
    } finally {
      setIsSendingEmails(false);
    }
  };

  const handleSendCFOReport = async (chartImage: string) => {
    if (!reconData) return;
    setIsSendingReport(true);
    try {
      const response = await fetch('/api/email-cfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: reconData.gstrResults, chartImage }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.mocked) {
          alert('CFO Executive Report simulated successfully! (SMTP not configured)');
        } else {
          alert('CFO Executive Report sent successfully!');
        }
      } else {
        alert(data.message || 'Failed to send report');
      }
    } catch (error) {
      console.error(error);
      alert('Error sending report');
    } finally {
      setIsSendingReport(false);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard, disabled: !reconData },
    { id: 'upload', label: 'Upload Data', icon: FileSpreadsheet, hidden: profile?.role === 'view_only' },
    { id: 'results', label: 'Recon Report', icon: ChevronRight, disabled: !reconData },
    { id: 'vendors', label: 'Vendor Email Config', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'admin', label: 'Admin Panel', icon: ShieldCheck, hidden: profile?.role !== 'admin' },
  ];

  if (authLoading) {
    return (
      <div className="h-screen bg-mb-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mb-red"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (profile && !profile.isAuthorized) {
    return <Unauthorized email={user.email || ''} />;
  }

  return (
    <div className="flex h-screen bg-[#F5F5F5] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-lg z-20 ${isSidebarOpen ? 'w-64' : 'w-20'}`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-mb-red rounded-lg flex items-center justify-center text-white font-black text-xl shadow-inner shrink-0">MB</div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tighter text-mb-gray leading-none">magicbricks</span>
              <span className="text-[10px] uppercase tracking-widest text-mb-red font-bold">Innovation</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.filter(i => !i.hidden).map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-mb-red text-white shadow-lg shadow-mb-red/20' 
                  : item.disabled 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-mb-red'
              }`}
            >
              <item.icon size={20} className={activeTab === item.id ? 'text-white' : ''} />
              {isSidebarOpen && <span className="font-bold text-sm uppercase tracking-wide">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <button 
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-red-50 hover:text-mb-red rounded-lg transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-all"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            {isSidebarOpen && <span className="text-xs font-bold uppercase">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-8 w-1 bg-mb-red rounded-full" />
            <h2 className="text-xl font-black text-mb-gray tracking-tight">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            {profile?.role === 'admin' && (
              <button 
                onClick={clearAllData}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              >
                <Trash2 size={14} />
                Clear Data
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Live System
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-mb-gray">{profile?.displayName || 'User'}</p>
                <p className="text-[10px] text-mb-red font-bold uppercase tracking-tighter">{profile?.role.replace('_', ' ')}</p>
              </div>
              <div className="w-10 h-10 bg-mb-light rounded-full border-2 border-white shadow-sm flex items-center justify-center text-mb-red overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <Users size={20} />
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'home' && (
                <Home reconData={reconData} onNavigate={(tab) => setActiveTab(tab)} role={profile?.role} />
              )}
              {activeTab === 'upload' && (
                <FileUpload 
                  onFilesReady={handleFilesReady} 
                  isProcessing={isProcessing} 
                  isAdmin={profile?.role === 'admin'} 
                />
              )}
              {activeTab === 'results' && reconData && (
                <ReconResults 
                  data={reconData} 
                  onSendEmails={handleSendEmails} 
                  isSendingEmails={isSendingEmails} 
                  onUpdateRow={handleUpdateRow}
                  role={profile?.role}
                />
              )}
              {activeTab === 'dashboard' && reconData && (
                <Dashboard 
                  data={reconData} 
                  onSendCFOReport={handleSendCFOReport} 
                  isSendingReport={isSendingReport} 
                  role={profile?.role}
                />
              )}
              {activeTab === 'vendors' && (
                <VendorManagement 
                  vendorMaster={vendorMaster} 
                  onUpdateVendors={handleUpdateVendors} 
                />
              )}
              {activeTab === 'admin' && profile?.role === 'admin' && (
                <AdminPanel />
              )}
              {activeTab === 'settings' && (
                <div className="max-w-2xl bg-white p-8 rounded-xl border shadow-sm space-y-6">
                  <h3 className="text-xl font-bold">System Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">CFO Email Address</label>
                      <input type="email" defaultValue="Karan.Narula1@magicbricks.com" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-mb-red" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Tolerance Threshold (%)</label>
                      <input type="number" defaultValue="0.5" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-mb-red" />
                    </div>
                    <div className="pt-4">
                      <button className="px-6 py-2 bg-mb-red text-white rounded-lg hover:bg-mb-red-dark transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
