require("dotenv").config();

const express = require("express");
const passport = require("passport");
const cors = require("cors");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;

// routes
const loginRoutes = require("./routes/login");
const ncbiRoutes = require("./routes/ncbi");
const languageRoutes = require("./routes/language");
const app = express();

app.use(cors({ origin: `${process.env.FRONT_END_URL}`, credentials: true }));

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

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/auth/github/callback`,
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

// user = the profile object above strategy
// After authentication is complete => serializeUser to store in the session, allowing the user to stay logged in
passport.serializeUser((user, done) => done(null, user));

// uses the stored session data from users' requests to fetch the full user object
passport.deserializeUser((user, done) => done(null, user));

// mount routes with parent path
app.use("/api/auth", loginRoutes(passport));
app.use("/api/ncbi", ncbiRoutes);
app.use("/api/language", languageRoutes);

app.use((req, res, next) => {
    res.status(404).json({message: "Page not found"});
});

module.exports = app;