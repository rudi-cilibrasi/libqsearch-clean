import React, { useEffect, useState } from "react";
import axios from "axios";
import { Activity } from 'lucide-react';
import { BACKEND_BASE_URL } from "../configs/api";
import { getLoginUser } from "../functions/user.ts";

interface HeaderProps {
  openLogin: boolean;
  setOpenLogin: (open: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  isScrolled?: boolean;
}

interface LogoutResponse {
  data: {
    user: string | null;
  };
}

const Header: React.FC<HeaderProps> = ({
                                         openLogin,
                                         setOpenLogin,
                                         setAuthenticated,
                                         isScrolled = false,
                                       }) => {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Store the current URL before redirecting to login
  const storeCurrentUrl = () => {
    // Don't store login pages or error pages
    if (
      !window.location.pathname.includes('login') &&
      !window.location.pathname.includes('error')
    ) {
      sessionStorage.setItem('redirectUrl', window.location.pathname + window.location.search);
    }
  };
  
  const openModal = (): void => {
    storeCurrentUrl(); // Store current URL before opening the login modal
    setOpenLogin(true);
  };
  
  const closeModal = (): void => {
    setOpenLogin(false);
  };
  
  const handleGoogleLogin = async (): Promise<void> => {
    try {
      storeCurrentUrl(); // Store current URL before redirecting
      window.location.href = `${BACKEND_BASE_URL}/auth/google`;
    } catch (error) {
      console.error("Google login failed", error);
      setError("Failed to connect to Google login service");
    }
  };
  
  const handleGithubLogin = async (): Promise<void> => {
    try {
      storeCurrentUrl(); // Store current URL before redirecting
      window.location.href = `${BACKEND_BASE_URL}/auth/github`;
    } catch (error) {
      console.error("Github login failed", error);
      setError("Failed to connect to GitHub login service");
    }
  };
  
  const fetchUserData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const authUserName = await getLoginUser();
      setUserName(authUserName);
      
      // Check if setAuthenticated is a function before calling it
      if (typeof setAuthenticated === 'function') {
        setAuthenticated(!!authUserName);
      } else {
        console.warn("setAuthenticated is not a function", setAuthenticated);
      }
      
      // Check for redirect URL after successful login
      const redirectUrl = sessionStorage.getItem('redirectUrl');
      if (authUserName && redirectUrl && window.location.pathname !== redirectUrl) {
        // Clear the stored URL to prevent unwanted redirects
        sessionStorage.removeItem('redirectUrl');
        // Redirect to the previous page
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserName(null);
      setError("Failed to fetch user information");
      
      // Still try to call setAuthenticated if it's a function
      if (typeof setAuthenticated === 'function') {
        setAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Enhanced useEffect that handles navigation and error cases
  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const authUserName = await getLoginUser();
        
        if (mounted) {
          setUserName(authUserName);
          
          // Check if setAuthenticated is a function before calling it
          if (typeof setAuthenticated === 'function') {
            setAuthenticated(!!authUserName);
          } else {
            console.warn("setAuthenticated is not a function", setAuthenticated);
          }
          
          // Check if we need to redirect after login
          const redirectUrl = sessionStorage.getItem('redirectUrl');
          if (authUserName && redirectUrl && window.location.pathname !== redirectUrl) {
            // Only redirect if we're on a login-related page
            if (window.location.pathname.includes('/auth/') ||
              window.location.pathname === '/login' ||
              window.location.pathname === '/') {
              sessionStorage.removeItem('redirectUrl');
              window.location.href = redirectUrl;
            }
          }
        }
      } catch (error) {
        if (mounted) {
          console.error("Error in auth flow:", error);
          setUserName(null);
          setError("Authentication error");
          
          // Still try to call setAuthenticated if it's a function
          if (typeof setAuthenticated === 'function') {
            setAuthenticated(false);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    // Check URL parameters for errors or success messages
    const checkAuthStatus = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authError = urlParams.get('authError');
      const authSuccess = urlParams.get('authSuccess');
      
      if (authError) {
        setError(decodeURIComponent(authError));
      } else if (authSuccess) {
        // If auth was successful, fetch user data
        fetchData();
      } else {
        // Normal page load, just fetch user data
        fetchData();
      }
    };
    
    checkAuthStatus();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  const handleLogout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await axios.get<LogoutResponse["data"]>(
        `${BACKEND_BASE_URL}/auth/logout`,
        { withCredentials: true }
      );
      
      const returnedUser = res.data.user;
      setUserName(returnedUser);
      
      // Check if setAuthenticated is a function before calling it
      if (typeof setAuthenticated === 'function') {
        setAuthenticated(!!returnedUser);
      } else {
        console.warn("setAuthenticated is not a function", setAuthenticated);
      }
      
      // Redirect to home page after logout
      window.location.href = '/';
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to log out");
    } finally {
      setIsLoading(false);
    }
  };
  
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
          <a href="/about" className="text-gray-300 hover:text-white transition-colors hidden md:block">
            About Us
          </a>
          
          {isLoading ? (
            // Loading state
            <div className="px-5 py-2 bg-gray-700 rounded-lg text-gray-300">
              <span className="animate-pulse">Loading...</span>
            </div>
          ) : !userName ? (
            // Not logged in state
            <button
              onClick={openModal}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              Login
            </button>
          ) : (
            // Logged in state
            <div className="flex items-center space-x-4">
              <span className="text-white hidden md:inline-flex items-center">
                <span className="bg-blue-500/20 px-3 py-1 rounded-full text-blue-300">
                  {userName}
                </span>
              </span>
              <button
                className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Error notification if needed */}
      {error && (
        <div className="fixed top-20 right-4 bg-red-500/90 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Login Modal with error handling */}
      {openLogin && (
        <div
          className="fixed z-50 inset-0 flex justify-center items-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-gray-800 p-8 rounded-lg w-80 border border-gray-700 shadow-xl"
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
          >
            <h2 className="text-center text-xl font-semibold mb-6 text-white">
              Login to Continue
            </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-500/30 border border-red-500/50 rounded text-white text-sm">
                {error}
              </div>
            )}
            <div className="flex flex-col items-center space-y-4">
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg w-full transition-colors flex items-center justify-center"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                  />
                </svg>
                Login with Google
              </button>
              <button
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg w-full transition-colors flex items-center justify-center"
                onClick={handleGithubLogin}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  />
                </svg>
                Login with Github
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
