import 'dotenv/config'; 

import express from "express";
import cors from "cors";

import submissionRoutes from "./routes/submissionRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", submissionRoutes);
app.use("/api", ingestionRoutes);
app.use("/api", caseRoutes);

app.listen(4000, () => console.log("Backend running on http://localhost:4000"));
