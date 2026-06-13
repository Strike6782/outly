import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import corsOptions from "./utils/corsOptions";
import { authMiddleware } from "./middlewares/authMiddleware";

/* ROUTE IMPORT */
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import senderRoutes from "./routes/senderRoutes";
import campaignRoutes from "./routes/campaignRoutes";
import emailRoutes from "./routes/emailRoutes";
import attachmentRoutes from "./routes/attachmentRoutes";
import templateRoutes from "./routes/templateRoutes";
import sequenceRoutes from "./routes/sequenceRoutes";
import trackingRoutes from "./routes/trackingRoutes";
import trackingMetricsRoutes from "./routes/trackingMetricsRoutes";
import healthRoutes from "./routes/healthRoutes";

/* CONFIGURATIONS */
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors(corsOptions));

/* ROUTES */
app.use(healthRoutes);
app.get("/", (req, res) => {
  res.send("This is the home route");
});
app.use("/track", trackingRoutes); // Public — no auth (email clients load these)
app.use("/auth", authRoutes);
app.use("/users", authMiddleware, userRoutes);
app.use("/senders", authMiddleware, senderRoutes);
app.use("/campaigns", authMiddleware, campaignRoutes);
app.use("/emails", authMiddleware, emailRoutes);
app.use("/attachments", authMiddleware, attachmentRoutes);
app.use("/templates", authMiddleware, templateRoutes);
app.use("/campaigns/:id/sequence", authMiddleware, sequenceRoutes);
app.use("/api/tracking", authMiddleware, trackingMetricsRoutes);

/* SERVER */
const port = Number(process.env.PORT) || 8000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
