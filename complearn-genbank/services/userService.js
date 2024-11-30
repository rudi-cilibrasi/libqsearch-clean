const logger = require('../configurations/logger');
const UserMut = require("../models/userMut");
const UserHist = require("../models/userHist");

async function upsertUserMut(profile) {
    try {
        return await UserMut.upsert({
            provider_name: profile.provider,
            user_login_id:  profile.id,
            display_name: profile.displayName,
            additional_info: profile._json
        }, {
            returning: true, // Optionally return the updated instance (PostgreSQL only)
        });
    } catch (error) {
        logger.error('Error upsertUserMut:', error);
    }
}

async function insertUserHist(profile) {
    try {
        const user = await UserHist.create({
            provider_name: profile.provider,
            user_login_id:  profile.id,
            display_name: profile.displayName,
            additional_info: profile._json,
            createdAt: new Date()
        });

        logger.info(`insertUserHist created with ID: ${user.id}`);
        return user;
    } catch (error) {
        logger.error('Error insertUserHist:', error);
    }
}

module.exports = {
    upsertUserMut,
    insertUserHist
};
