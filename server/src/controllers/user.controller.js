import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { QuestionSet, Attempt } from "../models/mcq.model.js";
import { isValidObjectId } from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken};
    } catch (error) {
        console.error("Error during token generation:", error);
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

const Signup = asyncHandler(async (req, res) => {
    const { username, fullName, password, role } = req.body;

    if (!username || !fullName || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
        throw new ApiError(400, "Username already exists");
    }

    const assignedRole = role === "admin" ? "admin" : "user";

    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        password,
        role: assignedRole
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "User creation failed");
    }

    return res.status(201).json(
        new ApiResponse(201, "User created successfully", { createdUser })
    );
});

const Login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        throw new ApiError(400, "Username and password are required");
    }    

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
        throw new ApiError(401, "Invalid username");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);    
    
    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if (!LoggedInUser) {
        throw new ApiError(500, "Failed to fetch logged-in user");
    }
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .status(200)
    .json(
        new ApiResponse(
            200, 
            "Login successful",
            {
                user: LoggedInUser,
                accessToken,
                refreshToken
            },
        )
    );
});

const Logout = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            "Current user fetched successfully", 
            { user: req.user }
        )
    );
});

const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Both old and new passwords are required");
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, "Password changed successfully", user)
  );
});

// Admin Controllers

const getAllUsersWithStats = asyncHandler(async (req, res) => {
    const users = await User.find({}).select("-password -refreshToken").sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
        users.map(async (u) => {
            const setStats = await QuestionSet.countDocuments({ userId: u._id });
            const attemptStats = await Attempt.countDocuments({ userId: u._id });
            const completedAttempts = await Attempt.find({ userId: u._id, status: 'completed' });
            
            let avgScorePercent = 0;
            if (completedAttempts.length > 0) {
                const totalPercent = completedAttempts.reduce((acc, curr) => {
                    return acc + ((curr.scoreAtTimeUp / (curr.totalQuestions || 1)) * 100);
                }, 0);
                avgScorePercent = Math.round(totalPercent / completedAttempts.length);
            }

            return {
                ...u.toObject(),
                setsUploaded: setStats,
                attemptsCount: attemptStats,
                completedAttemptsCount: completedAttempts.length,
                avgScorePercent
            };
        })
    );

    res.status(200).json(new ApiResponse(200, "Fetched all users with stats", usersWithStats));
});

const getUserDetailsByAdmin = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const questionSets = await QuestionSet.find({ userId }).sort({ createdAt: -1 });
    const attempts = await Attempt.find({ userId })
        .populate("questionSetId", "name")
        .sort({ createdAt: -1 });

    const completedAttempts = attempts.filter(a => a.status === 'completed');
    let avgScorePercent = 0;
    if (completedAttempts.length > 0) {
        const totalPercent = completedAttempts.reduce((acc, curr) => {
            return acc + ((curr.scoreAtTimeUp / (curr.totalQuestions || 1)) * 100);
        }, 0);
        avgScorePercent = Math.round(totalPercent / completedAttempts.length);
    }

    res.status(200).json(new ApiResponse(200, "Fetched detailed user record", {
        user,
        questionSets,
        attempts,
        stats: {
            totalSets: questionSets.length,
            totalAttempts: attempts.length,
            completedAttempts: completedAttempts.length,
            avgScorePercent
        }
    }));
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    if (!["user", "admin"].includes(role)) {
        throw new ApiError(400, "Invalid role specified. Must be 'user' or 'admin'");
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true }
    ).select("-password -refreshToken");

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    res.status(200).json(new ApiResponse(200, `User role updated to ${role}`, updatedUser));
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    if (userId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot delete your own admin account");
    }

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
        throw new ApiError(404, "User not found");
    }

    await QuestionSet.deleteMany({ userId });
    await Attempt.deleteMany({ userId });

    res.status(200).json(new ApiResponse(200, "User account and associated data deleted successfully"));
});

const getAdminAnalytics = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments({});
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalQuestionSets = await QuestionSet.countDocuments({});
    const totalAttempts = await Attempt.countDocuments({});
    const completedAttempts = await Attempt.countDocuments({ status: "completed" });
    
    const questionSets = await QuestionSet.find({}).select("questions");
    const totalQuestionsCount = questionSets.reduce((acc, curr) => acc + (curr.questions?.length || 0), 0);

    const completionRatePercent = totalAttempts > 0 
        ? Math.round((completedAttempts / totalAttempts) * 100) 
        : 0;

    res.status(200).json(new ApiResponse(200, "Fetched admin system analytics", {
        totalUsers,
        totalAdmins,
        totalQuestionSets,
        totalQuestionsCount,
        totalAttempts,
        completedAttempts,
        completionRatePercent
    }));
});

export {
    Signup, 
    Login, 
    Logout, 
    getCurrentUser, 
    generateAccessAndRefreshTokens,
    changePassword,
    getAllUsersWithStats,
    getUserDetailsByAdmin,
    updateUserRole,
    deleteUserByAdmin,
    getAdminAnalytics
};
