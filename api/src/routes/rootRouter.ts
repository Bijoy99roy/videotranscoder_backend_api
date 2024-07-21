import express from "express";
import uploadRouter from "./uploadData";
import authRouter from "./auth";
import videosRouter from "./videos";
import channelRouter from "./channel";

const router = express.Router();
router.use("/upload", uploadRouter)
router.use("/auth", authRouter)
router.use("/video", videosRouter)
router.use("/channels", channelRouter)
export = router;