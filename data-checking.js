'use strict';

const checkName = async (data) => {
    const { name } = data

    const flagged = (name.indexOf('evil') !== -1)
    return { flagged }
}

const checkAddress = async (data) => {
    const { address } = data

    const flagged = (address.match(/[0-9]+ \w+/g) === null)
    return { flagged }
}


const commandHandlers = {
    'CHECK_NAME': checkName,
    'CHECK_ADDRESS': checkAddress,
}

module.exports.handler = async(event) => {
    try {
        const { command, data } = event

        const result = await commandHandlers[command](data)
        return result
    } catch (ex) {
        console.error(ex)
        console.info('event', JSON.stringify(event))
        throw ex
    }
};