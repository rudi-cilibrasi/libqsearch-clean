import React from 'react'
import './App.css'
import QSearch from "./components/QSearch.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AboutPage from "@/components/AboutPage.tsx";

function App() {
    return (
        <Router>
            <div>
                <Routes>
                    <Route path="/" element={<QSearch />} />
                    <Route path="/error" element={<ErrorPage />} />
                    <Route path="/about" element={<AboutPage />} />
                </Routes>
            </div>
        </Router>
    )
}

export default App
