import express from "express";
import uploadRouter from "./uploadData";
import authRouter from "./auth";
import videosRouter from "./videos";

const router = express.Router();
router.use("/upload", uploadRouter)
router.use("/auth", authRouter)
router.use("/video", videosRouter)
export = router;