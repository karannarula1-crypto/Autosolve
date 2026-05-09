import React from 'react';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Building2 } from 'lucide-react';
import { signIn } from '../firebase';

export default function Login() {
  return (
    <div className="min-h-screen bg-mb-light flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-mb-red rounded-2xl shadow-xl text-white mb-4"
          >
            <Building2 size={40} />
          </motion.div>
          <h1 className="text-4xl font-black text-mb-gray tracking-tighter">
            magicbricks <span className="text-mb-red italic">Finance</span>
          </h1>
          <p className="text-gray-500 font-medium">GST Reconciliation Suite v2.2</p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 space-y-6"
        >
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold text-mb-gray">Secure Access Only</h2>
            <p className="text-sm text-gray-400">Please sign in with your Magicbricks Google account to continue.</p>
          </div>

          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 hover:border-mb-red py-4 rounded-2xl font-bold text-mb-gray transition-all hover:shadow-lg active:scale-95 group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Sign in with Google
          </button>

          <div className="pt-4 flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest justify-center">
            <ShieldCheck size={12} className="text-green-500" />
            Enterprise Grade Security
          </div>
        </motion.div>

        <p className="text-center text-xs text-gray-400">
          © 2026 Magicbricks Realty Services Limited. All rights reserved.
        </p>
      </div>
    </div>
  );
}
