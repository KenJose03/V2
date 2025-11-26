import React from 'react';
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import WelcomePage from './components/WelcomePage';
import { LiveRoom } from './components/LiveRoom';

// Wrapper to handle the Room logic
const RoomWrapper = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('role') === 'host';
  
  return <LiveRoom roomId={roomId} isHost={isHost} />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route 1: The Landing Page (Coins + Login) */}
        <Route path="/" element={<WelcomePage />} />
        
        {/* Route 2: The Video Room */}
        <Route path="/room/:roomId" element={<RoomWrapper />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;