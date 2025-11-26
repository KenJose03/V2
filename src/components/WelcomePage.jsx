import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Video, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- 1. ANIMATION COMPONENT (Your Original Coin Logic) ---
const CoinStackLoader = ({ onComplete }) => {
  const [coinCount, setCoinCount] = useState(0);
  const [phase, setPhase] = useState('stacking');
  const totalCoins = 5;

  useEffect(() => {
    if (phase === 'stacking') {
        const interval = setInterval(() => {
            setCoinCount(prev => {
                if (prev >= totalCoins) {
                    clearInterval(interval);
                    setPhase('hammer');
                    return prev;
                }
                return prev + 1;
            });
        }, 200);
        return () => clearInterval(interval);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'hammer') {
        const timer = setTimeout(() => { setPhase('impact'); }, 400); 
        return () => clearTimeout(timer);
    }
    if (phase === 'impact') {
        const timer = setTimeout(() => { onComplete(); }, 1500);
        return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-dibs-black text-white">
       <motion.div
         className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-4 absolute top-24"
         animate={{ opacity: phase === 'impact' ? 0 : [0.4, 1, 0.4] }}
       >
         LOADING
       </motion.div>

       <div className="relative h-64 w-full flex items-end justify-center mt-10">
         {/* Coins */}
         <AnimatePresence>
           {phase !== 'impact' && Array.from({ length: coinCount }).map((_, i) => (
               <motion.div
               key={i}
               initial={{ y: -100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }}
               className="absolute w-48 h-12 bg-white"
               style={{ 
                   bottom: i * 14, 
                   zIndex: i,
                   clipPath: 'polygon(10% 0, 90% 0, 100% 20%, 100% 80%, 90% 100%, 10% 100%, 0 80%, 0 20%)'
               }} 
               >
                   <div className="absolute top-[2px] left-[2px] right-[2px] bottom-[2px] border-t border-l border-neutral-300 opacity-50"></div>
                   <div className="absolute bottom-0 w-full h-[4px] bg-neutral-400/50"></div>
               </motion.div>
           ))}
         </AnimatePresence>

         {/* Hammer */}
         <AnimatePresence>
           {phase === 'hammer' && (
               <motion.div
                   className="absolute -right-4 bottom-0 origin-bottom z-50"
                   initial={{ rotate: 25, opacity: 0, scale: 0.9 }}
                   animate={{ rotate: -64, opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 1.1 }}
                   transition={{ duration: 0.4, ease: "backIn" }}
               >
                   <div className="relative w-64 h-60">
                       <div className="absolute left-1/2 bottom-0 w-4 h-60 bg-neutral-800 -translate-x-1/2 border-2 border-white/20"></div>
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 bg-white origin-bottom">
                           <div className="absolute inset-0 border-8 border-neutral-800"></div>
                       </div>
                   </div>
               </motion.div>
           )}
         </AnimatePresence>

         {/* Impact */}
         {phase === 'impact' && (
           <motion.div
               initial={{ scale: 0, rotate: -10 }}
               animate={{ scale: 1, rotate: 0 }}
               transition={{ type: "spring", stiffness: 400, damping: 15 }}
               className="absolute inset-0 flex items-center justify-center z-50"
           >
               <h1 className="font-display font-black text-7xl text-white tracking-tighter mix-blend-difference bg-black px-4 py-2">DIBS</h1>
           </motion.div>
         )}
       </div>
    </div>
  );
};

// --- 2. LOGIN SCREEN (The Aesthetic Input) ---
const LoginScreen = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");

  const handleStart = (role) => {
    if(!roomName) return;
    navigate(`/room/${roomName}?role=${role}`);
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
      className="flex flex-col items-center justify-center w-full h-full px-6 z-20 relative bg-black text-white"
    >
        <div className="flex-1 flex flex-col items-center justify-center w-full relative px-6 space-y-8">
            <h1 className="text-6xl font-display font-black leading-[0.8] tracking-tighter text-white select-none mix-blend-difference">
            DIBS
            </h1>
            <p className="text-[10px] md:text-xs font-bold tracking-[0.8em] text-neutral-500 uppercase font-mono">
            THRIFT DIFFERENT
            </p>

            <input
                type="text"
                placeholder="ENTER ROOM NAME"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value.toUpperCase())}
                className="w-full max-w-xs bg-neutral-900 border-b border-neutral-800 text-white font-mono text-center py-4 focus:outline-none focus:border-white transition-colors uppercase placeholder:text-neutral-700"
            />

            <div className="flex gap-4 w-full max-w-xs">
                <button onClick={() => handleStart('host')} className="flex-1 py-4 border border-neutral-800 hover:bg-white hover:text-black transition-colors flex flex-col items-center gap-2 group">
                    <Video className="w-4 h-4" />
                    <span className="font-mono text-[10px] tracking-widest uppercase">Host</span>
                </button>
                <button onClick={() => handleStart('audience')} className="flex-1 py-4 border border-neutral-800 hover:bg-white hover:text-black transition-colors flex flex-col items-center gap-2 group">
                    <Eye className="w-4 h-4" />
                    <span className="font-mono text-[10px] tracking-widest uppercase">Watch</span>
                </button>
            </div>
        </div>
    </motion.div>
  );
};

// --- 3. MAIN EXPORT ---
const WelcomePage = () => {
  const [currentScreen, setCurrentScreen] = useState('splash');

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === 'splash' && (
          <CoinStackLoader key="splash" onComplete={() => setCurrentScreen('login')} />
        )}
        {currentScreen === 'login' && (
          <LoginScreen key="login" />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomePage;