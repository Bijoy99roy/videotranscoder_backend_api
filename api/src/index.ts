import express from "express";
import cors from "cors";
import router from "./routes/rootRouter";
import path from "path";
import fs from "fs";

import { Server } from 'ws';
import { handleWebSocket } from './sockets/wsHandler';

import passport from 'passport';
import cookieSession from 'cookie-session';
import session from 'express-session';

const app = express();
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true       
}));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
  }));

// app.use(cookieSession({
//     name: 'session',
//     keys: ['key1', 'key2']
//   }));
  
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.static("./uploads"));

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



const server = app.listen(3000, ()=>{
    console.log("Listening to port 3000")
});

const wss = new Server({ server });
wss.on('connection', handleWebSocket);