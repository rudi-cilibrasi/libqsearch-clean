const { Sequelize, DataTypes } = require('sequelize');
const {sequelize} = require('../configurations/databaseConnection'); // Import the configured Sequelize instance

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

module.exports = userHist;
