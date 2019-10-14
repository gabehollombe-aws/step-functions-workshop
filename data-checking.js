'use strict';

const checkName = (data) => {
    const { name } = data
    const flagged = name.includes('evil')
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