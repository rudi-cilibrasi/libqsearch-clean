import {useCallback, useState} from 'react'
import './App.css'
import QSearch from "./components/QSearch"
import ErrorPage from "./components/ErrorPage"
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import AboutPage from "@/components/AboutPage"
import {LandingPage} from "@/components/LandingPage.tsx";
import {ROUTER_BASENAME} from "@/configs/site";
import {LoginDialog} from "@/components/LoginDialog";
import {RouteAccessibility} from "@/components/RouteAccessibility";

function App() {
    const [openLogin, setOpenLogin] = useState(false)
    const [, setAuthenticated] = useState(false)
    const closeLogin = useCallback((): void => setOpenLogin(false), []);

    return (
        <Router basename={ROUTER_BASENAME}>
            <div id="application-shell">
                <RouteAccessibility />
                <Routes>
                    <Route
                        path="/"
                        element={
                            <LandingPage
                                setOpenLogin={setOpenLogin}
                                setAuthenticated={setAuthenticated}
                            />
                        }
                    />
                    <Route
                        path="/calculator"
                        element={
                            <QSearch
                                setOpenLogin={setOpenLogin}
                                setAuthenticated={setAuthenticated}
                            />
                        }
                    />
                    <Route path="/error" element={<ErrorPage />} />
                    <Route
                        path="/about"
                        element={
                            <AboutPage
                                setOpenLogin={setOpenLogin}
                                setAuthenticated={setAuthenticated}
                            />
                        }
                    />
                </Routes>
            </div>
            <LoginDialog open={openLogin} onClose={closeLogin}/>
        </Router>
    )
}

export default App
