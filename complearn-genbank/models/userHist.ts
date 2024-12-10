import {DataTypes, Model, Optional, Sequelize} from 'sequelize';
import {sequelize} from "../configurations/databaseConnection.js";

interface UserHistAttributes {
    provider_name: string;
    user_login_id: string;
    display_name: string;
    additional_info?: object | null;
    created_at: string;
    updated_at: string;
}

interface UserHistCreationAttributes extends Optional<UserHistAttributes, 'additional_info'> {
}

class UserHist extends Model<UserHistAttributes, UserHistCreationAttributes> implements UserHistAttributes {
    public provider_name!: string;
    public user_login_id!: string;
    public display_name!: string;
    public additional_info!: object | null;
    public created_at!: string;
    public updated_at!: string;
}

UserHist.init(
    {
        provider_name: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        user_login_id: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        display_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        additional_info: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        created_at: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        updated_at: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'UserHist',
        timestamps: true,
        tableName: 'user_hist',
    }
);

export {UserHist, UserHistAttributes, UserHistCreationAttributes};

