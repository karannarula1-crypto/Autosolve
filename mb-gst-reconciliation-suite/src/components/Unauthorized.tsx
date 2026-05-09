import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { logOut } from '../firebase';

export default function Unauthorized({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-mb-light flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 text-center space-y-6"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 bg-mb-yellow/10 text-mb-yellow rounded-full mb-4">
          <ShieldAlert size={40} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-mb-gray tracking-tight">Access Pending</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your account <span className="font-bold text-mb-gray">{email}</span> is currently awaiting authorization from the system administrator.
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl text-left space-y-3">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Steps</h3>
          <ul className="space-y-2">
            <li className="flex gap-3 text-xs text-gray-600">
              <div className="w-1.5 h-1.5 bg-mb-red rounded-full mt-1.5 shrink-0" />
              Contact your manager for portal access.
            </li>
            <li className="flex gap-3 text-xs text-gray-600">
              <div className="w-1.5 h-1.5 bg-mb-red rounded-full mt-1.5 shrink-0" />
              Wait for the Admin to approve your request.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.href = `mailto:karan.narula1@magicbricks.com?subject=GST Portal Access Request&body=Requesting access for ${email}`}
            className="w-full flex items-center justify-center gap-2 bg-mb-red text-white py-3 rounded-xl font-bold hover:bg-mb-red-dark transition-all"
          >
            <Mail size={18} />
            Contact Admin
          </button>
          
          <button
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-mb-gray py-2 text-sm font-bold transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
