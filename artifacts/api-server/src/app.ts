import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "fs";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Domaines autorisés en CORS : domaine Replit + localhost dev
const allowedOrigins: (string | RegExp)[] = [
  /^https:\/\/[a-z0-9\-]+\.replit\.app$/,
  /^https:\/\/[a-z0-9\-]+\.repl\.co$/,
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Serve landing page static files (built from artifacts/status) at root
const STATIC_DIR = path.join(process.cwd(), "artifacts/status/dist/public");
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get("/*path", (_req: Request, res: Response) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
}

export default app;
