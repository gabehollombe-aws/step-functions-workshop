'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

module.exports.handler = async(event) => {
    try {
        const result = await AccountApplications.findAllByState(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
    }
};
