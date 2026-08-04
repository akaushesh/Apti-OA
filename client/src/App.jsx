import { useDispatch } from "react-redux";
import Header from "./components/Header.jsx";
import { useEffect, useState } from "react";
import authService from "./services/Auth.js";
import Loader from "./components/Loader.jsx";
import { login, logout } from "./app/authslice";
import { setRole } from "./app/roleslice";
import { Outlet, useLocation } from "react-router-dom";
import API from "./api/axios.js";
import { Toaster } from "react-hot-toast";

function App() {
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const dispatch = useDispatch();
  const location = useLocation();
  const hideHeader = location.pathname.startsWith("/attempt");

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      authService
        .getCurrentUser()
        .then((userData) => {
          if (userData) {
            dispatch(login(userData));
            if (userData.role) {
              dispatch(setRole(userData.role));
            }
          } else {
            dispatch(logout());
            localStorage.removeItem("accessToken");
          }
        })
        .catch(() => {
          dispatch(logout());
          localStorage.removeItem("accessToken");
        })
        .finally(() => setLoading(false));
    } else {
      dispatch(logout());
      setLoading(false);
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 3500,
          style: {
            background: darkMode ? '#1e293b' : '#0f172a',
            color: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {!hideHeader && <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
      <main className="flex-1 flex flex-col">
        {loading ? <Loader text="Loading Apti-OA..." /> : <Outlet context={{ darkMode, toggleDarkMode }} />}
      </main>
    </div>
  );
}

export default App;