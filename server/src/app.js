import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();


const allowedOrigins = [
  "http://localhost:5173",
  "https://apti-oa.vercel.app",
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [])
].map(origin => origin.trim().replace(/\/$/, ""));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman), matched origins, or wildcard
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("❌ Not allowed by CORS"));
      }
    },
    credentials: true
  })
);


app.use(express.json({limit:"1mb"}))
app.use(express.urlencoded({extended:true,limit:"1mb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.get("/api/ping", (req, res) => {
  console.log("✅ /ping route hit");
  res.send("pong");
});

//routes import
import userRouter from "./routes/user.routes.js"
import mcqRouter from "./routes/mcq.routes.js"


//routes decalaration
app.use("/api/users", userRouter)
app.use("/api/mcq", mcqRouter)


export { app }