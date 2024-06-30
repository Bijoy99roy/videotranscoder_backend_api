import passport, { use } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Prisma, PrismaClient, User } from '@prisma/client'
require('dotenv').config()
const prisma = new PrismaClient()

interface Users extends User{}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_ID ?? "",
    callbackURL: "http://localhost:3000/api/v1/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    try{
        console.log(profile)
        let user = await prisma.user.findFirst({
            where: {
                googleId: profile.id
            }
        });
        
        if(!user){
            user = await prisma.user.create({
                data: {
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails ? profile.emails[0].value : "",
                    photo: profile.photos ? profile.photos[0].value : ""
                }
            });
            await prisma.channel.create({
                data:{
                    userId: user.id
                }
            })
        }
        done(null, user);
    } catch (error) {
        done(error);
    }
}));

passport.serializeUser(async (user: any, done) => {
    done(null, {id: user.id})
    
})

passport.deserializeUser(async (users: any, done) => {
    try {
        // console.log(`id: ${id.id}`)
      const user = await prisma.user.findFirst({
        where:{
            id: users.id
        }
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });