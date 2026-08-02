import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../app/authslice";
import API from "../api/axios";
import { useState } from "react";
import toast from "react-hot-toast";

export default function Header() {
  const authStatus = useSelector((state) => state.auth.status);
  const user = useSelector((state) => state.auth.userData);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await API.post("/users/logout");
    } catch(e) {
      console.error(e);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("auth");
      dispatch(logout());
      toast.success("Logged out successfully");
      setLoggingOut(false);
      navigate("/");
    }
  };

  if (!authStatus) return null;

  const userDisplayName = user?.fullName || user?.username || "User";
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">
              Apti<span className="text-blue-600">OA</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase leading-tight mt-0.5">
              Practice & Assessment
            </span>
          </div>
        </Link>

        {/* Navigation Actions & User Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              location.pathname === "/"
                ? "bg-blue-50 text-blue-600"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            Dashboard
          </Link>

          <Link
            to="/upload"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-600/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Set
          </Link>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {userInitial}
              </div>
              <span className="hidden md:inline text-sm font-semibold text-slate-700 max-w-[120px] truncate">
                {userDisplayName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
