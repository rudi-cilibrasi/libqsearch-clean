import logger from "../configurations/logger.js";
import {UserMut} from "../models/userMut.js";
import {UserHist} from "../models/userHist.js";
import { sequelize } from "../configurations/databaseConnection.js";
import {Transaction} from "sequelize";
import {Profile as GoogleProfile} from "passport-google-oauth20";
import {ExtendedGithubProfile} from "../models/extendedGithubProfile";
import {Profile as GithubProfile} from "passport-github2";

async function upsertUser(profile: GoogleProfile | ExtendedGithubProfile) {
    const transaction = await sequelize.transaction();
    try {
        const newDate = "" + new Date();
        await upsertUserMut(profile, newDate, transaction);
        const user: UserHist = await insertUserHist(profile, newDate, transaction);
        await transaction.commit();
        logger.info(`insertUserHist created with ID: ${user.user_login_id}`);
        return user;
    } catch (error) {
        await transaction.rollback();
        logger.error('Error upsertUser:', error);
    }
}

async function upsertUserMut(profile: GoogleProfile | ExtendedGithubProfile, newDate = "" + new Date(), transaction: Transaction | undefined):
        Promise<[UserMut, boolean | null]> {
    const [user, created] = await UserMut.upsert({
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
    return [user, created];
}

async function insertUserHist(profile: GoogleProfile | ExtendedGithubProfile, newDate = "" + new Date(), transaction: Transaction | undefined)
        : Promise<UserHist> {
    const user: UserHist = await UserHist.create({
        provider_name: profile.provider,
        user_login_id: profile.id,
        display_name: profile.displayName,
        additional_info: profile._json,
        created_at: newDate,
        updated_at: newDate
    }, {
        transaction
    });

    logger.info(`insertUserHist created with ID: ${user.user_login_id}`);
    return user;
}

export {
    upsertUserMut,
    insertUserHist,
    upsertUser
};
