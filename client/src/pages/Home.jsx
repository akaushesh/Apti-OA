import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Dashboard from "./Dashboard";
import API from "../api/axios";
import { login } from "../app/authslice";
import toast from "react-hot-toast";

export default function Home() {
  const authStatus = useSelector((state) => state.auth.status);
  const dispatch = useDispatch();
  
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim() || !password.trim() || (!isLogin && !fullName.trim())) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await API.post("/users/login", { username: username.trim(), password });
        const { accessToken, user } = res.data.data;
        localStorage.setItem("accessToken", accessToken);
        dispatch(login({ user, accessToken }));
        toast.success(`Welcome back, ${user.fullName || user.username}!`);
      } else {
        await API.post("/users/register", { 
          username: username.trim().toLowerCase(), 
          fullName: fullName.trim(), 
          password 
        });
        toast.success("Account created successfully! Please log in.");
        setIsLogin(true);
        setPassword("");
      }
    } catch(err) {
      const msg = err.response?.data?.message || err.message || "An unexpected error occurred.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authStatus) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
      
      {/* Background Decorative Glow Circles */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Apti<span className="text-blue-600">OA</span> Portal
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {isLogin ? "Sign in to access your practice tests" : "Create an account to get started"}
          </p>
        </div>

        {/* Form Mode Toggle Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrorMsg(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrorMsg(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              !isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
            <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="e.g. johndoe" 
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-900 p-3 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. John Doe" 
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-900 p-3 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                required 
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-900 p-3 pr-10 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 014.122-.963c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold p-3 rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isLogin ? "Sign In to Account" : "Create Account"}</span>
            )}
          </button>
        </form>

        {/* Footer Toggle Text */}
        <p className="mt-6 text-center text-xs font-semibold text-slate-500">
          {isLogin ? "New to Apti-OA?" : "Already registered?"}{" "}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); }} 
            className="text-blue-600 font-bold hover:underline ml-1"
          >
            {isLogin ? "Create an account" : "Sign in here"}
          </button>
        </p>

      </div>
    </div>
  );
}