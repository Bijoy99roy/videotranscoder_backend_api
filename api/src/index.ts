import express from "express";
import cors from "cors";
import router from "./routes/rootRouter";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());
app.use("./uploads", express.static("uploads"));

const uploadsDir = 'uploads'
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/api/v1", router);

app.get("/healthcheck", (req, res) => {
    res.json({
        "message": "Live"
    })
})


app.listen(3000, ()=>{
    console.log("Listening to port 3000")
});