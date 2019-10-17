'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME
const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

const AccountApplications = require('./AccountApplications')(ACCOUNTS_TABLE_NAME, dynamo)

const submitNewAccountApplication = async (data) => {
    const { name, address } = data

    const application = await AccountApplications.create({ name, address, state: 'SUBMITTED' })

    const params = {
        "input": JSON.stringify({ application }),
        "name": `ApplicationID-${application.id}`,
        "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
    }
    await stepfunctions.startExecution(params).promise()

    return application
} 

module.exports.handler = async(event) => {
    try {
        const result = await submitNewAccountApplication(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};