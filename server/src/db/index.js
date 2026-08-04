import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { User } from "../models/user.model.js";

const getDefaultUserCredentials = () => ({
    username: process.env.DEFAULT_USERNAME || "admin",
    password: process.env.DEFAULT_PASSWORD || "admin123",
    fullName: process.env.DEFAULT_FULL_NAME || "System Admin"
});

const seedDefaultUser = async () => {
    try {
        const defaultUser = getDefaultUserCredentials();
        const existingUser = await User.findOne({ username: defaultUser.username.toLowerCase() });

        if (existingUser) {
            console.log(`ℹ️ Default user already exists: ${defaultUser.username}`);
            return;
        }

        await User.create({
            username: defaultUser.username.toLowerCase(),
            fullName: defaultUser.fullName,
            password: defaultUser.password
        });

        console.log(`✅ Default login created. Username: ${defaultUser.username}, Password: ${defaultUser.password}`);
    } catch (error) {
        console.error("Failed to seed default user:", error);
    }
};

const connectDB = async () => {
    try {
        const db_address = process.env.MONGO_URI.endsWith("/")
            ? `${process.env.MONGO_URI}${DB_NAME}`
            : `${process.env.MONGO_URI}/${DB_NAME}`; 
        const connectionInstance = await mongoose.connect(db_address)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        await seedDefaultUser();
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export { connectDB, seedDefaultUser, getDefaultUserCredentials };
export default connectDB