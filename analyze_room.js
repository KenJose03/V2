import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

// 1. Setup Environment
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DB_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// CLI: node analyze_room.js <ROOM_ID> [START_ISO] [END_ISO]
const roomId = process.argv[2];
const manualStart = process.argv[3]; 
const manualEnd = process.argv[4];

if (!roomId) {
    console.error("❌ Please provide a Room ID.");
    process.exit(1);
}

const analyze = async () => {
    console.log(`\n🔍 ANALYZING ROOM: [ ${roomId} ]\n` + "=".repeat(50));

    try {
        // --- 1. LOAD INVENTORY (For Starting Prices) ---
        const inventoryPath = path.join(__dirname, 'src', 'inventory.csv');
        let inventoryMap = new Map(); // Name -> StartingPrice
        
        if (fs.existsSync(inventoryPath)) {
            const csvData = fs.readFileSync(inventoryPath, 'utf8');
            const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
            parsed.data.forEach(item => {
                const price = item['Price'] ? parseInt(item['Price'].replace(/[^0-9]/g, '')) : 0;
                inventoryMap.set(item['Name'], price);
            });
            console.log(`📦 Loaded ${inventoryMap.size} items from Inventory.`);
        } else {
            console.warn(`⚠️ Inventory file not found at ${inventoryPath}. Price ratios will be 0.`);
        }

        // --- 2. FETCH DATA ---
        const [configSnap, metaSnap, audienceSnap, historySnap, analyticsSnap] = await Promise.all([
            get(ref(db, `event_config`)),
            get(ref(db, `rooms/${roomId}/metadata`)),
            get(ref(db, `audience_data/${roomId}`)),
            get(ref(db, `rooms/${roomId}/auctionHistory`)),
            get(ref(db, `analytics/${roomId}`))
        ]);

        // --- 3. DETERMINE WINDOW ---
        let START_TIME, END_TIME;
        if (manualStart && manualEnd) {
            START_TIME = new Date(manualStart).getTime();
            END_TIME = new Date(manualEnd).getTime();
        } else if (metaSnap.exists()) {
            const meta = metaSnap.val();
            START_TIME = meta.startTime;
            END_TIME = meta.endTime;
        } else {
            const config = configSnap.exists() ? configSnap.val() : {};
            START_TIME = config.startTime ? new Date(config.startTime).getTime() : 0;
            END_TIME = config.endTime ? new Date(config.endTime).getTime() : Date.now();
        }

        // --- 4. PROCESSING: AUDIENCE (REAL USERS) ---
        const rawAudience = audienceSnap.exists() ? Object.values(audienceSnap.val()) : [];
        
        // Logic: Filter out Staff/Test -> Deduplicate by Phone Number
        const uniqueUsers = new Map();
        
        rawAudience.forEach(user => {
            // Exclude Staff & Test
            if (user.role === 'host' || user.role === 'moderator') return;
            if (user.userId && user.userId.startsWith('TEST-')) return;
            
            // Deduplicate: Keep the earliest join time for reference
            if (!uniqueUsers.has(user.phone)) {
                uniqueUsers.set(user.phone, user);
            }
        });

        const realUserCount = uniqueUsers.size;

        // --- 5. PROCESSING: BIDS & ENGAGEMENT ---
        const rawEvents = analyticsSnap.exists() ? Object.values(analyticsSnap.val()) : [];
        
        // Filter Bids: Check for BID_PLACED event type and time window
        const validBids = rawEvents.filter(e => 
            (e.eventType === 'BID_PLACED' || e.type === 'BID_PLACED') &&
            e.timestamp >= START_TIME && e.timestamp <= END_TIME &&
            !e.user?.includes("TEST")
        );

        // --- 6. PROCESSING: SALES & UNSOLD ---
        const rawHistory = historySnap.exists() ? Object.values(historySnap.val()) : [];
        const eventHistory = rawHistory.filter(h => h.timestamp >= START_TIME && h.timestamp <= END_TIME);

        const soldItems = eventHistory.filter(h => h.winner && h.winner !== "Nobody");
        const unsoldItems = eventHistory.filter(h => !h.winner || h.winner === "Nobody");
        
        // Metrics
        const totalRevenue = soldItems.reduce((sum, h) => sum + (h.finalPrice || 0), 0);
        const itemsShowcased = eventHistory.length;
        const itemsSold = soldItems.length;
        
        // Price Multipliers (Sold / Starting)
        let totalMultiplier = 0;
        let highestMultiplier = 0;
        let highestMultiplierItem = "N/A";

        soldItems.forEach(item => {
            const startPrice = inventoryMap.get(item.itemName) || 0;
            if (startPrice > 0) {
                const ratio = item.finalPrice / startPrice;
                totalMultiplier += ratio;
                if (ratio > highestMultiplier) {
                    highestMultiplier = ratio;
                    highestMultiplierItem = item.itemName;
                }
            }
        });
        
        const avgMultiplier = itemsSold > 0 ? (totalMultiplier / itemsSold) : 0;

        // --- 7. TOP BIDDERS (Aggregated) ---
        const bidderScores = {}; // User -> TotalAmountPledgedInTop3
        
        eventHistory.forEach(auction => {
            if (auction.topBidders) {
                auction.topBidders.forEach(bid => {
                    const name = bid.user;
                    const amount = parseInt(bid.amount) || 0;
                    if (!bidderScores[name]) bidderScores[name] = 0;
                    bidderScores[name] += amount;
                });
            }
        });

        const topBidders = Object.entries(bidderScores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, total]) => ({ name, total }));


        // --- 8. AVERAGE VIEWER COUNT (Estimate) ---
        // Using total duration of all sessions / event duration
        // Note: This relies on SESSION_START/END logs. If missing, we assume 0.
        let totalSessionTimeMs = 0;
        const sessions = rawEvents.filter(e => e.eventType === 'SESSION_END'); 
        sessions.forEach(s => {
            if (s.duration) totalSessionTimeMs += s.duration;
        });
        
        const eventDurationMinutes = (END_TIME - START_TIME) / 1000 / 60;
        const avgViewers = eventDurationMinutes > 0 
            ? Math.round((totalSessionTimeMs / 1000 / 60) / eventDurationMinutes) 
            : 0;


        // --- 9. GENERATE HTML REPORT ---
        const timeLabels = [];
        const bidCounts = [];
        const joinCounts = [];
        
        // 5-min Buckets
        const bucket = 5 * 60 * 1000;
        for (let t = START_TIME; t <= END_TIME; t += bucket) {
            timeLabels.push(new Date(t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
            
            // Count Bids in bucket
            const b = validBids.filter(e => e.timestamp >= t && e.timestamp < t + bucket).length;
            bidCounts.push(b);
            
            // Count NEW Unique Joins in bucket
            let j = 0;
            uniqueUsers.forEach(u => {
                if (u.joinedAt >= t && u.joinedAt < t + bucket) j++;
            });
            joinCounts.push(j);
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${roomId} Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { background: #0a0a0a; color: #e0e0e0; font-family: sans-serif; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .card { background: #1a1a1a; padding: 20px; border-radius: 8px; border: 1px solid #333; text-align: center; }
        .val { font-size: 28px; font-weight: bold; color: #fff; }
        .lbl { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 5px; }
        .highlight { color: #FF6600; }
        .section { background: #1a1a1a; border: 1px solid #333; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        h2 { font-size: 14px; text-transform: uppercase; color: #888; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;}
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td, th { padding: 8px; text-align: left; border-bottom: 1px solid #333; }
        th { color: #888; }
    </style>
</head>
<body>
    <h1 style="color:#FF6600">${roomId} <span style="color:#fff; font-size:16px">ANALYTICS</span></h1>
    <p style="color:#666; font-size:12px; margin-bottom:30px">
        ${new Date(START_TIME).toLocaleString()} — ${new Date(END_TIME).toLocaleString()}
    </p>

    <div class="grid">
        <div class="card"><div class="lbl">Revenue</div><div class="val highlight">₹${totalRevenue.toLocaleString()}</div></div>
        <div class="card"><div class="lbl">Real Users</div><div class="val">${realUserCount}</div></div>
        <div class="card"><div class="lbl">Items Sold / Showcased</div><div class="val">${itemsSold} / ${itemsShowcased}</div></div>
        <div class="card"><div class="lbl">Avg Viewers (Est)</div><div class="val">${avgViewers}</div></div>
        
        <div class="card"><div class="lbl">Total Bids</div><div class="val">${validBids.length}</div></div>
        <div class="card"><div class="lbl">Avg Price Increase</div><div class="val">${avgMultiplier.toFixed(1)}x</div></div>
        <div class="card"><div class="lbl">Highest Multiplier</div><div class="val">${highestMultiplier.toFixed(1)}x</div></div>
        <div class="card"><div class="lbl">Sales Conversion</div><div class="val">${realUserCount ? Math.round((itemsSold/realUserCount)*100) : 0}%</div></div>
    </div>

    <div class="section">
        <h2>Bid Volume vs New Joins (5 min intervals)</h2>
        <canvas id="mainChart" height="80"></canvas>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="section">
            <h2>🏆 Top 5 Bidders (Total Volume)</h2>
            <table>
                <tr><th>User</th><th>Total Pledged</th></tr>
                ${topBidders.map(b => `<tr><td>${b.name}</td><td class="highlight">₹${b.total.toLocaleString()}</td></tr>`).join('')}
            </table>
        </div>

        <div class="section">
            <h2>🚫 Unsold Items</h2>
            <table>
                <tr><th>Item</th><th>Start Price</th></tr>
                ${unsoldItems.length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:#555">All items sold!</td></tr>' : 
                  unsoldItems.map(i => {
                      const price = inventoryMap.get(i.itemName) || 0;
                      return `<tr><td>${i.itemName}</td><td>₹${price}</td></tr>`;
                  }).join('')
                }
            </table>
        </div>
    </div>

    <script>
        new Chart(document.getElementById('mainChart'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify(timeLabels)},
                datasets: [
                    { label: 'Bids Placed', data: ${JSON.stringify(bidCounts)}, borderColor: '#00ccff', tension: 0.3 },
                    { label: 'New Users', data: ${JSON.stringify(joinCounts)}, borderColor: '#FF6600', borderDash: [5,5], tension: 0.3 }
                ]
            },
            options: { scales: { y: { beginAtZero: true, grid: { color: '#333'} }, x: { grid: { color: '#333'} } } }
        });
    </script>
</body>
</html>
        `;

        fs.writeFileSync(`report_${roomId}.html`, html);
        console.log(`✅ Report saved: report_${roomId}.html`);
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

analyze();