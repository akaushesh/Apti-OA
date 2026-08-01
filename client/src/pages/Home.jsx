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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await API.post("/users/login", { username, password });
        localStorage.setItem("accessToken", res.data.data.accessToken);
        dispatch(login(res.data.data.user));
        toast.success("Logged in successfully!");
      } else {
        await API.post("/users/register", { username, fullName, password });
        toast.success("Registered! Please login.");
        setIsLogin(true);
      }
    } catch(err) {
      toast.error(err.response?.data?.message || "Error");
    }
  };

  if (authStatus) {
    return <Dashboard />;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded shadow border">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{isLogin ? "Login" : "Sign Up"}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Username" 
            className="border p-2 rounded w-full focus:outline-blue-500"
            value={username} onChange={e => setUsername(e.target.value)} required 
          />
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Full Name" 
              className="border p-2 rounded w-full focus:outline-blue-500"
              value={fullName} onChange={e => setFullName(e.target.value)} required 
            />
          )}
          <input 
            type="password" 
            placeholder="Password" 
            className="border p-2 rounded w-full focus:outline-blue-500"
            value={password} onChange={e => setPassword(e.target.value)} required 
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded font-medium hover:bg-blue-700">
            {isLogin ? "Login" : "Register"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-medium hover:underline">
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}