'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const getApplication = async (id) => {
    const params = {
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { id: id }
    };

    const result = await dynamo.get(params).promise()
    return result.Item
}

const updateApplication = async (id, attributes) => {
    const application = await getApplication(id)
    const updatedApplication = Object.assign(application, attributes)
    const params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: updatedApplication
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()
    return updatedApplication
}

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

    const updatedApplication = await updateApplication(
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