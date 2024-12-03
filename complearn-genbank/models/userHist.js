import { Sequelize, DataTypes } from "sequelize";
import { sequelize } from "../configurations/databaseConnection.js";

const userHist = sequelize.define('UserHist', {
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
        primaryKey: true,
    },
    updated_at: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: true,
    tableName: "user_hist",
});

export default userHist;
