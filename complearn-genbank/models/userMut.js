const { Sequelize, DataTypes } = require('sequelize');
const {sequelize} = require('../configurations/databaseConnection');
const logger = require("../configurations/logger");

const UserMut = sequelize.define('UserMut', {
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

module.exports = UserMut;
