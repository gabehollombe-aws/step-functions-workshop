'use strict';
const REGION = process.env.REGION
const ACCOUNTS_TABLE_NAME = process.env.ACCOUNTS_TABLE_NAME

const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
AWS.config.update({region: REGION});

const dynamo = new AWS.DynamoDB.DocumentClient();

const applicationKey = id => `application|${id}`

const submitNewAccountApplication = async (data) => {
    const id = uuid()
    const { name, address } = data
    const application = { id: applicationKey(id), name, address, state: 'SUBMITTED' }
    let params = {
        TransactItems: [
            {
                Put: {
                    TableName: ACCOUNTS_TABLE_NAME,
                    Item: application
                }
            }
        ]
    };
    await dynamo.transactWrite(params).promise()

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