import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { 
    createQuestionSet, 
    getQuestionSets, 
    getQuestionSetById,
    startAttempt, 
    updateAttempt, 
    getAttempts, 
    getAttemptById,
    updateQuestionSet,
    deleteQuestionSet,
    deleteAttempt
} from "../controllers/mcq.controller.js";

const router = Router();
router.use(verifyJWT); // Protect all MCQ routes

router.route("/question-sets")
    .post(createQuestionSet)
    .get(getQuestionSets);

router.route("/question-sets/:id")
    .get(getQuestionSetById)
    .put(updateQuestionSet)
    .delete(deleteQuestionSet);

router.route("/attempts")
    .post(startAttempt)
    .get(getAttempts);

router.route("/attempts/:id")
    .patch(updateAttempt)
    .get(getAttemptById)
    .delete(deleteAttempt);

export default router;
