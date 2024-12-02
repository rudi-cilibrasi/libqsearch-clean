import './App.css'
import QSearch from "./components/QSearch.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

function App() {
    return (
        <Router>
            <div>
                <Routes>
                    <Route path="/" element={<QSearch />} />
                    <Route path="/error" element={<ErrorPage />} />
                </Routes>
            </div>
        </Router>
    )
}

export default App
