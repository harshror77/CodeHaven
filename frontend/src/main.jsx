import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import App from './App.jsx';
import Home from './components/Home.jsx';
import Room from './components/Room.jsx';
import CodeEditor from './components/CodeEditor.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Room />} />
        <Route path="/room/:roomId/:userId" element={<CodeEditor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
