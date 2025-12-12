// This file runs on the Vercel server, not the browser.
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

export default function handler(req, res) {
  // 1. Get Secrets from Environment Variables
  const appID = process.env.VITE_AGORA_APP_ID; 
  const appCertificate = process.env.AGORA_APP_CERTIFICATE; // NEW SECRET

  // 2. Get Channel Name (Default to 'CHIC')
  //const channelName = req.query.channelName || 'CHIC';
  const channelName = 'CHIC';

  
  // 3. User Settings
  const uid = 0; // 0 allows Agora to assign an ID, or pass a specific one if needed
  const role = RtcRole.PUBLISHER; // Host and Audience both need permissions to join
  const expirationTimeInSeconds = 3600; // 1 Hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  if (!appID || !appCertificate) {
    return res.status(500).json({ error: 'Agora credentials missing' });
  }

  try {
    // 4. Generate Token
    const token = RtcTokenBuilder.buildTokenWithUid(
      appID,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Token generation failed', details: error.message });
  }
}