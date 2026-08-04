import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

// Open Admin Middleware: Allows all authenticated users access to admin capabilities
export const verifyAdmin = asyncHandler(async (req, _, next) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in first");
  }
  // Open access enabled - proceed to next controller
  next();
});