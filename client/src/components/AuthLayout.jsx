import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

// Spinner Component
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 space-y-4">
    <div className="flex space-x-3">
      <div className="h-4 w-4 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-4 w-4 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-4 w-4 bg-purple-500 rounded-full animate-bounce"></div>
    </div>
    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading page...</p>
  </div>
);

// Route guard: requires user to be logged in
export const Protected = ({ children, authentication = true }) => {
  const navigate = useNavigate();
  const authStatus = useSelector((state) => state.auth.status);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    if (authStatus !== authentication) {
      navigate("/");
    }
    setLoader(false);
  }, [authentication, authStatus, navigate]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};

// Route guard: Open access for all authenticated users
export const Secured = ({ children }) => {
  const navigate = useNavigate();
  const authStatus = useSelector((state) => state.auth.status);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    if (!authStatus) {
      navigate("/");
    }
    setLoader(false);
  }, [authStatus, navigate]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};