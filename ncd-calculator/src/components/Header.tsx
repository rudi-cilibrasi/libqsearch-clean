import React from "react";
import { Activity } from 'lucide-react';

const Header = ({ isScrolled, openLogin, setOpenLogin }) => {
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-gray-900/95 backdrop-blur-sm shadow-lg py-2' : 'bg-transparent py-4'
    }`}>
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        <div className="flex items-center">
          <Activity className="h-6 w-6 text-blue-400 mr-2" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
            NCD Calculator
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="#about" className="text-gray-300 hover:text-white transition-colors hidden md:block">
            About Us
          </a>
          <button
            onClick={() => setOpenLogin(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
