'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

const submitNewAccountApplication = async (data) => {
    const { name, address } = data
    const application = await AccountApplications.create({ name, address, state: 'SUBMITTED' })
    return application
} 

module.exports.handler = async(event) => {
    let application
    try {
        application = await submitNewAccountApplication(event)
        return application
    } catch (ex) {
        if (application !== undefined) {
            await AccountApplications.delete(application.id)
        }

        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
}