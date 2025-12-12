import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, Phone, Mail, AlertCircle, Key, Shield } from 'lucide-react';
import { ref, push, set, get } from 'firebase/database';
import { db } from '../lib/firebase';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // 1. AUTO-DETECT ROOM: Use URL param 'room' or default to "CHIC"
  const roomId = searchParams.get('room') || "CHIC";

  // Form State
  const [email, setEmail] = useState("");
  const [authKey, setAuthKey] = useState(""); // This is either Password OR Phone
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validation Helpers
  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSmartLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const inputEmail = email.trim().toLowerCase();
    const inputKey = authKey.trim();

    if (!validateEmail(inputEmail)) { 
        setError("Invalid Email Format"); 
        setLoading(false); return; 
    }
    if (!inputKey) {
        setError("Please enter Password or Phone Number");
        setLoading(false); return;
    }

    // --- CREDENTIALS FROM ENV ---
    const HOST_EMAIL = (import.meta.env.VITE_HOST_EMAIL || "").toLowerCase();
    const HOST_PWD = import.meta.env.VITE_HOST_PWD;
    
    const MOD_EMAIL = (import.meta.env.VITE_MODERATOR_EMAIL || "").toLowerCase();
    const MOD_PWD = import.meta.env.VITE_MODERATOR_PWD;

    let finalRole = 'audience';
    let userId = '';
    let userPhone = '';

    // --- LOGIC BRANCHING ---

    // CASE A: HOST LOGIN
    if (inputEmail === HOST_EMAIL) {
        if (inputKey === HOST_PWD) {
            finalRole = 'host';
            userId = 'HOST';
            userPhone = 'N/A';
        } else {
            setError("Invalid Host Password");
            setLoading(false); return;
        }
    }
    // CASE B: MODERATOR LOGIN
    else if (inputEmail === MOD_EMAIL) {
        if (inputKey === MOD_PWD) {
            finalRole = 'moderator';
            userId = 'MODERATOR';
            userPhone = 'N/A';
        } else {
            setError("Invalid Moderator Password");
            setLoading(false); return;
        }
    }
    // CASE C: AUDIENCE LOGIN (Phone Check)
    else {
        // Treat inputKey as Phone Number
        // 1. Clean the phone number (Last 10 digits)
        const cleanPhone = inputKey.replace(/\D/g, '').slice(-10);
        
        if (cleanPhone.length < 10) {
            setError("Invalid Phone Number (Min 10 digits)");
            setLoading(false); return;
        }

        // 2. Database Lookup
        try {
            const guestRef = ref(db, `allowed_guests/${cleanPhone}`);
            const snapshot = await get(guestRef);

            if (!snapshot.exists()) {
                setError("Phone number not registered.");
                setLoading(false); return;
            }

            const guestData = snapshot.val();
            if (guestData.email.toLowerCase() !== inputEmail) {
                setError("Email does not match phone records.");
                setLoading(false); return;
            }

            // Success
            finalRole = 'audience';
            userId = `USER-${cleanPhone}`;
            userPhone = cleanPhone;

        } catch (err) {
            console.error(err);
            setError("Database Connection Error");
            setLoading(false); return;
        }
    }

    // --- FINAL STEP: CREATE SESSION & REDIRECT ---
    try {
        const userRef = push(ref(db, `audience_data/${roomId}`));
        await set(userRef, {
            email: inputEmail,
            phone: userPhone,
            role: finalRole,
            userId: userId,
            joinedAt: Date.now(),
            restrictions: { isMuted: false, isBidBanned: false, isKicked: false }
        });

        // Navigate to the Room (The URL determines the actual Agora channel)
        navigate(`/room/${roomId}?dbKey=${userRef.key}`);
        
    } catch (err) {
        console.error("Session Creation Failed:", err);
        setError("Failed to join room. Try again.");
        setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-[#FF6600] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 z-10"
      >
        <div className="text-center space-y-2">
            <h1 className="font-display font-black text-4xl tracking-tighter uppercase">DIBS LIVE</h1>
            <p className="font-mono text-xs text-white/80 uppercase tracking-widest">
                Room: <span className="font-bold text-white">{roomId}</span>
            </p>
        </div>

        <form onSubmit={handleSmartLogin} className="space-y-4">
            
            {/* Field 1: Email */}
            <div className="space-y-1">
                <label className="text-[10px] font-mono text-white uppercase ml-2">Email Address</label>
                <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-white" />
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-white/20 border border-white rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white focus:outline-none focus:bg-white/30 transition-colors placeholder:text-white/50"
                    />
                </div>
            </div>

            {/* Field 2: Smart Input (Phone OR Password) */}
            <div className="space-y-1">
                <label className="text-[10px] font-mono text-white uppercase ml-2">
                    Phone Number / Password
                </label>
                <div className="relative group">
                    <Key className="absolute left-4 top-3.5 w-4 h-4 text-white" />
                    <input 
                        type="text" // Generic text to accept both
                        value={authKey} 
                        onChange={(e) => setAuthKey(e.target.value)} 
                        placeholder="9876543210  OR  ••••••" 
                        className="w-full bg-white/20 border border-white rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white focus:outline-none focus:bg-white/30 transition-colors placeholder:text-white/50"
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
                        className="flex items-center gap-2 text-white bg-white/20 p-3 rounded-lg border border-white"
                    >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Login Button */}
            <button 
                type="submit"
                disabled={loading}
                className="w-full bg-white text-[#FF6600] font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg"
            >
                {loading ? (
                    <span className="animate-pulse">Accessing...</span>
                ) : (
                    <>
                        <span>ENTER LIVE ROOM</span>
                        <ArrowRight className="w-4 h-4" />
                    </>
                )}
            </button>

        </form>
      </motion.div>
    </div>
  );
};