import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { QuestionSet, Attempt } from "../models/mcq.model.js";

export const createQuestionSet = asyncHandler(async (req, res) => {
    const { name, category, questions } = req.body;
    if (!name || !questions || !questions.length) {
        throw new ApiError(400, "Name and questions are required");
    }

    const questionSet = await QuestionSet.create({
        userId: req.user._id,
        name,
        category: category || 'General',
        questions
    });

    res.status(201).json(new ApiResponse(201, "Question set created successfully", questionSet));
});

export const getQuestionSets = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.category) {
        filter.category = req.query.category;
    }
    const questionSets = await QuestionSet.find(filter).select("-questions");
    res.status(200).json(new ApiResponse(200, "Fetched question sets", questionSets));
});

export const getQuestionSetById = asyncHandler(async (req, res) => {
    const questionSet = await QuestionSet.findById(req.params.id);
    if (!questionSet) throw new ApiError(404, "Question set not found");
    res.status(200).json(new ApiResponse(200, "Fetched question set", questionSet));
});

export const startAttempt = asyncHandler(async (req, res) => {
    const { questionSetId, section, mockMode, sectionTimers, timerDurationSec, totalQuestions } = req.body;

    const attempt = await Attempt.create({
        userId: req.user._id,
        questionSetId,
        section: section || '',
        mockMode: !!mockMode,
        sectionTimers: sectionTimers || [],
        timerDurationSec,
        totalQuestions,
        answers: [],
        status: 'in-progress'
    });

    res.status(201).json(new ApiResponse(201, "Attempt started", attempt));
});

export const updateAttempt = asyncHandler(async (req, res) => {
    const { answers, scoreAtTimeUp, finalScoreIfUntimed, status } = req.body;

    const attempt = await Attempt.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { answers, scoreAtTimeUp, finalScoreIfUntimed, status },
        { new: true }
    );

    if (!attempt) throw new ApiError(404, "Attempt not found");

    res.status(200).json(new ApiResponse(200, "Attempt updated", attempt));
});

export const updateQuestionSet = asyncHandler(async (req, res) => {
    const { name, category, questions } = req.body;
    const questionSet = await QuestionSet.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { name, category, questions },
        { new: true }
    );
    if (!questionSet) throw new ApiError(404, "Question set not found or you do not have permission");
    res.status(200).json(new ApiResponse(200, "Question set updated", questionSet));
});

export const deleteQuestionSet = asyncHandler(async (req, res) => {
    const questionSet = await QuestionSet.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!questionSet) throw new ApiError(404, "Question set not found or you don't have permission to delete it");
    
    // optionally delete all attempts for this set
    await Attempt.deleteMany({ questionSetId: req.params.id });

    res.status(200).json(new ApiResponse(200, "Question set deleted"));
});

export const deleteAttempt = asyncHandler(async (req, res) => {
    const attempt = await Attempt.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!attempt) throw new ApiError(404, "Attempt not found");
    res.status(200).json(new ApiResponse(200, "Attempt deleted"));
});

export const getAttempts = asyncHandler(async (req, res) => {
    const attempts = await Attempt.find({ userId: req.user._id })
        .populate("questionSetId", "name category")
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, "Fetched attempts", attempts));
});

export const getAttemptById = asyncHandler(async (req, res) => {
    const attempt = await Attempt.findOne({ _id: req.params.id, userId: req.user._id })
        .populate("questionSetId");
    if (!attempt) throw new ApiError(404, "Attempt not found");
    res.status(200).json(new ApiResponse(200, "Fetched attempt", attempt));
});
