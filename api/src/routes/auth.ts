import express from "express";
import { PrismaClient, User } from '@prisma/client'
import passport from "passport";
import "../auth/googleAuth";
const prisma = new PrismaClient()

const authRouter = express.Router();

authRouter.get("/google", passport.authenticate("google", {
    scope: ["profile", "email"]
}), (req, res)=>{
    console.log("Login")
});

authRouter.get("/google/callback", passport.authenticate("google", {failureRedirect: "http://localhost:5173/"}),(req, res) => {
    console.log("Logged IN")
    res.redirect("http://localhost:5173/")
})

authRouter.get('/current_user', (req, res) => {
    // console.log(req.user)
    res.send(req.user);
  });

authRouter.get("/user_data", async (req, res) => {
    if (!req.user) {
        return res.status(401).json({error: "Unauthorized"})
    }
    // console.log(req.user)
    const userDate = await prisma.user.findFirst({
        where: {
            googleId: (req.user as User).googleId
        }
    });

    res.json(userDate);
});

authRouter.get("/logout", (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.json({ message: 'Logout successful' });
      });

})

export = authRouter;