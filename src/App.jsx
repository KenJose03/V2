import React from 'react';
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import WelcomePage from './components/WelcomePage';
import { LiveRoom } from './components/LiveRoom';
import { LoginPage } from './components/LoginPage';

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
        {/* Step 1: Landing */}
        <Route path="/" element={<WelcomePage />} />
        
        {/* Step 2: Login / Validation */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Step 3: The Room */}
        <Route path="/room/:roomId" element={<RoomWrapper />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;