import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { QuestionPage } from './pages/QuestionPage'
import { SharePage } from './pages/SharePage'
import { WatchPage } from './pages/WatchPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/demo" element={<QuestionPage demo />} />
        <Route path="/q/:id" element={<QuestionPage />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/s/:questionId" element={<SharePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
