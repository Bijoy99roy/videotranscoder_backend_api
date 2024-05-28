import express from "express";
import uploadRouter from "./uploadData";

const router = express.Router();
router.use("/upload", uploadRouter)
export = router;