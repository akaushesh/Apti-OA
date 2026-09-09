import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { QuestionSet, Attempt } from "../models/mcq.model.js";

export const createQuestionSet = asyncHandler(async (req, res) => {
    const { name, category, defaultDurationMin, defaultSectionDurationsMin, questions } = req.body;
    if (!name || !questions || !questions.length) {
        throw new ApiError(400, "Name and questions are required");
    }

    const questionSet = await QuestionSet.create({
        userId: req.user._id,
        name,
        category: category || 'General',
        defaultDurationMin: defaultDurationMin || 15,
        defaultSectionDurationsMin: defaultSectionDurationsMin || {},
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
    const { 
        questionSetId, 
        section, 
        mockMode, 
        freeNav, 
        sectionTimers, 
        timerDurationSec, 
        totalQuestions,
        userOS,
        userBrowser 
    } = req.body;

    const initialSectionTimersLeft = {};
    if (Array.isArray(sectionTimers)) {
        sectionTimers.forEach(t => {
            if (t.section && t.durationSec !== undefined) {
                initialSectionTimersLeft[t.section] = t.durationSec;
            }
        });
    }

    const attempt = await Attempt.create({
        userId: req.user._id,
        questionSetId,
        section: section || '',
        mockMode: !!mockMode,
        freeNav: !!freeNav,
        sectionTimers: sectionTimers || [],
        timerDurationSec,
        timeLeftSec: timerDurationSec,
        sectionTimersLeft: initialSectionTimersLeft,
        totalQuestions,
        answers: [],
        status: 'in-progress',
        currentSection: section || (sectionTimers?.[0]?.section || ''),
        currentQuestionIndex: 0,
        userOS: userOS || '',
        userBrowser: userBrowser || '',
        lastActiveAt: new Date()
    });

    res.status(201).json(new ApiResponse(201, "Attempt started", attempt));
});

export const updateAttempt = asyncHandler(async (req, res) => {
    const existing = await Attempt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) throw new ApiError(404, "Attempt not found");

    if (existing.status === 'completed' || existing.status === 'suspended' || existing.suspendReason) {
        // ponytail: protect completed/suspended status from being reverted by ongoing browser heartbeats
        return res.status(200).json(new ApiResponse(200, "Test is already completed or suspended", existing));
    }

    const { 
        answers, 
        scoreAtTimeUp, 
        finalScoreIfUntimed, 
        status,
        currentSection,
        currentQuestionIndex,
        timeLeftSec,
        sectionTimersLeft,
        userOS,
        userBrowser
    } = req.body;

    const updateFields = { lastActiveAt: new Date() };
    if (answers !== undefined) updateFields.answers = answers;
    if (scoreAtTimeUp !== undefined) updateFields.scoreAtTimeUp = scoreAtTimeUp;
    if (finalScoreIfUntimed !== undefined) updateFields.finalScoreIfUntimed = finalScoreIfUntimed;
    if (status !== undefined) updateFields.status = status;
    if (currentSection !== undefined) updateFields.currentSection = currentSection;
    if (currentQuestionIndex !== undefined) updateFields.currentQuestionIndex = currentQuestionIndex;
    if (timeLeftSec !== undefined) updateFields.timeLeftSec = timeLeftSec;
    if (sectionTimersLeft !== undefined) updateFields.sectionTimersLeft = sectionTimersLeft;
    if (userOS !== undefined) updateFields.userOS = userOS;
    if (userBrowser !== undefined) updateFields.userBrowser = userBrowser;

    const attempt = await Attempt.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true }
    );

    res.status(200).json(new ApiResponse(200, "Attempt updated", attempt));
});

