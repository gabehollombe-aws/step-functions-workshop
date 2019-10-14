'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const findAllByState = async (data) => {
    const { state, paginationKey=null } = data
    const params = {
        TableName: ACCOUNTS_TABLE_NAME,
        IndexName: 'state',
        KeyConditionExpression: '#state = :state',
        ExclusiveStartKey: paginationKey,
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: { ':state': state }
    }
    const result = await dynamo.query(params).promise()
    return result
}

module.exports.handler = async(event) => {
    try {
        const result = await findAllByState(event)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
    }
};
