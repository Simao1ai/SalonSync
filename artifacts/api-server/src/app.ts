import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

app.set("trust proxy", 1);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please try again later" },
});

// Stripe webhooks need raw body — must come before express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);
app.use("/api/mobile-auth", authLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/anthropic", aiLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);

export default app;