export const updateQuestionSet = asyncHandler(async (req, res) => {
    const { name, category, defaultDurationMin, defaultSectionDurationsMin, questions } = req.body;
    const filter = req.user?.role === 'admin' 
        ? { _id: req.params.id } 
        : { _id: req.params.id, userId: req.user._id };

    const questionSet = await QuestionSet.findOne(filter);
    if (!questionSet) throw new ApiError(404, "Question set not found or you do not have permission");

    if (name !== undefined) questionSet.name = name;
    if (category !== undefined) questionSet.category = category;
    if (defaultDurationMin !== undefined) questionSet.defaultDurationMin = defaultDurationMin;
    if (defaultSectionDurationsMin !== undefined) questionSet.defaultSectionDurationsMin = defaultSectionDurationsMin;

    if (Array.isArray(questions)) {
        // ponytail: preserve existing subdocument _ids when patching questions so attempt answers and time spent aren't reset
        const existingQuestions = questionSet.questions || [];
        const usedExistingIndices = new Set();
        const matchedQuestions = new Array(questions.length);

        // 1. Explicit _id match
        questions.forEach((q, i) => {
            if (q._id) {
                const qIdStr = q._id.toString();
                const foundIdx = existingQuestions.findIndex(
                    (eq, idx) => !usedExistingIndices.has(idx) && eq._id.toString() === qIdStr
                );
                if (foundIdx !== -1) {
                    matchedQuestions[i] = { ...q, _id: existingQuestions[foundIdx]._id };
                    usedExistingIndices.add(foundIdx);
                }
            }
        });

        // 2. Exact questionText + section match
        questions.forEach((q, i) => {
            if (!matchedQuestions[i] && q.questionText) {
                const qText = q.questionText.trim();
                const qSec = (q.section || '').trim();
                const foundIdx = existingQuestions.findIndex(
                    (eq, idx) => !usedExistingIndices.has(idx) &&
                        eq.questionText?.trim() === qText &&
                        (eq.section || '').trim() === qSec
                );
                if (foundIdx !== -1) {
                    matchedQuestions[i] = { ...q, _id: existingQuestions[foundIdx]._id };
                    usedExistingIndices.add(foundIdx);
                }
            }
        });

        // 3. Exact questionText match (ignoring section)
        questions.forEach((q, i) => {
            if (!matchedQuestions[i] && q.questionText) {
                const qText = q.questionText.trim();
                const foundIdx = existingQuestions.findIndex(
                    (eq, idx) => !usedExistingIndices.has(idx) &&
                        eq.questionText?.trim() === qText
                );
                if (foundIdx !== -1) {
                    matchedQuestions[i] = { ...q, _id: existingQuestions[foundIdx]._id };
                    usedExistingIndices.add(foundIdx);
                }
            }
        });

        // 4. Positional match (same index)
        questions.forEach((q, i) => {
            if (!matchedQuestions[i] && i < existingQuestions.length && !usedExistingIndices.has(i)) {
                matchedQuestions[i] = { ...q, _id: existingQuestions[i]._id };
                usedExistingIndices.add(i);
            }
        });

        // 5. Remaining questions: reuse any remaining unused existing _id if count matches, else new
        questions.forEach((q, i) => {
            if (!matchedQuestions[i]) {
                const firstUnusedIdx = existingQuestions.findIndex((_, idx) => !usedExistingIndices.has(idx));
                if (firstUnusedIdx !== -1 && questions.length === existingQuestions.length) {
                    matchedQuestions[i] = { ...q, _id: existingQuestions[firstUnusedIdx]._id };
                    usedExistingIndices.add(firstUnusedIdx);
                } else {
                    const { _id, ...rest } = q;
                    matchedQuestions[i] = rest;
                }
            }
        });

        questionSet.questions = matchedQuestions;
    }

    await questionSet.save();

    // Recalculate scores and heal answers for all attempts on this questionSet
    await reevaluateAttemptsForSet(questionSet);

    res.status(200).json(new ApiResponse(200, "Question set updated", questionSet));
});

export function isAnswerCorrect(selectedOption, correctAnswer) {
    if (!correctAnswer) return false;
    const ca = correctAnswer.toUpperCase().trim();
    if (ca === 'ALL' || ca === 'BONUS' || ca === '*') return true;
    if (!selectedOption) return false;
    const sel = selectedOption.toUpperCase().trim();
    if (ca.includes(',')) {
        return ca.split(',').map(s => s.trim()).includes(sel);
    }
    return ca.includes(sel);
}

export async function reevaluateAttemptsForSet(questionSet) {
    const attempts = await Attempt.find({ questionSetId: questionSet._id });
    let updatedCount = 0;

    if (!attempts.length) {
        return { totalAttempts: 0, updatedCount: 0 };
    }

    const qMap = new Map();
    (questionSet.questions || []).forEach((q, idx) => {
        qMap.set(q._id.toString(), { correctAnswer: q.correctAnswer, section: q.section, idx });
    });

    for (const attempt of attempts) {
        let modified = false;
        let scoreAtTimeUp = 0;
        let finalScoreIfUntimed = 0;

        if (attempt.answers && attempt.answers.length > 0) {
            attempt.answers.forEach((ans, aIdx) => {
                const ansQId = ans.questionId ? ans.questionId.toString() : null;
                let qInfo = ansQId ? qMap.get(ansQId) : null;

                // Heal orphaned questionIds if decoupled
                if (!qInfo && questionSet.questions[aIdx]) {
                    ans.questionId = questionSet.questions[aIdx]._id;
                    qInfo = qMap.get(ans.questionId.toString());
                    modified = true;
                }

                if (qInfo && isAnswerCorrect(ans.selectedOption, qInfo.correctAnswer)) {
                    finalScoreIfUntimed++;
                    if (!ans.isUntimed) {
                        scoreAtTimeUp++;
                    }
                }
            });

            if (attempt.scoreAtTimeUp !== scoreAtTimeUp) {
                attempt.scoreAtTimeUp = scoreAtTimeUp;
                modified = true;
            }
            if (attempt.finalScoreIfUntimed !== finalScoreIfUntimed) {
                attempt.finalScoreIfUntimed = finalScoreIfUntimed;
                modified = true;
            }
        }

        const expectedTotal = attempt.mockMode || !attempt.section
            ? questionSet.questions.length
            : questionSet.questions.filter(q => q.section === attempt.section).length;

        if (expectedTotal > 0 && attempt.totalQuestions !== expectedTotal) {
            attempt.totalQuestions = expectedTotal;
            modified = true;
        }

        if (modified) {
            await attempt.save();
            updatedCount++;
        }
    }

    return { totalAttempts: attempts.length, updatedCount };
}

