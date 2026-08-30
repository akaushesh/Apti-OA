import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema({
    section: { type: String, default: '' },
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
    defaultDurationMin: { type: Number, default: 15 },
    defaultSectionDurationsMin: { type: Map, of: Number, default: {} },
    questions: [questionSchema]
}, { timestamps: true });

export const QuestionSet = mongoose.model("QuestionSet", questionSetSchema);

const answerSchema = new Schema({
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedOption: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
    isUntimed: { type: Boolean, default: false },
    timeSpentSec: { type: Number, default: 0 },
    answeredAt: { type: Date }
});

const sectionTimerSchema = new Schema({
    section: { type: String, required: true },
    durationSec: { type: Number, required: true },
}, { _id: false });

const attemptSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionSetId: { type: Schema.Types.ObjectId, ref: "QuestionSet", required: true },
    section: { type: String, default: '' },
    mockMode: { type: Boolean, default: false },
    freeNav: { type: Boolean, default: false },  // free navigation: all questions open, section timers run in parallel
    sectionTimers: [sectionTimerSchema],   // per-section durations when mockMode=true
    timerDurationSec: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    answers: [answerSchema],
    scoreAtTimeUp: { type: Number, default: 0 },
    finalScoreIfUntimed: { type: Number, default: 0 },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' }
}, { timestamps: true });

export const Attempt = mongoose.model("Attempt", attemptSchema);
