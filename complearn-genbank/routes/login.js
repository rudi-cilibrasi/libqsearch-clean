require("dotenv").config();
const envLoader = require('../configurations/envLoader');

module.exports = (passport) => {
    const router = require("express").Router();

    // redirect the user to authentication page
    router.get("/google", passport.authenticate("google", {scope: ["profile", "email"]}));

    router.get("/github", passport.authenticate("github", {scope: ["user:email"]}));

    // handle the callback after authentication complete
    router.get("/google/callback", passport.authenticate("google", {failureRedirect: "/"}), (req, res) => {
        res.redirect(`${envLoader.get('FRONTEND_BASE_URL')}`);
    });

    router.get("/github/callback", passport.authenticate("github", {failureRedirect: "/"}), (req, res) => {
        res.redirect(`${envLoader.get('FRONTEND_BASE_URL')}`);
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
                    res.json({userName: req.user.username});
                } else if (req.user.displayName) {
                    userName = req.user.displayName;
                    res.json({userName: req.user.displayName});
                }
            }

            console.log(`${userName} authenticated successfully`);
        } else {
            res.status(401).json({message: 'User not authenticated'});
        }
    });

    router.get("/logout", (req, res, next) => {
        req.logout(() => {
            //if (err) return next(err);
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({error: 'Failed to destroy session'});
                }
                res.clearCookie('connect.sid');
                res.status(200).json({message: 'Logged out successfully'});
            });
        })
    });

    return router;
}

