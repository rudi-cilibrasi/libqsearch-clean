import { useState } from 'react'
import './App.css'
import QSearch from "./components/QSearch"
import ErrorPage from "./components/ErrorPage"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import AboutPage from "@/components/AboutPage"
import {LandingPage} from "@/components/LandingPage.tsx";

function App() {
    const [openLogin, setOpenLogin] = useState(false)
    const [authenticated, setAuthenticated] = useState(false)

    return (
        <Router>
            <div>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <LandingPage
                                openLogin={openLogin}
                                setOpenLogin={setOpenLogin}
                                setAuthenticated={setAuthenticated}
                            />
                        }
                    />
                    <Route
                        path="/calculator"
                        element={
                            <QSearch
                                openLogin={openLogin}
                                setOpenLogin={setOpenLogin}
                                authenticated={authenticated}
                                setAuthenticated={setAuthenticated}
                            />
                        }
                    />
                    <Route path="/error" element={<ErrorPage />} />
                    <Route path="/about" element={<AboutPage />} />
                </Routes>
            </div>
        </Router>
    )
}

export default App
