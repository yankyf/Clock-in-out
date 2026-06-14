import express from "express";
import cors from "cors";
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

app.listen(PORT, () => {
  console.log(`clock-in-out server listening on http://localhost:${PORT}`);
});