export const reevaluateQuestionSet = asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin' 
        ? { _id: req.params.id } 
        : { _id: req.params.id, userId: req.user._id };

    const questionSet = await QuestionSet.findById(req.params.id);
    if (!questionSet) throw new ApiError(404, "Question set not found");

    if (req.user.role !== 'admin' && questionSet.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to re-evaluate this question set");
    }

    const result = await reevaluateAttemptsForSet(questionSet);
    res.status(200).json(new ApiResponse(200, `Re-evaluated ${result.totalAttempts} attempts (${result.updatedCount} scores updated)`, result));
});

export const deleteQuestionSet = asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin' 
        ? { _id: req.params.id } 
        : { _id: req.params.id, userId: req.user._id };
    const questionSet = await QuestionSet.findOneAndDelete(filter);
    if (!questionSet) throw new ApiError(404, "Question set not found or you don't have permission to delete it");
    
    // optionally delete all attempts for this set
    await Attempt.deleteMany({ questionSetId: req.params.id });

    res.status(200).json(new ApiResponse(200, "Question set deleted"));
});

export const deleteAttempt = asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin' 
        ? { _id: req.params.id } 
        : { _id: req.params.id, userId: req.user._id };
    const attempt = await Attempt.findOneAndDelete(filter);
    if (!attempt) throw new ApiError(404, "Attempt not found");
    res.status(200).json(new ApiResponse(200, "Attempt deleted"));
});

export const getAttempts = asyncHandler(async (req, res) => {
    const isAdminQuery = req.user?.role === 'admin' && (req.query.all === 'true' || req.query.admin === 'true');
    const filter = isAdminQuery ? {} : { userId: req.user._id };

    if (req.query.status) {
        filter.status = req.query.status;
    }

    const attempts = await Attempt.find(filter)
        .populate("questionSetId", "name category defaultDurationMin defaultSectionDurationsMin")
        .populate("userId", "username fullName role")
        .sort({ updatedAt: -1 });

    res.status(200).json(new ApiResponse(200, "Fetched attempts", attempts));
});

export const getAttemptById = asyncHandler(async (req, res) => {
    const filter = req.user?.role === 'admin' 
        ? { _id: req.params.id } 
        : { _id: req.params.id, userId: req.user._id };
    const attempt = await Attempt.findOne(filter)
        .populate("questionSetId");
    if (!attempt) throw new ApiError(404, "Attempt not found");

    // Heal orphaned questionIds if questions were modified prior to patching logic
    if (attempt.questionSetId?.questions?.length && attempt.answers?.length) {
        const qSet = attempt.questionSetId;
        const qIds = new Set(qSet.questions.map(q => q._id.toString()));
        let needsSave = false;

        attempt.answers.forEach((ans, idx) => {
            if (ans.questionId && !qIds.has(ans.questionId.toString()) && qSet.questions[idx]) {
                ans.questionId = qSet.questions[idx]._id;
                needsSave = true;
            }
        });

        if (needsSave) {
            await attempt.save();
        }
    }

    res.status(200).json(new ApiResponse(200, "Fetched attempt", attempt));
});

export const suspendAttempt = asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
        throw new ApiError(403, "Only administrators can suspend tests");
    }
    const { reason } = req.body;
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) throw new ApiError(404, "Attempt not found");

    // Mark attempt finished and completed so it is removed from live monitor
    attempt.status = 'completed';
    attempt.suspendedAt = new Date();
    attempt.suspendReason = reason || "Suspended by exam administrator";
    await attempt.save();

    res.status(200).json(new ApiResponse(200, "Attempt suspended and marked completed", attempt));
});

export const resumeAttempt = asyncHandler(async (req, res) => {
    if (req.user?.role !== 'admin') {
        throw new ApiError(403, "Only administrators can resume tests");
    }
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) throw new ApiError(404, "Attempt not found");

    attempt.status = 'in-progress';
    attempt.suspendedAt = undefined;
    attempt.suspendReason = '';
    attempt.lastActiveAt = new Date();
    await attempt.save();

    res.status(200).json(new ApiResponse(200, "Attempt resumed successfully", attempt));
});

