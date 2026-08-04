import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema({
    questionText: { type: String, required: true },
    optionA: { type: String, required: true },
    optionB: { type: String, required: true },
    optionC: { type: String, required: true },
    optionD: { type: String, required: true },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
});

const questionSetSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    category: { type: String, default: 'General' },
    questions: [questionSchema]
}, { timestamps: true });

export const QuestionSet = mongoose.model("QuestionSet", questionSetSchema);

const answerSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedOption: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
    isUntimed: { type: Boolean, default: false },
    answeredAt: { type: Date }
});

const attemptSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionSetId: { type: Schema.Types.ObjectId, ref: "QuestionSet", required: true },
    timerDurationSec: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    answers: [answerSchema],
    scoreAtTimeUp: { type: Number, default: 0 },
    finalScoreIfUntimed: { type: Number, default: 0 },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' }
}, { timestamps: true });

export const Attempt = mongoose.model("Attempt", attemptSchema);
