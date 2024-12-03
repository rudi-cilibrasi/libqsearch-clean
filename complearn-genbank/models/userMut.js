import { DataTypes } from "sequelize";
import { sequelize } from "../configurations/databaseConnection.js";

const UserMut = sequelize.define("UserMut", {
    provider_name: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    user_login_id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    display_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    additional_info: {
        type: DataTypes.JSON,
        allowNull: true
    },
    created_at: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    updated_at: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: true,
    tableName: "user_mut",
});

export default UserMut;
