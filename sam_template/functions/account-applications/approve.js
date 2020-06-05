'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)

const approveApplication = async (data) => {
    const { id } = data
    const updatedApplication = await AccountApplications.update(
        id, 
        { state: 'APPROVED' }
    )
    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await approveApplication(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};