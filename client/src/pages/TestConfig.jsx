import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";

export default function TestConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qs, setQs] = useState(null);
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    API.get(`/mcq/question-sets/${id}`).then(res => setQs(res.data.data)).catch(console.error);
  }, [id]);

  const handleStart = async () => {
    try {
      const res = await API.post("/mcq/attempts", {
        questionSetId: id,
        timerDurationSec: duration * 60,
        totalQuestions: qs.questions.length
      });
      navigate(`/attempt/${res.data.data._id}`);
    } catch(err) {
      console.error(err);
    }
  };

  if (!qs) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-md mx-auto p-8 mt-12 bg-white border rounded shadow-sm">
      <h1 className="text-2xl font-bold mb-4">Configure Test</h1>
      <div className="mb-4">
        <p className="text-gray-600 mb-1">Question Set:</p>
        <p className="font-semibold">{qs.name}</p>
        <p className="text-sm text-gray-500">{qs.questions.length} questions</p>
      </div>
      <div className="mb-6">
        <label className="block text-gray-600 mb-1">Timer Duration (minutes)</label>
        <input 
          type="number" 
          className="w-full border p-2 rounded focus:outline-blue-500" 
          value={duration} 
          onChange={e => setDuration(Number(e.target.value))} 
        />
      </div>
      <button onClick={handleStart} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">Start Test</button>
    </div>
  );
}
