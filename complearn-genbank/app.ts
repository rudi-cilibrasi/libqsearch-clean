import express from "express";
import passport from "passport";
import cors from "cors";
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy, Profile } from "passport-github2";
import ENV_LOADER from "./configurations/envLoader";
import logger from "./configurations/logger";

// routes
import loginRoutes from "./routes/login";
import externalRoutes from "./routes/external";
import { upsertUser } from "./services/userService";
import redisRoutes from "./routes/redis";
import {requestLogger} from "./middleware/requestLogger";

const app: express.Application = express();

app.use(cors({ origin: ENV_LOADER.FRONTEND_BASE_URL, credentials: true }));

app.use(session({
    secret: "secret", // A key to sign the session ID cookie
    resave: false, // don't save session if it was not modified during the request
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
    },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(requestLogger);

type DoneCallback = (error: any, user?: any) => void;

passport.use(new GitHubStrategy({
    clientID: ENV_LOADER.GITHUB_CLIENT_ID,
    clientSecret: ENV_LOADER.GITHUB_CLIENT_SECRET,
    callbackURL: `${ENV_LOADER.BASE_URL}/auth/github/callback`,
}, async (accessToken: string, refreshToken: string, profile: Profile, done: DoneCallback) => {
    try {
        await upsertUser(profile);
        return done(null, profile);
    } catch (error) {
        logger.error(error);
        return done(error);
    }
}));

passport.use(new GoogleStrategy({
    clientID: ENV_LOADER.GOOGLE_CLIENT_ID,
    clientSecret: ENV_LOADER.GOOGLE_CLIENT_SECRET,
    callbackURL: `${ENV_LOADER.BASE_URL}/auth/google/callback`,
}, async (accessToken: string, refreshToken: string, profile: Profile, done: DoneCallback) => {
    try {
        await upsertUser(profile);
        return done(null, profile);
    } catch (error) {
        logger.error(error);
        return done(error);
    }
}));
// mount routes with parent path
app.use("/api/auth", loginRoutes(passport));
app.use("/api/external", externalRoutes);
app.use("/api/redis", redisRoutes);

// user = the profile object above strategy
// After authentication is complete => serializeUser to store in the session, allowing the user to stay logged in
passport.serializeUser((user: any, done) => done(null, user));

// uses the stored session data from users' requests to fetch the full user object
passport.deserializeUser((user: any, done) => done(null, user));



app.use((err: any, req: any, res: any, next: any) => {
    logger.error({
        requestId: req.requestId,
        level: 'error',
        message: 'Unhandled error',
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack
        }
    });

    res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId
    });
});

app.use((req: any, res: any) => {
    res.status(404).json({
        message: "Page not found",
        requestId: req.requestId
    });
});

export default app;