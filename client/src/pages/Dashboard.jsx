import { useEffect, useState } from "react";
import API from "../api/axios";
import { Link, useNavigate } from "react-router-dom";
import authService from "../services/Auth";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [sets, setSets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null });
  const navigate = useNavigate();

  const loadData = () => {
    API.get("/mcq/question-sets").then(res => setSets(res.data.data)).catch(console.error);
    API.get("/mcq/attempts").then(res => setAttempts(res.data.data)).catch(console.error);
  };

  useEffect(() => {
    authService.getCurrentUser().then(setCurrentUser).catch(console.error);
    loadData();
  }, []);

  const confirmDelete = async () => {
    const { type, id } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, id: null });
    
    if (type === 'set') {
      try {
        await API.delete(`/mcq/question-sets/${id}`);
        toast.success("Question set deleted");
        loadData();
      } catch(e) {
        toast.error(e?.response?.data?.message || "Failed to delete set");
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmModal.type === 'set' ? 'Delete Question Set?' : 'Delete Attempt History?'}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmModal.type === 'set' 
                ? "Are you sure you want to delete this question set? This action cannot be undone and will delete all associated test attempts."
                : "Are you sure you want to permanently delete this attempt history?"}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: null, id: null })}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <Link to="/upload" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium transition-colors">
          + Upload Set
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-700 border-b pb-2">Available Practice Sets</h2>
          <div className="flex flex-col gap-3">
            {sets.length === 0 && <p className="text-gray-500 italic">No sets uploaded yet.</p>}
            {sets.map(s => (
              <div key={s._id} className="bg-white p-4 border rounded shadow-sm hover:shadow transition-shadow flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{s.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">Added: {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(`/test-config/${s._id}`)} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded font-medium transition-colors">
                    Practice
                  </button>
                  {currentUser && currentUser._id === s.userId && (
                    <button onClick={() => navigate(`/edit-set/${s._id}`)} className="text-sm text-blue-500 hover:text-blue-700 font-medium p-1">
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-700 border-b pb-2">Your History</h2>
          <div className="flex flex-col gap-3">
            {attempts.length === 0 && <p className="text-gray-500 italic">You haven't taken any tests yet.</p>}
            {attempts.map(a => (
              <div key={a._id} className="bg-white p-4 border rounded shadow-sm hover:shadow transition-shadow flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{a.questionSetId?.name || "Unknown Set"}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${a.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {a.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      Score: {a.scoreAtTimeUp}/{a.totalQuestions}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.status === 'completed' ? (
                    <Link to={`/review/${a._id}`} className="text-sm text-blue-600 hover:underline font-medium">Review</Link>
                  ) : (
                    <button onClick={() => navigate(`/attempt/${a._id}`)} className="text-sm text-orange-600 hover:underline font-medium">Resume</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
