import express from "express";
import cors from "cors";
import connectdb from "./db/connection.js";

const app = express();
app.use(cors());
app.use(express.json());

app.listen(process.env.PORT, () => {
  connectdb();
  console.log("Server is running on http://localhost:3000");
});
