import {describe, it, expect, beforeAll, afterAll} from "@jest/globals";
import {upsertUserMut, insertUserHist, upsertUser} from "../services/userService";
import {UserMut} from "../models/userMut";
import {UserHist} from "../models/userHist";
import {sequelize, syncSequelize} from "../configurations/databaseConnection";
import {ExtendedGithubProfile} from "../models/extendedGithubProfile";

beforeEach(async () => {
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    await sequelize.close();
});

describe('Test upsertUserMut function', () => {
    it('should upsert a UserMut record successfully', async () => {
        const profile: ExtendedGithubProfile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            profileUrl: 'https://github.com/johndoe',
            _json: {email: 'johndoe@example.com'},
        };

        const result: [UserMut, boolean | null] = await upsertUserMut(profile, "" + new Date(), undefined);

        // Assert the returned result
        expect(result[0].provider_name).toBe('github');
        expect(result[0].user_login_id).toBe('12345');
        expect(result[0].display_name).toBe('John Doe');
        expect((result[0].additional_info as {email: string}).email).toBe('johndoe@example.com');

        // Optionally, check if the record is inserted/updated in the database
        const userMutRecord = await UserMut.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userMutRecord).not.toBeNull();
        if (userMutRecord) {
            expect(userMutRecord.provider_name).toBe('github');
        }
    });

    it('should upsert a UserMut record successfully with utf-8', async () => {
        const profile: ExtendedGithubProfile = {
            provider: 'github',
            id: '12345',
            displayName: 'Hello, 世界 🌏',
            profileUrl: 'https://github.com/johndoe',
            _json: {email: 'johndoe@example.com'},
        };

        const result: [UserMut, boolean | null] = await upsertUserMut(profile, "" + new Date(), undefined);

        // Assert the returned result
        expect(result[0].provider_name).toBe('github');
        expect(result[0].user_login_id).toBe('12345');
        expect(result[0].display_name).toBe('Hello, 世界 🌏');
        expect((result[0].additional_info as {email: string}).email).toBe('johndoe@example.com');

        // Optionally, check if the record is inserted/updated in the database
        const userMutRecord = await UserMut.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userMutRecord).not.toBeNull();

        if (userMutRecord) {
            expect(userMutRecord.provider_name).toBe('github');
            expect(userMutRecord.display_name).toBe('Hello, 世界 🌏');
        }
    });

    it('should insert a UserHist record successfully', async () => {
        const profile: ExtendedGithubProfile = {
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            profileUrl: 'https://github.com/johndoe',
            _json: {email: 'johndoe@example.com'},
        };

        const result = await insertUserHist(profile, "" + new Date(), undefined);

        // Assert the returned result
        expect(result.provider_name).toBe('github');
        expect(result.user_login_id).toBe('12345');
        expect(result.display_name).toBe('John Doe');
        expect((result.additional_info as {email: string}).email).toBe('johndoe@example.com');

        // Check if the record was inserted into the UserHist table
        const userHistRecord = await UserHist.findOne({
            where: {user_login_id: profile.id},
        });

        expect(userHistRecord).not.toBeNull();

        if (userHistRecord) {
            expect(userHistRecord.provider_name).toBe('github');
        }
    });

    it('should insert new record with created_at and updated_at', async () => {
        const newDate = "" + new Date();
        let profile: ExtendedGithubProfile = {
            profileUrl: 'https://github.com/johndoe',
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {key: 'value'},
        };
        await upsertUserMut(profile, newDate, undefined);

        const user: UserMut | null = await UserMut.findOne({where: {user_login_id: '12345'}});

        expect(user).not.toBeNull();

        if (user) {
            expect(user.created_at).toEqual(newDate); // Ensure created_at is set
            expect(user.updated_at).toEqual(newDate); // Ensure updated_at is set
        }

        const findUserAgain = await UserMut.findOne({where: {user_login_id: '12345'}});
        expect(findUserAgain).not.toBeNull();

        const updatedDate = "" + new Date();

        let secondProfile: ExtendedGithubProfile = {
            provider: 'github',
            profileUrl: 'https://github.com/johndoe',
            id: '12345',
            displayName: 'John Doe Updated',
            _json: {key: 'new value'},
        };
        await upsertUserMut(secondProfile, updatedDate, undefined);

        const userUpsertSecondTime = await UserMut.findOne({where: {user_login_id: '12345'}});

        expect(userUpsertSecondTime).not.toBeNull();

        if (userUpsertSecondTime) {
            expect(userUpsertSecondTime.display_name).toBe('John Doe Updated');
            expect(userUpsertSecondTime.additional_info).toEqual({key: 'new value'});
            expect(userUpsertSecondTime.updated_at).toEqual(updatedDate); // Ensure updated_at is changed

            if (findUserAgain) {
                expect(userUpsertSecondTime.created_at).toEqual(findUserAgain.created_at); // Ensure created_at is unchanged
            }
        }

    });

    it('should commit transaction when everything is successful', async () => {
        const profile: ExtendedGithubProfile = {
            profileUrl: 'https://github.com/johndoe',
            provider: 'github',
            id: '12345',
            displayName: 'John Doe',
            _json: {email: 'johndoe@example.com'},
        };

        await upsertUser(profile);

        // Verify if the user was inserted into UserMut table
        const userMut = await UserMut.findOne({where: {user_login_id: profile.id}});

        expect(userMut).not.toBeNull();

        if (userMut) {
            expect(userMut.provider_name).toBe(profile.provider);
        }

        // Verify if the user history was inserted into UserHist table
        const userHist = await UserHist.findOne({where: {user_login_id: profile.id}});
        expect(userHist).not.toBeNull();

        if (userHist) {
            expect(userHist.user_login_id).toBe(profile.id);
        }
    });

    it('should rollback transaction when there is an error in upsertUserMut', async () => {
        // Simulate an error in upsertUserMut
        const profile: ExtendedGithubProfile = {
            profileUrl: 'https://github.com/johndoe',
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
