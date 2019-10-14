const uuid = require('uuid/v4')

class AccountApplications {
    constructor(tableName, dynamoDocClient) {
        this.tableName = tableName
        this.dynamo = dynamoDocClient
    }

    async create(attributes) {
        const applicationKey = id => `application_${id}`
        const id = uuid()
        const application = Object.assign(attributes, { id: applicationKey(id) })
        let params = {
            TableName: this.tableName,
            Item: application
        };
        await this.dynamo
            .put(params)
            .promise()

        return application
}

    async get(id) {
        const params = {
          TableName: this.tableName,
          Key: { id: id }
        };
    
        const result = await this.dynamo.get(params).promise()
        return result.Item
    }

    async update(id, attributes) {
        const application = await this.get(id)
        const updatedApplication = Object.assign(application, attributes)
        const params = {
            TableName: this.tableName,
            Item: updatedApplication
        };
        await this.dynamo.put(params).promise()
        return updatedApplication
    } 

    async findAllByState(data) {
        const { state, paginationKey=null } = data
        const params = {
            TableName: this.tableName,
            IndexName: 'state',
            KeyConditionExpression: '#state = :state',
            ExclusiveStartKey: paginationKey,
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':state': state }
        }
        const result = await this.dynamo.query(params).promise()
        return result
    }

    async delete(id) {
        const params = {
          TableName: this.tableName,
          Key: { id: id }
        };
        const result = await this.dynamo.delete(params).promise()
        return result.Item
    }
}

module.exports = exports = (tableName, dynamoDocClient) => ( new AccountApplications(tableName, dynamoDocClient) )