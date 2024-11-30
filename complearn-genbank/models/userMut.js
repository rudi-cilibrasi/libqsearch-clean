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
    }
}, {
    timestamps: true,
    tableName: "user_mut",
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = UserMut;
