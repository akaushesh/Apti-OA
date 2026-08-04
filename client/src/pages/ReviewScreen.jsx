import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { seededShuffle } from "../utils/shuffle";
import toast from "react-hot-toast";

export default function ReviewScreen() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    API.get(`/mcq/attempts/${id}`).then(res => {
      const a = res.data.data;
      if (a.questionSetId && a.questionSetId.questions) {
        a.questionSetId.questions = seededShuffle(a.questionSetId.questions, a._id.toString());
      }
      setAttempt(a);
    }).catch(console.error);
  }, [id]);

  const handleDelete = async () => {
    try {
      await API.delete(`/mcq/attempts/${id}`);
      toast.success("Attempt deleted");
      navigate("/");
    } catch(e) {
      toast.error("Failed to delete attempt");
    }
  };

  if (!attempt) return <div className="p-8 text-center">Loading...</div>;

  const qs = attempt.questionSetId;
  
  const ansMap = {};
  attempt.answers.forEach(a => {
    ansMap[a.questionId] = { option: a.selectedOption, isUntimed: a.isUntimed };
  });

  let countCorrect = 0;
  let countIncorrect = 0;
  let countSkipped = 0;
  let countUntimed = 0;

  const processedQuestions = qs.questions?.map((q) => {
    const ans = ansMap[q._id] || {};
    const selected = ans.option;
    const isCorrect = selected === q.correctAnswer;
    const isSkipped = !selected;
    const isUntimed = ans.isUntimed;

    if (isSkipped) countSkipped++;
    else if (isCorrect) countCorrect++;
    else countIncorrect++;

    if (isUntimed && !isSkipped) countUntimed++;

    return { ...q, selected, isCorrect, isSkipped, isUntimed };
  }) || [];

  const filteredQuestions = processedQuestions.filter(q => {
    if (filter === "all") return true;
    if (filter === "correct") return q.isCorrect && !q.isSkipped;
    if (filter === "incorrect") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    if (filter === "untimed") return q.isUntimed && !q.isSkipped;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Attempt History?</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to permanently delete this attempt history?</p>
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

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Review Attempt</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowConfirm(true)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete Attempt</button>
          <Link to="/" className="text-blue-600 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded shadow-sm border mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-semibold text-xl text-gray-800">{qs.name}</h2>
          <p className="text-gray-500 text-sm mb-3">Attempted: {new Date(attempt.createdAt).toLocaleString()}</p>
          <div className="flex gap-4 text-sm font-medium">
            <span className="text-green-600">Correct: {countCorrect}</span>
            <span className="text-red-600">Incorrect: {countIncorrect}</span>
            <span className="text-gray-500">Skipped: {countSkipped}</span>
            {countUntimed > 0 && <span className="text-orange-500">Untimed: {countUntimed}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600">{attempt.scoreAtTimeUp} <span className="text-xl text-gray-400">/ {attempt.totalQuestions}</span></p>
          <p className="text-sm text-gray-500 font-medium">Timed Score</p>
          {attempt.finalScoreIfUntimed > attempt.scoreAtTimeUp && (
            <p className="text-sm text-orange-500 mt-1 font-medium">Untimed Score: {attempt.finalScoreIfUntimed}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'correct', 'incorrect', 'skipped', 'untimed'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors
              ${filter === f ? 'bg-blue-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'}
            `}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {filteredQuestions.map((q, idx) => {
          // Find original index
          const originalIdx = qs.questions.findIndex(orig => orig._id === q._id);

          return (
            <div key={q._id} className="bg-white p-6 border rounded shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-medium text-lg leading-relaxed text-gray-800">
                  <span className="text-gray-400 mr-2">{originalIdx + 1}.</span> 
                  {q.questionText}
                </h3>
                <div className="ml-4 shrink-0 flex gap-2">
                  {!q.isSkipped && q.isUntimed && (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700 rounded-full">Untimed</span>
                  )}
                  {q.isSkipped ? (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 rounded-full">Skipped</span>
                  ) : q.isCorrect ? (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 rounded-full">Correct</span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">Incorrect</span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const isSelectedOpt = q.selected === opt;
                  const isCorrectOpt = q.correctAnswer === opt;
                  
                  let optStyle = "border-gray-200 text-gray-600 bg-gray-50";
                  if (isCorrectOpt) optStyle = "bg-green-50 border-green-400 font-medium text-green-900 ring-1 ring-green-400";
                  else if (isSelectedOpt && !isCorrectOpt) optStyle = "bg-red-50 border-red-300 font-medium text-red-900";

                  return (
                    <div key={opt} className={`p-4 border rounded transition-colors ${optStyle}`}>
                      <span className="font-bold mr-3 opacity-50">{opt}</span> {q[`option${opt}`]}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredQuestions.length === 0 && (
          <div className="text-center p-8 bg-white border rounded text-gray-500">
            No questions match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
