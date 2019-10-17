'use strict';

const checkName = (data) => {
    const { name } = data

    if (name.indexOf("UNPROCESSABLE_DATA") !== -1) {
        const simulatedError = new Error(`Simulated error: Name '${name}' is not possible to check.`)
        simulatedError.name = 'UnprocessableDataException'
        throw simulatedError
    }

    const flagged = name.includes('evil')
    return { flagged }
}

const checkAddress = (data) => {
    const { address } = data

    const flagged = (address.match(/[0-9]+ \w+/g) === null)
    return { flagged }
}


const commandHandlers = {
    'CHECK_NAME': checkName,
    'CHECK_ADDRESS': checkAddress,
}

module.exports.handler = (event) => {
    try {
        const { command, data } = event

        const result = commandHandlers[command](data)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};