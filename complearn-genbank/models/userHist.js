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
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
        primaryKey: true,
    },
}, {
    timestamps: true,
    tableName: "user_hist",
    updatedAt: 'updated_at'
});

module.exports = userHist;
