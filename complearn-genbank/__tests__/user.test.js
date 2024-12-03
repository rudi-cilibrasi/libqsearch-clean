import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { upsertUserMut, insertUserHist, upsertUser } from "../services/userService.js";
import UserMut from "../models/userMut.js";
import UserHist from "../models/userHist.js";
import { sequelize, syncSequelize } from "../configurations/databaseConnection.js";

beforeEach(async () => {
    await sequelize.sync({ force: true }); // Drops and recreates tables
});

afterAll(async () => {
    await sequelize.close();
});

describe('Test upsertUserMut function', () => {
    it('should upsert a UserMut record successfully', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {email: 'johndoe@example.com'},
        };

        const result = await upsertUserMut(profile);

        // Assert the returned result
        expect(result[0].provider_name).toBe('github');
        expect(result[0].user_login_id).toBe('12345');
        expect(result[0].display_name).toBe('John Doe');
        expect(result[0].additional_info.email).toBe('johndoe@example.com');

        // Optionally, check if the record is inserted/updated in the database
        const userMutRecord = await UserMut.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userMutRecord).not.toBeNull();
        expect(userMutRecord.provider_name).toBe('github');
    });

    it('should upsert a UserMut record successfully with utf-8', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'Hello, 世界 🌏',
            _json: {email: 'johndoe@example.com'},
        };

        const result = await upsertUserMut(profile);

        // Assert the returned result
        expect(result[0].provider_name).toBe('github');
        expect(result[0].user_login_id).toBe('12345');
        expect(result[0].display_name).toBe('Hello, 世界 🌏');
        expect(result[0].additional_info.email).toBe('johndoe@example.com');

        // Optionally, check if the record is inserted/updated in the database
        const userMutRecord = await UserMut.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userMutRecord).not.toBeNull();
        expect(userMutRecord.provider_name).toBe('github');
        expect(userMutRecord.display_name).toBe('Hello, 世界 🌏');
    });

    it('should insert a UserHist record successfully', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {email: 'johndoe@example.com'},
        };

        const result = await insertUserHist(profile);

        // Assert the returned result
        expect(result.provider_name).toBe('github');
        expect(result.user_login_id).toBe('12345');
        expect(result.display_name).toBe('John Doe');
        expect(result.additional_info.email).toBe('johndoe@example.com');

        // Check if the record was inserted into the UserHist table
        const userHistRecord = await UserHist.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userHistRecord).not.toBeNull();
        expect(userHistRecord.provider_name).toBe('github');
    });

    it('should insert new record with created_at and updated_at', async () => {
        const newDate = "" + new Date();
        let profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {key: 'value'},
        };
        await upsertUserMut(profile, newDate);

        const user = await UserMut.findOne({where: {user_login_id: '12345'}});

        expect(user).not.toBeNull();
        expect(user.created_at).toEqual(newDate); // Ensure created_at is set
        expect(user.updated_at).toEqual(newDate); // Ensure updated_at is set

        const originalCreatedAt = (await UserMut.findOne({where: {user_login_id: '12345'}})).created_at;
        const updatedDate = "" + new Date();

        let secondProfile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe Updated',
            _json: {key: 'new value'},
        };
        await upsertUserMut(secondProfile, updatedDate);

        const userUpsertSecondTime = await UserMut.findOne({where: {user_login_id: '12345'}});

        expect(userUpsertSecondTime.display_name).toBe('John Doe Updated');
        expect(userUpsertSecondTime.additional_info).toEqual({key: 'new value'});
        expect(userUpsertSecondTime.updated_at).toEqual(updatedDate); // Ensure updated_at is changed
        expect(userUpsertSecondTime.created_at).toEqual(originalCreatedAt); // Ensure created_at is unchanged

    });

    it('should commit transaction when everything is successful', async () => {
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {email: 'johndoe@example.com'},
        };

        await upsertUser(profile);

        // Verify if the user was inserted into UserMut table
        const userMut = await UserMut.findOne({where: {user_login_id: profile.id}});
        expect(userMut).not.toBeNull();
        expect(userMut.provider_name).toBe(profile.provider);

        // Verify if the user history was inserted into UserHist table
        const userHist = await UserHist.findOne({where: {user_login_id: profile.id}});
        expect(userHist).not.toBeNull();
        expect(userHist.user_login_id).toBe(profile.id);
    });

    it('should rollback transaction when there is an error in upsertUserMut', async () => {
        // Simulate an error in upsertUserMut
        const profile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {email: 'johndoe@example.com'},
        };
        jest.spyOn(UserMut, 'upsert').mockRejectedValueOnce(new Error('Something went wrong'));

        await upsertUser(profile);
        // Ensure no record is created in UserMut table
        const userMut = await UserMut.findOne({where: {user_login_id: profile.id}});
        expect(userMut).toBeNull(); // No userMut record should be inserted

        // Ensure no record is created in UserHist table
        const userHist = await UserHist.findOne({where: {user_login_id: profile.id}});
        expect(userHist).toBeNull(); // No userHist record should be inserted
    });
});
