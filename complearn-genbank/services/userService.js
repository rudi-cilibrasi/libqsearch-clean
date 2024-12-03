import logger from "../configurations/logger.js";
import UserMut from "../models/userMut.js";
import UserHist from "../models/userHist.js";
import { sequelize } from "../configurations/databaseConnection.js";

async function upsertUser(profile) {
    const transaction = await sequelize.transaction();
    try {
        const newDate = "" + new Date();
        await upsertUserMut(profile, newDate, transaction);
        const user = await insertUserHist(profile, newDate, transaction);

        await transaction.commit();
        logger.info(`insertUserHist created with ID: ${user.id}`);
        return user;
    } catch (error) {
        await transaction.rollback();
        logger.error('Error upsertUser:', error);
    }
}

async function upsertUserMut(profile, newDate = "" + new Date(), transaction) {
    return await UserMut.upsert({
        provider_name: profile.provider,
        user_login_id: profile.id,
        display_name: profile.displayName,
        additional_info: profile._json,
        created_at: newDate,
        updated_at: newDate
    }, {
        // Exclude created_at from updates
        fields: ['provider_name', 'user_login_id', 'display_name', 'additional_info', 'updated_at'],
        transaction
    });

}

async function insertUserHist(profile, newDate = "" + new Date(), transaction) {
    const user = await UserHist.create({
        provider_name: profile.provider,
        user_login_id: profile.id,
        display_name: profile.displayName,
        additional_info: profile._json,
        created_at: newDate,
        updated_at: newDate
    }, {
        transaction
    });

    logger.info(`insertUserHist created with ID: ${user.id}`);
    return user;
}

export {
    upsertUserMut,
    insertUserHist,
    upsertUser
};
