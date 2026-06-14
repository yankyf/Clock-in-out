import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { entriesRouter } from "./routes/entries.js";
import { syncRouter } from "./routes/sync.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/auth", authRouter);
app.use("/entries", entriesRouter);
app.use("/sync", syncRouter);

// Optionally serve the built web admin from the same origin (so the whole
// platform is reachable on one URL / behind one tunnel). Set WEB_DIST or build
// packages/web. API routes above take precedence; everything else falls back to
// the SPA's index.html.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST ?? path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  console.log(`Serving web admin from ${webDist}`);
}

app.listen(PORT, () => {
  console.log(`clock-in-out server listening on http://localhost:${PORT}`);
});
