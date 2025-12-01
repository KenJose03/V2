import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronUp, ChevronDown, Clock, Play, Square, Eye } from 'lucide-react'; // Added Eye
import { ref, push, onValue, runTransaction, update, set, onDisconnect, remove } from 'firebase/database'; // Added onDisconnect, remove
import { db } from '../lib/firebase';

export const InteractionLayer = ({ roomId, isHost }) => {
  // UI State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentBid, setCurrentBid] = useState(0);
  const [customBid, setCustomBid] = useState(10);
  const [viewerCount, setViewerCount] = useState(0); // NEW: Viewer Count State
  
  // Auction State
  const [isAuctionActive, setIsAuctionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); 
  const [endTime, setEndTime] = useState(0);

  const chatEndRef = useRef(null);
  
  // --- REFS (These fix the "Stale State" / Wrong Price Bug) ---
  const isAuctionActiveRef = useRef(false);
  const currentBidRef = useRef(0); 

  // --- 1. SYNC WITH FIREBASE ---
  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const bidRef = ref(db, `rooms/${roomId}/bid`);
    const auctionRef = ref(db, `rooms/${roomId}/auction`);
    const viewersRef = ref(db, `rooms/${roomId}/viewers`); // NEW: Reference for viewers

    const unsubChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setMessages(Object.values(data).slice(-50));
    });

    const unsubAuction = onValue(auctionRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setIsAuctionActive(data.isActive);
            isAuctionActiveRef.current = data.isActive; // Keep Ref in sync
            setEndTime(data.endTime || 0);
        }
    });

    const unsubBid = onValue(bidRef, (snapshot) => {
      const price = snapshot.val() || 0;
      
      // Update UI
      setCurrentBid(price);
      // Update Ref (So the timer sees the new price)
      currentBidRef.current = price;
      
      // Auto-update viewer selector
      setCustomBid((prev) => {
          const minNextBid = price + 10;
          if (!isAuctionActiveRef.current) return minNextBid;
          return prev < minNextBid ? minNextBid : prev;
      });
    });

    // NEW: Listen for changes in viewer count
    const unsubViewers = onValue(viewersRef, (snapshot) => {
        setViewerCount(snapshot.size); // Firebase .size returns the count efficiently
    });

    return () => { unsubChat(); unsubBid(); unsubAuction(); unsubViewers(); };
  }, [roomId]);

  // --- 2. PRESENCE SYSTEM (NEW: Tracks Audience) ---
  useEffect(() => {
      // If I am a viewer (not host), register my presence
      if (!isHost) {
          const userId = Math.random().toString(36).substring(2, 15);
          const myPresenceRef = ref(db, `rooms/${roomId}/viewers/${userId}`);

          // 1. Add myself to the list
          set(myPresenceRef, true);

          // 2. Auto-remove if I disconnect (close tab/internet loss)
          onDisconnect(myPresenceRef).remove();

          // 3. Remove if I navigate away locally
          return () => {
              remove(myPresenceRef);
          };
      }
  }, [roomId, isHost]);

  // --- 3. COUNTDOWN TIMER ---
  useEffect(() => {
      if (!isAuctionActive || !endTime) {
          setTimeLeft(30);
          return;
      }

      const interval = setInterval(() => {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
          setTimeLeft(remaining);

          // If time hits 0, stop it automatically
          if (remaining === 0 && isHost) {
              stopAuction();
          }
      }, 100);

      return () => clearInterval(interval);
  }, [isAuctionActive, endTime, isHost]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // --- 4. ACTIONS & CONTROLS ---
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    push(ref(db, `rooms/${roomId}/chat`), {
      user: isHost ? "HOST" : "User",
      text: input,
      isHost,
      type: 'msg'
    });
    setInput("");
  };

  // Host Editing Start Price
  const handlePriceChange = (e) => {
      if (isAuctionActive) return; 
      const valStr = e.target.value;
      
      // Allow empty string so backspace works
      if (valStr === '') {
          set(ref(db, `rooms/${roomId}/bid`), 0);
      } else {
          const val = parseInt(valStr);
          if (!isNaN(val)) {
              set(ref(db, `rooms/${roomId}/bid`), val);
          }
      }
  };

  // Manual Step Buttons
  const manualStep = (amount) => {
      if (isAuctionActive) return;
      set(ref(db, `rooms/${roomId}/bid`), Math.max(0, currentBid + amount));
  };

  // Viewer Bidding Logic
  const handleIncrease = () => setCustomBid(prev => prev + 10);
  const handleDecrease = () => {
      if (customBid > currentBid + 10) setCustomBid(prev => prev - 10);
  };

  const placeBid = () => {
    if (!isAuctionActive) return; 
    const bidRef = ref(db, `rooms/${roomId}/bid`);
    
    runTransaction(bidRef, (current) => {
      const safeCurrent = current || 0;
      return customBid > safeCurrent ? customBid : undefined;
    });

    push(ref(db, `rooms/${roomId}/chat`), {
        text: `New Bid: ₹${customBid}`,
        type: 'bid'
    });
  };

  // --- 5. AUCTION MANAGEMENT ---
  const startAuction = () => {
      const DURATION_SECONDS = 30;
      const newEndTime = Date.now() + (DURATION_SECONDS * 1000);

      update(ref(db, `rooms/${roomId}`), {
          "auction/isActive": true,
          "auction/endTime": newEndTime
      });

      push(ref(db, `rooms/${roomId}/chat`), {
        text: `🚨 AUCTION STARTED AT ₹${currentBid}!`,
        type: 'bid'
      });
  };

  const stopAuction = () => {
      // Fix: Send "SOLD" message FIRST using the Ref
      const finalPrice = currentBidRef.current;

      if (isAuctionActiveRef.current) { 
        push(ref(db, `rooms/${roomId}/chat`), {
            text: `🛑 SOLD FOR ₹${finalPrice}`,
            type: 'bid'
        });
      }

      // THEN kill the auction state
      update(ref(db, `rooms/${roomId}`), {
          "auction/isActive": false,
          "auction/endTime": 0
      });
  };

  const toggleAuction = () => {
      if (isAuctionActive) stopAuction();
      else startAuction();
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end pb-20 px-4 pointer-events-none overflow-hidden">
      
  {/* --- TOP LEFT: LOGO TAG --- */}
      <div className="absolute top-6 left-2.5 pointer-events-auto flex flex-col gap-2 items-start">
          <img src="/Dibs. (1).svg" alt="DIBS!" className="w-20 drop-shadow-md -ml-1" />
      </div>
      {/* --- TOP RIGHT: PRICE & STATS --- */}
      <div className="absolute top-24 right-4 pointer-events-auto flex flex-col items-end gap-2">
          
          {/* NEW: Viewer Count Badge */}
          <div className="bg-white/10 backdrop-blur rounded-full px-3 py-1 flex items-center gap-2 shadow-sm">
              <Eye className="w-3 h-3 text-[#ff6500] animate-pulse" />
              <span className="text-xs font-mono font-bold text-white tabular-nums">{viewerCount}</span>
          </div>

          <div className={`
              backdrop-blur-md rounded-2xl p-1.5 flex flex-col items-end shadow-xl min-w-fit px-3 transition-colors relative
              ${isAuctionActive ? 'bg-white/30' : 'bg-white/20'}
          `}>
              <span className="text-[9px] text-white font-mono uppercase tracking-wider mb-0.5 px-1">
                  {isAuctionActive ? "Current Bid" : "Starting Price"}
              </span>

              <div className="flex items-center justify-end gap-1 w-full">
                  {/* Host Manual Arrows */}
                  {isHost && !isAuctionActive && (
                      <div className="flex flex-col gap-0.5 mr-2">
                          <button onClick={() => manualStep(10)} className="text-white hover:text-white/70 active:scale-90 bg-white/20 rounded p-0.5">
                              <ChevronUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => manualStep(-10)} className="text-white hover:text-white/70 active:scale-90 bg-white/20 rounded p-0.5">
                              <ChevronDown className="w-3 h-3" />
                          </button>
                      </div>
                  )}

                  <div className="flex items-center justify-end gap-1 flex-1">
                      <span className="text-3xl font-bold text-[#ff6500]">₹</span>
                      
                      {isHost ? (
                          <input 
                            type="number"
                            value={currentBid === 0 ? '' : currentBid}
                            onChange={handlePriceChange}
                            disabled={isAuctionActive}
                            step="10"
                            placeholder="0"
                            // NEW: Dynamic width based on character length
                            style={{ width: `${Math.max(2, (currentBid?.toString() || "").length + 1)}ch` }}
                            className="bg-transparent text-right font-display font-black text-4xl outline-none p-0 m-0 placeholder:text-white/50 text-white"
                          />
                      ) : (
                          <span className="text-4xl font-display font-black text-white tabular-nums tracking-tighter">
                              {currentBid}
                          </span>
                      )}
                  </div>
              </div>
          </div>

          {/* Timer */}
          {isAuctionActive && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold
                    ${timeLeft <= 10 ? 'bg-white text-[#FF6600] animate-pulse' : 'bg-white/30 text-white border border-white'}
                `}
              >
                  <Clock className="w-3 h-3" />
                  <span>00:{timeLeft.toString().padStart(2, '0')}</span>
              </motion.div>
          )}
      </div>

      {/* --- CHAT STREAM --- */}
       <div 
          className="w-full max-w-[180px] h-40 mb-0 overflow-y-auto mask-chat pointer-events-auto pr-2 flex flex-col justify-end"
          // NEW: Gradient mask to fade out older messages at the top
          style={{ 
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)'
          }}
      >
          
          <div className="flex flex-col gap-1 pb-1">
            <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`w-full rounded-2xl px-3 py-1.5 text-[9px] backdrop-blur-md shadow-sm ${
                        msg.type === 'bid' 
                        ? 'bg-[#FF6600]/20 text-white' 
                        : 'bg-white/10 text-white/90'
                    }`}
                >
                    <span className={`font-bold text-[10px] block mb-0.5 ${msg.type === 'bid' ? 'text-white' : 'text-[#FF6600]'}`}>
                        {msg.type === 'bid' ? '🔔 UPDATE' : msg.user}
                    </span>
                    {/* Added 'truncate block' to keep bubbles small and fixed height */}
                    <span className="opacity-90 font-medium truncate block">{msg.text}</span>
                </motion.div>
                ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="w-full flex flex-col gap-4 pointer-events-auto pb-6">
        
        {/* 1. Say Something Input (Stacked Above) */}
        <form onSubmit={sendMessage} className="w-[175px]">
            <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something"
                className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-1 text-sm text-white focus:outline-none focus:bg-black/60 transition-all font-regular placeholder:text-white/40"
            />
            {/* Hidden submit button to allow Enter key */}
            <button type="submit" className="hidden" />
        </form>

        {/* 2. Bid Controls (Stacked Below) */}
        {!isHost && (
            <div className={`flex items-center justify-center gap-3 transition-opacity ${isAuctionActive ? 'opacity-100' : 'opacity-100 pointer-events-none'}`}>
                <button
                    onClick={handleDecrease}
                    disabled={customBid <= currentBid + 10}
                    className={`w-10 h-10 rounded-full bg-[#ff6500] text-white flex items-center justify-center font-bold text-xl shadow-lg active:scale-95 transition-all ${customBid <= currentBid + 10 ? 'cursor-not-allowed' : 'hover:bg-[#ff6500]/90'}`}
                >
                    –
                </button>

                <button
                    onClick={placeBid}
                    className="w-48 bg-[#ff6500] rounded-full py-2 text-center shadow-lg active:scale-95 transition-all hover:bg-[#ff6500]/90"
                >
                    <span className="text-white font-extrabold text-2xl tracking-tight">₹ {customBid}</span>
                </button>

                <button
                    onClick={handleIncrease}
                    className={`w-10 h-10 rounded-full bg-[#ff6500] text-white flex items-center justify-center font-bold text-xl shadow-lg active:scale-95 transition-all ${customBid <= currentBid + 10 ? 'cursor-not-allowed' : 'hover:bg-[#ff6500]/90'}`}
                >
                    +
                </button>
            </div>
        )}

        {/* Host Controls (If Host) */}
        {isHost && (
            <button 
                onClick={toggleAuction}
                className={`
                    w-full py-4 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg
                    ${isAuctionActive 
                        ? 'bg-white text-[#FF6600] animate-pulse' 
                        : 'bg-[#FF6600] text-white'}
                `}
            >
                {isAuctionActive ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                {isAuctionActive ? "STOP AUCTION" : "START AUCTION"}
            </button>
        )}
      </div>

    </div>
  );
};