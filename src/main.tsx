import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import TravelPage from './pages/TravelPage.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/travel" element={<TravelPage />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>,
);