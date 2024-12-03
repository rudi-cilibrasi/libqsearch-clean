import express from "express";
import passport from "passport";
import cors from "cors";
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import ENV_LOADER from "./configurations/envLoader.js";
import logger from "./configurations/logger.js";

// routes
import loginRoutes from "./routes/login.js";
import externalRoutes from "./routes/external.js";
import { upsertUser } from "./services/userService.js";
import redisRoutes from "./routes/redis.js";
import {requestLogger} from "./middleware/requestLogger.js";

const app = express();

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


passport.use(new GitHubStrategy({
    clientID: ENV_LOADER.GITHUB_CLIENT_ID,
    clientSecret: ENV_LOADER.GITHUB_CLIENT_SECRET,
    callbackURL: `${ENV_LOADER.BASE_URL}/auth/github/callback`,
}, async (accessToken, refreshToken, profile, done) => {
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
}, async (accessToken, refreshToken, profile, done) => {
    try {
        await upsertUser(profile);
        return done(null, profile);
    } catch (error) {
        logger.error(error);
        return done(error);
    }
}));

// user = the profile object above strategy
// After authentication is complete => serializeUser to store in the session, allowing the user to stay logged in
passport.serializeUser((user, done) => done(null, user));

// uses the stored session data from users' requests to fetch the full user object
passport.deserializeUser((user, done) => done(null, user));

// mount routes with parent path
app.use("/api/auth", loginRoutes(passport));
app.use("/api/external", externalRoutes);
app.use("/api/redis", redisRoutes);

app.use((err, req, res, next) => {
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

app.use((req, res) => {
    res.status(404).json({
        message: "Page not found",
        requestId: req.requestId
    });
});

export default app;