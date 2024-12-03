import ENV_LOADER from "../configurations/envLoader.js";
import logger from "../configurations/logger.js";
import { Router } from "express";

const login = (passport) => {
    const router = Router();

    // redirect the user to authentication page
    router.get("/google", passport.authenticate("google", {scope: ["profile", "email"]}));

    router.get("/github", passport.authenticate("github", {scope: ["user:email"]}));

    // handle the callback after authentication complete
    router.get("/google/callback", passport.authenticate("google", {failureRedirect: `${ENV_LOADER.FRONTEND_BASE_URL}/error`}),
        (req, res) => {
            res.redirect(`${ENV_LOADER.FRONTEND_BASE_URL}`);
        });

    router.get("/github/callback", passport.authenticate("github", {failureRedirect: `${ENV_LOADER.FRONTEND_BASE_URL}/error`}),
        (req, res) => {
            res.redirect(`${ENV_LOADER.FRONTEND_BASE_URL}`);
        });

    router.get("/profile", (req, res) => {
        res.send(`Welcome ${req.user.displayName}`);
    });

    router.get('/user-info', (req, res) => {
        if (req.isAuthenticated()) {
            let userName = "";

            if (req.user) {
                if (req.user.username) {
                    userName = req.user.username
                } else if (req.user.displayName) {
                    userName = req.user.displayName;
                }

                if (userName) {
                    res.json({userName: userName});
                }
            }

            logger.info(`${userName} authenticated successfully`);
        } else {
            res.status(401).json({message: 'User not authenticated'});
        }
    });

    router.get("/logout", (req, res, next) => {
        req.logout(() => {
            req.session.destroy((err) => {
                if (err) {
                    logger.error("Error occurs during logout process", err);
                    return res.status(500).json({error: 'Failed to destroy session'});
                }
                res.clearCookie('connect.sid');
                res.status(200).json({message: 'Logged out successfully'});
            });
        })
    });

    return router;
}

export default login;