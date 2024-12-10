import {DataTypes, Model, Optional, Sequelize} from 'sequelize';
import {sequelize} from "../configurations/databaseConnection";

// Define the attributes of the UserMut model
interface UserMutAttributes {
    provider_name: string;
    user_login_id: string;
    display_name: string;
    additional_info?: object | null;
    created_at: string;
    updated_at: string;
}

// Define the creation attributes (optional fields for creation)
interface UserMutCreationAttributes extends Optional<UserMutAttributes, 'additional_info'> {
}

// Define the UserMut model class
class UserMut extends Model<UserMutAttributes, UserMutCreationAttributes> implements UserMutAttributes {
    public provider_name!: string;
    public user_login_id!: string;
    public display_name!: string;
    public additional_info!: object | null;
    public created_at!: string;
    public updated_at!: string;
}

// Initialize the model
UserMut.init(
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
        },
        updated_at: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize, // Sequelize instance
        modelName: 'UserMut', // Model name
        timestamps: true,
        tableName: 'user_mut', // Table name in the database
    }
);

export {UserMut, UserMutAttributes, UserMutCreationAttributes};
