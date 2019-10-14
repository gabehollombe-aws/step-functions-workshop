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


const approveApplication = async (data) => {
    const { id } = data

    const updatedApplication = await updateApplication(
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