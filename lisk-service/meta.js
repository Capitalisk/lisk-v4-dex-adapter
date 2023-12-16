const Store = {
    Blocks: {
        path: '/api/v3/blocks',
        filter: {
            blockId: 'blockID',
            height: 'height', // Can be expressed as an interval ie. 1:20
            generatorAddress: 'generatorAddress', // Resolves new and old address system
            generatorPublicKey: 'generatorPublicKey',
            generatorUsername: 'generatorUsername',
            timestamp: 'timestamp', // Can be expressed as interval ie. 100000:200000
            limit: 'limit',
            offset: 'offset',
            sort: 'sort',
        },
        sortBy: {
            heightAsc: 'height:asc',
            heightDesc: 'height:desc',
            timestampAsc: 'timestamp:asc',
            timestampDesc: 'timestamp:desc',
        },
    },
    Transactions: {
        path: '/api/v3/transactions',
        filter: {
            transactionId: 'transactionId',
            moduleCommand: 'moduleCommand', // Transfer transaction: moduleName = token, assetName = transfer eg. token:transfer
            senderAddress: 'senderAddress',
            senderPublicKey: 'senderPublicKey',
            senderUsername: 'senderUsername',
            recipientAddress: 'recipientAddress',
            recipientPublicKey: 'recipientPublicKey',
            recipientUsername: 'recipientUsername',
            amount: 'amount', // Can be expressed as interval ie. 100000:200000
            timestamp: 'timestamp', // Can be expressed as interval ie. 100000:200000
            blockId: 'blockID',
            height: 'height',
            search: 'search', // Wildcard search
            data: 'data', // Wildcard search
            includePending: 'includePending',
            nonce: 'nonce', // In conjunction with senderAddress
            limit: 'limit',
            offset: 'offset',
            sort: 'sort',
        },
        sortBy: {
            amountAsc: 'amount:asc',
            amountDesc: 'amount:desc',
            timestampAsc: 'timestamp:asc',
            timestampDesc: 'timestamp:desc',
        },
    }
};

module.exports = Store;
