const {Sequelize} = require('sequelize');
const ENV_LOADER = require('./envLoader');
const logger = require("./logger");

const sequelizeNormal = new Sequelize(
    ENV_LOADER.MYSQL_DATABASE,
    ENV_LOADER.MYSQL_USER,
    ENV_LOADER.MYSQL_PASSWORD, {
        host: ENV_LOADER.DB_HOST,
        dialect: 'mysql',
        pool: {
            max: 10,          // Maximum number of connections in the pool
            min: 0,          // Minimum number of connections in the pool
            acquire: 30000,  // Maximum time (in ms) that pool will try to get a connection before throwing an error
            idle: 10000      // Maximum time (in ms) that a connection can be idle before being released
        },
        // or set to false here
        logging: (sql) => {
            logger.info(sql);  // Log SQL queries
        },
    });

const sequelizeTestMode = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: (sql) => {
        logger.info(sql);  // Log SQL queries
    },
});

const sequelize = process.env.NODE_ENV === 'test' ? sequelizeTestMode : sequelizeNormal;

const syncSequelize = async () => {
    try {
        let syncOptions = process.env.NODE_ENV === 'production' ? {} : {alter: true};
        await sequelize.sync(syncOptions);
        logger.info('Database synchronized!');
    } catch (error) {
        logger.error('Error starting the server:', error);
    }
};

module.exports = {sequelize, syncSequelize};
