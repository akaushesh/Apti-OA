import { useState } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function BulkUpload() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const navigate = useNavigate();

  const handleUpload = async () => {
    try {
      const questions = JSON.parse(text);
      if(!name || !Array.isArray(questions) || !questions.length) {
        return toast.error("Name and valid JSON array required");
      }
      
      await API.post("/mcq/question-sets", { name, questions });
      toast.success("Question set uploaded!");
      navigate("/");
    } catch(err) {
      console.error(err);
      toast.error("Invalid JSON format or error uploading");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Bulk Upload Question Set</h1>
      <input 
        className="w-full border p-2 mb-4 rounded focus:outline-blue-500" 
        placeholder="Set Name" 
        value={name} 
        onChange={e => setName(e.target.value)} 
      />
      <div className="mb-2 text-sm text-gray-600 bg-gray-50 p-3 rounded border">
        <p className="font-semibold mb-1">Paste JSON array of questions.</p>
        <p>Format:</p>
        <pre className="mt-1 bg-gray-200 p-2 rounded text-xs overflow-x-auto">
{`[
  {
    "questionText": "What is 2+2?",
    "optionA": "3", "optionB": "4", "optionC": "5", "optionD": "6",
    "correctAnswer": "B"
  }
]`}
        </pre>
      </div>
      <textarea 
        className="w-full border p-2 mb-4 rounded h-64 font-mono text-sm focus:outline-blue-500" 
        value={text} 
        onChange={e => setText(e.target.value)}
        placeholder='[ { "questionText": "...", "optionA": "...", ... } ]'
      ></textarea>
      <button onClick={handleUpload} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">Upload</button>
    </div>
  );
}
