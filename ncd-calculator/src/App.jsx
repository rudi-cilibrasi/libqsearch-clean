import './App.css'
import QSearch from "./components/QSearch.jsx";
import Header from "./components/Header.jsx";

function App() {
    return (
        <>
            <Header/>
            <div className="card">
                <QSearch/>
            </div>
        </>
    )
}

export default App
