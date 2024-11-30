const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const {upsertUserMut, insertUserHist} = require("../services/userService");
const UserMut = require("../models/userMut");
const UserHist = require("../models/userHist");
const {sequelize, syncSequelize} = require("../configurations/databaseConnection");

beforeAll(() => syncSequelize());

afterAll(async () => {
    // Close the test database connection after tests are done
    await sequelize.close();
});

describe('Test upsertUserMut function', () => {
    it('should upsert a UserMut record successfully', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: { email: 'johndoe@example.com' },
        };

        const result = await upsertUserMut(profile);

        // Assert the returned result
        expect(result[0].provider_name).toBe('github');
        expect(result[0].user_login_id).toBe('12345');
        expect(result[0].display_name).toBe('John Doe');
        expect(result[0].additional_info.email).toBe('johndoe@example.com');

        // Optionally, check if the record is inserted/updated in the database
        const userMutRecord = await UserMut.findOne({
            where: { user_login_id: profile.id },
        });

        expect(userMutRecord).not.toBeNull();
        expect(userMutRecord.provider_name).toBe('github');
    });
});

describe('Test insertUserHist function', () => {
    it('should insert a UserHist record successfully', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: { email: 'johndoe@example.com' },
        };

        const result = await insertUserHist(profile);

        // Assert the returned result
        expect(result.provider_name).toBe('github');
        expect(result.user_login_id).toBe('12345');
        expect(result.display_name).toBe('John Doe');
        expect(result.additional_info.email).toBe('johndoe@example.com');

        // Check if the record was inserted into the UserHist table
        const userHistRecord = await UserHist.findOne({
            where: { user_login_id: profile.id },
        });

        expect(userHistRecord).not.toBeNull();
        expect(userHistRecord.provider_name).toBe('github');
    });
});
