'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

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

const updateApplicationWithDecision = (id, decision) => {
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
        throw new Error("Required `decision` parameter must be 'APPROVE' or 'REJECT'")
    }

    switch(decision) {
        case 'APPROVE': return updateApplication(id, { state: 'REVIEW_APPROVED' })
        case 'REJECT': return updateApplication(id, { state: 'REVIEW_REJECTED' })
    }
}

const updateWorkflowWithReviewDecision = async (data) => {
    const { id, decision } = data

    const updatedApplication = await updateApplicationWithDecision(id, decision)

    let params = {
        output: JSON.stringify({ decision }),
        taskToken: updatedApplication.taskToken
    };
    await stepfunctions.sendTaskSuccess(params).promise()
    return updatedApplication
}

module.exports.handler = async(event) => {
    try {
        const result = await updateWorkflowWithReviewDecision(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};