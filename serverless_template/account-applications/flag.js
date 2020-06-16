'use strict';
const REGION = process.env.REGION
const APPLICATIONS_TABLE_NAME = process.env.APPLICATIONS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const AccountApplications = require('./AccountApplications')(APPLICATIONS_TABLE_NAME, dynamo)

const flagForReview = async (data) => {
    const { id, flagType } = data

    if (flagType !== 'REVIEW' && flagType !== 'UNPROCESSABLE_DATA') {
        throw new Error("flagType must be REVIEW or UNPROCESSABLE_DATA")
    }

    let newState
    let reason
    if (flagType === 'REVIEW') {
        newState = 'FLAGGED_FOR_REVIEW'
        reason = data.reason
    }
    else {
        reason = JSON.parse(data.errorInfo.Cause).errorMessage
        newState = 'FLAGGED_WITH_UNPROCESSABLE_DATA'
    }

    const updatedApplication = await AccountApplications.update(
        id,
        {
            state: newState,
            reason,
        }
    )
    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await flagForReview(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};