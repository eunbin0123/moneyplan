import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './css/theme.css';
import './index.css';

// 라우트별로 따로 번들을 쪼개서, 방문한 라우트의 코드만 내려받도록 한다.
const App = lazy(() => import('./App.tsx'));
const TravelPage = lazy(() => import('./pages/TravelPage.tsx'));

const RouteFallback = () => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--c-bg-soft, #F5F8FC)',
        color: 'var(--c-text-faint, #8C99B8)', fontSize: '0.8125rem',
    }}>
        불러오는 중...
    </div>
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
                <Routes>
                    <Route path="/" element={<App />} />
                    <Route path="/travel" element={<TravelPage />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    </StrictMode>,
);