const { computeDEXTransactionId } = require('../common/utils');

const transactionMapper = ({nonce, params: {amount, recipientAddress, data}, sender, block: {timestamp}, signatures = []}) => {
    return {
        id: computeDEXTransactionId(sender.address, nonce),
        message: data,
        amount,
        timestamp,
        senderAddress: sender.address,
        recipientAddress,
        signatures,
        nonce,
    };
};

const blockMapper = ({id, height, timestamp, numberOfTransactions}) => ({id, height, timestamp, numberOfTransactions});

module.exports = {transactionMapper, blockMapper};
