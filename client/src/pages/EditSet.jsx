import { useEffect, useState } from "react";
import API from "../api/axios";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function EditSet() {
  const { id } = useParams();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    API.get(`/mcq/question-sets/${id}`).then(res => {
      const set = res.data.data;
      setName(set.name);
      
      // We want to format the questions array back into a readable JSON string without the _id fields
      const cleanQuestions = set.questions.map(q => {
        const { _id, ...rest } = q;
        return rest;
      });
      setText(JSON.stringify(cleanQuestions, null, 2));
      setLoading(false);
    }).catch(err => {
      toast.error("Failed to load question set");
      navigate("/");
    });
  }, [id, navigate]);

  const handleUpdate = async () => {
    try {
      const questions = JSON.parse(text);
      if(!name || !Array.isArray(questions) || !questions.length) {
        return toast.error("Name and valid JSON array required");
      }
      
      await API.put(`/mcq/question-sets/${id}`, { name, questions });
      toast.success("Question set updated!");
      navigate("/");
    } catch(err) {
      console.error(err);
      toast.error("Invalid JSON format or error updating");
    }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/mcq/question-sets/${id}`);
      toast.success("Question set deleted");
      navigate("/");
    } catch(e) {
      toast.error(e?.response?.data?.message || "Failed to delete set");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Question Set?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this question set? This action cannot be undone and will delete all associated test attempts.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Question Set</h1>
        <button onClick={() => setShowConfirm(true)} className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 bg-red-50 rounded">
          Delete Set
        </button>
      </div>
      
      <input 
        className="w-full border p-2 mb-4 rounded focus:outline-blue-500 font-medium" 
        placeholder="Set Name" 
        value={name} 
        onChange={e => setName(e.target.value)} 
      />
      
      <div className="mb-2 text-sm text-gray-600 bg-gray-50 p-3 rounded border">
        <p className="font-semibold mb-1">Edit JSON array of questions.</p>
        <p>Ensure the format is perfectly valid JSON.</p>
      </div>
      
      <textarea 
        className="w-full border p-4 mb-4 rounded h-[400px] font-mono text-sm focus:outline-blue-500" 
        value={text} 
        onChange={e => setText(e.target.value)}
      ></textarea>
      
      <div className="flex gap-4">
        <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition-colors">
          Save Changes
        </button>
        <button onClick={() => navigate("/")} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
