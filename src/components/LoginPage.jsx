import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, AlertCircle, Key } from 'lucide-react';
import { ref, push, set, get } from 'firebase/database';
import { db } from '../lib/firebase';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const roomId = searchParams.get('room') || "CHIC";

  // UI States
  const [showSplash, setShowSplash] = useState(true); // Control the Animation
  const [email, setEmail] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // --- 1. SPLASH SCREEN TIMER ---
  useEffect(() => {
      // Show logo for 2.5 seconds, then transition to form
      const timer = setTimeout(() => setShowSplash(false), 2500);
      return () => clearTimeout(timer);
  }, []);

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

    // Credentials
    const HOST_EMAIL = (import.meta.env.VITE_HOST_EMAIL || "").toLowerCase();
    const HOST_PWD = import.meta.env.VITE_HOST_PWD;
    const MOD_EMAIL = (import.meta.env.VITE_MODERATOR_EMAIL || "").toLowerCase();
    const MOD_PWD = import.meta.env.VITE_MODERATOR_PWD;

    let finalRole = 'audience';
    let userId = '';
    let userPhone = '';

    // LOGIC
    if (inputEmail === HOST_EMAIL) {
        if (inputKey === HOST_PWD) {
            finalRole = 'host'; userId = 'HOST'; userPhone = 'N/A';
        } else {
            setError("Invalid Host Password"); setLoading(false); return;
        }
    }
    else if (inputEmail === MOD_EMAIL) {
        if (inputKey === MOD_PWD) {
            finalRole = 'moderator'; userId = 'MODERATOR'; userPhone = 'N/A';
        } else {
            setError("Invalid Moderator Password"); setLoading(false); return;
        }
    }
    else {
        // Audience Check
        const cleanPhone = inputKey.replace(/\D/g, '').slice(-10);
        if (cleanPhone.length < 10) {
            setError("Invalid Phone Number"); setLoading(false); return;
        }

        try {
            const guestRef = ref(db, `allowed_guests/${cleanPhone}`);
            const snapshot = await get(guestRef);

            if (!snapshot.exists()) {
                setError("Phone number not registered."); setLoading(false); return;
            }
            if (snapshot.val().email.toLowerCase() !== inputEmail) {
                setError("Email does not match records."); setLoading(false); return;
            }

            finalRole = 'audience';
            userId = `USER-${cleanPhone}`;
            userPhone = cleanPhone;
        } catch (err) {
            console.error(err); setError("Database Error"); setLoading(false); return;
        }
    }

    // JOIN
    try {
        const userRef = push(ref(db, `audience_data/${roomId}`));
        await set(userRef, {
            email: inputEmail, phone: userPhone, role: finalRole, userId, joinedAt: Date.now(),
            restrictions: { isMuted: false, isBidBanned: false, isKicked: false }
        });
        navigate(`/room/${roomId}?dbKey=${userRef.key}`);
    } catch (err) {
        setError("Failed to join."); setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-[#FF6600] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* BACKGROUND DECORATION (Optional) */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        
        {/* --- ANIMATED LOGO --- */}
        {/* layoutId ensures the logo smoothly resizes from Splash to Form position */}
        <motion.div 
            layout 
            className={`flex flex-col items-center transition-all duration-700 ${showSplash ? 'mb-0 scale-125' : 'mb-8 scale-100'}`}
        >
            <motion.img 
                layoutId="logo"
                src="/Dibs Logo.svg" 
                alt="DIBS" 
                className="w-48 drop-shadow-lg"
            />
        </motion.div>

        {/* --- LOGIN FORM (Fades in after splash) --- */}
        <AnimatePresence>
            {!showSplash && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="w-full space-y-6"
                >
                    {/* (Room Name Removed as requested) */}

                    <form onSubmit={handleSmartLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-white/80 uppercase ml-2 tracking-wider">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-white" />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full bg-white/20 border border-white/30 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white focus:outline-none focus:bg-white/30 focus:border-white transition-all placeholder:text-white/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-white/80 uppercase ml-2 tracking-wider">
                                Phone / Password
                            </label>
                            <div className="relative group">
                                <Key className="absolute left-4 top-3.5 w-4 h-4 text-white" />
                                <input 
                                    type="text" 
                                    value={authKey} 
                                    onChange={(e) => setAuthKey(e.target.value)} 
                                    placeholder="9876543210" 
                                    className="w-full bg-white/20 border border-white/30 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white focus:outline-none focus:bg-white/30 focus:border-white transition-all placeholder:text-white/50"
                                />
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="flex items-center gap-2 text-white bg-red-500/20 p-3 rounded-lg border border-red-200/50"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase">{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-[#FF6600] font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 shadow-xl"
                        >
                            {loading ? (
                                <span className="animate-pulse">Loading...</span>
                            ) : (
                                <>
                                    <span>ENTER</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};