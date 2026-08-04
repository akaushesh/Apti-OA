import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { seededShuffle } from "../utils/shuffle";

export default function AttemptScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [qs, setQs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currIdx, setCurrIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeUp, setTimeUp] = useState(false);
  const [untimedMode, setUntimedMode] = useState(false);

  useEffect(() => {
    API.get(`/mcq/attempts/${id}`).then(res => {
      const a = res.data.data;
      setAttempt(a);
      setTimeLeft(a.timerDurationSec);
      
      const savedAns = {};
      a.answers.forEach(ans => savedAns[ans.questionId] = { option: ans.selectedOption, isUntimed: ans.isUntimed || false });
      setAnswers(savedAns);

      API.get(`/mcq/question-sets/${a.questionSetId._id || a.questionSetId}`).then(res2 => {
        const qsData = res2.data.data;
        if (qsData.questions) {
          qsData.questions = seededShuffle(qsData.questions, a._id.toString());
        }
        setQs(qsData);
      });
    }).catch(console.error);
  }, [id]);

  useEffect(() => {
    if(timeLeft > 0 && !timeUp && !untimedMode) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && attempt && !timeUp && !untimedMode) {
      handleTimeUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timeUp, attempt, untimedMode]);

  const handleTimeUp = async () => {
    setTimeUp(true);
    await saveProgress(true);
  };

  const saveProgress = async (isSubmit = false) => {
    if (!qs || !attempt) return;
    
    let score = 0;
    const ansArray = Object.keys(answers).map(qId => {
      const q = qs.questions.find(x => x._id === qId);
      const selected = answers[qId].option;
      if (q && q.correctAnswer === selected) score++;
      return { questionId: qId, selectedOption: selected, isUntimed: answers[qId].isUntimed };
    });

    try {
      await API.patch(`/mcq/attempts/${id}`, {
        answers: ansArray,
        scoreAtTimeUp: !untimedMode ? score : attempt.scoreAtTimeUp,
        finalScoreIfUntimed: score,
        status: isSubmit ? 'completed' : 'in-progress'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOptionSelect = (opt) => {
    const qId = qs.questions[currIdx]._id;
    setAnswers(prev => ({...prev, [qId]: { option: opt, isUntimed: untimedMode }}));
  };

  if (!qs || !attempt) return <div className="p-8 text-center">Loading...</div>;

  const currentQ = qs.questions[currIdx];
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const stats = {
    answered: Object.values(answers).filter(v => v.option).length,
    total: qs.questions.length
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="font-bold text-lg">{qs.name}</h1>
        {!untimedMode ? (
          <div className="text-xl font-mono font-bold text-red-600 bg-red-50 px-4 py-1 rounded">
            {formatTime(timeLeft)}
          </div>
        ) : (
          <div className="text-xl font-bold text-orange-500 bg-orange-50 px-4 py-1 rounded">
            Practice Mode (Untimed)
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-white border-r p-4 overflow-y-auto hidden md:block">
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-500">Questions</h2>
          <div className="grid grid-cols-4 gap-2">
            {qs.questions.map((q, idx) => (
              <button
                key={q._id}
                onClick={() => setCurrIdx(idx)}
                className={`h-10 w-10 flex items-center justify-center rounded border text-sm font-medium
                  ${currIdx === idx ? 'ring-2 ring-blue-500' : ''}
                  ${answers[q._id]?.option ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200'}
                `}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-8 text-sm text-gray-600">
            <p>Answered: {stats.answered} / {stats.total}</p>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto relative">
          {timeUp && !untimedMode ? (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border">
                <h2 className="text-3xl font-bold mb-4 text-red-600">Time's Up!</h2>
                <p className="text-xl mb-2">You answered {stats.answered} out of {stats.total}</p>
                <div className="flex gap-4 mt-8 justify-center">
                  <button onClick={() => navigate('/')} className="bg-gray-800 text-white px-4 py-2 rounded">Go to Dashboard</button>
                  <button onClick={() => setUntimedMode(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Continue Untimed</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded shadow-sm border">
            <div className="mb-6 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-400">Question {currIdx + 1} of {qs.questions.length}</span>
              <button onClick={() => saveProgress(false)} className="text-sm text-blue-600 hover:underline">Save Progress</button>
            </div>
            <h2 className="text-xl font-medium mb-8 leading-relaxed">{currentQ.questionText}</h2>
            <div className="flex flex-col gap-3">
              {['A', 'B', 'C', 'D'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(opt)}
                  className={`text-left p-4 rounded border transition-colors ${
                    answers[currentQ._id]?.option === opt 
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' 
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="font-bold mr-3 text-gray-500">{opt}</span> 
                  {currentQ[`option${opt}`]}
                </button>
              ))}
            </div>
          </div>
          
          <div className="max-w-3xl mx-auto mt-6 flex justify-between">
            <button 
              disabled={currIdx === 0} 
              onClick={() => setCurrIdx(prev => prev - 1)}
              className="px-6 py-2 bg-white border rounded disabled:opacity-50"
            >
              Previous
            </button>
            {currIdx === qs.questions.length - 1 ? (
              <button onClick={async () => { await saveProgress(true); navigate('/'); }} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Submit Test</button>
            ) : (
              <button onClick={() => setCurrIdx(prev => prev + 1)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Next</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
