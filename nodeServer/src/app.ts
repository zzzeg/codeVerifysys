import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import routes from "./routes";
import { respondError } from "./middlewares/auth";

const app = express();

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

app.use("/api", routes);

app.get("/", (_req, res) => {
  res.json({ message: "verifySys API", timestamp: Date.now() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  return respondError(res, err.message || "服务器内部错误", 500);
});

export default app;

