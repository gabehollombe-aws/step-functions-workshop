'use strict';

const checkName = (data) => {
    const { name } = data

    if (name.toLowerCase().includes("unprocessable_data")) {
        const simulatedError = new Error(`Simulated error: Name '${name}' is not possible to check.`)
        simulatedError.name = 'UnprocessableDataException'
        throw simulatedError
    }

    const flagged = name.toLowerCase().includes('evil')
    return { flagged }
}

const checkAddress = (data) => {
    const { address } = data

    const flagged = (address.match(/(\d+ \w+)|(\w+ \d+)/g) === null)
    return { flagged }
}


const commandHandlers = {
    'CHECK_NAME': checkName,
    'CHECK_ADDRESS': checkAddress,
}

module.exports.handler = (event, context, callback) => {
    try {
        const { command, data } = event

        const result = commandHandlers[command](data)
        callback(null, result)
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        callback(ex)
    }
};
