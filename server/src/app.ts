import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(helmet());
// Allow slightly larger JSON bodies for base64 image payloads
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// All API routes go under /api
app.use("/api", routes);

export default app;
