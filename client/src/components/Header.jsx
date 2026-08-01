import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../app/authslice";
import API from "../api/axios";

export default function Header() {
  const authStatus = useSelector((state) => state.auth.status);
  const user = useSelector((state) => state.auth.userData);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await API.post("/users/logout");
    } catch(e) {
      console.error(e);
    }
    localStorage.removeItem("accessToken");
    dispatch(logout());
    navigate("/");
  };

  if (!authStatus) return null;

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-blue-600">MCQ Practice</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">{user?.fullName || user?.username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600">Logout</button>
        </div>
      </div>
    </header>
  );
}
