import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Phone, Mail, AlertCircle } from 'lucide-react';
import { ref, push, set } from 'firebase/database';
import { db } from '../lib/firebase';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get intended destination from URL
  const roomId = searchParams.get('room');
  const role = searchParams.get('role');

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\d{10,}$/.test(phone); // At least 10 digits

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Basic Validation
    if (!validateEmail(email)) {
        setError("Invalid Email Format");
        setLoading(false);
        return;
    }
    if (!validatePhone(phone)) {
        setError("Invalid Phone Number (Min 10 digits)");
        setLoading(false);
        return;
    }

    // 2. HOST GATEKEEPING
    if (role === 'host') {
        const allowedHost = import.meta.env.VITE_HOST_EMAIL; // <--- NEW
        
        if (email.toLowerCase() !== allowedHost) {
            alert("ACCESS DENIED: Unauthorized Host Email");
            navigate('/'); 
            return;
        }
    }

    // 3. GENERATE ID & STORE USER DATA (Lead Generation)
    try {
        const userId = role === 'host' ? 'HOST' : `USER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Save to Firebase for your records
        const userRef = push(ref(db, `audience_data/${roomId}`));
        await set(userRef, {
            email,
            phone,
            role,
            userId,
            joinedAt: Date.now()
        });

        // 4. SUCCESS -> NAVIGATE TO ROOM
        // We pass the userId in state or url if needed later, but for now just entry
        navigate(`/room/${roomId}?role=${role}`);

    } catch (err) {
        console.error("Login Error:", err);
        setError("Connection Failed. Try again.");
        setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-black"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 z-10"
      >
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="font-display font-black text-4xl tracking-tighter uppercase">
                {role === 'host' ? 'Host Access' : 'Viewer Entry'}
            </h1>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                {role === 'host' ? 'Restricted Area' : 'Enter Details to Join'}
            </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Input */}
            <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-500 uppercase ml-2">Email Address</label>
                <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-700"
                    />
                </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-500 uppercase ml-2">Phone Number</label>
                <div className="relative group">
                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                    <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-700"
                    />
                </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex items-center gap-2 text-red-500 bg-red-950/30 p-3 rounded-lg border border-red-900/50"
                    >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit Button */}
            <button 
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
            >
                {loading ? (
                    <span className="animate-pulse">Verifying...</span>
                ) : (
                    <>
                        <span>{role === 'host' ? 'Verify Identity' : 'Enter Room'}</span>
                        {role === 'host' ? <Lock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </>
                )}
            </button>

        </form>
      </motion.div>
    </div>
  );
};