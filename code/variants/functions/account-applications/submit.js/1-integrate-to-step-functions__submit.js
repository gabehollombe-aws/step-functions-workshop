'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME
const APPLICATION_PROCESSING_STEP_FUNCTION_ARN = process.env.APPLICATION_PROCESSING_STEP_FUNCTION_ARN

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

const submitNewAccountApplication = async (data) => {
    const { name, address } = data
    const application = await AccountApplications.create({ name, address, state: 'SUBMITTED' })
    return application
} 

const startStateMachineExecution = (application) => {
    const params = {
        "input": JSON.stringify({ application }),
        "name": `ApplicationID-${application.id}`,
        "stateMachineArn": APPLICATION_PROCESSING_STEP_FUNCTION_ARN
    }
    return stepfunctions.startExecution(params).promise()
}

module.exports.handler = async(event) => {
    let application
    try {
        application = await submitNewAccountApplication(event)
        await startStateMachineExecution(application)
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