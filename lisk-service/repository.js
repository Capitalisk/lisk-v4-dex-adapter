const {firstOrNull} = require('../liskv3/utils');

const HttpClient = require('./client');
const metaStore = require('./meta');

class LiskServiceRepository {

    static defaultTestNetUrl = 'https://testnet-service.lisk.com';
    static defaultMainNetUrl = 'https://service.lisk.com';

    constructor({config, logger}) {
        this.liskServiceClient = new HttpClient({config: this.getDefaultHttpClientConfig(config), logger});
    }

    getDefaultHttpClientConfig = (config) => {
        let defaultUrl = LiskServiceRepository.defaultMainNetUrl;
        if (config.env === 'test') {
            defaultUrl = LiskServiceRepository.defaultTestNetUrl;
        }
        const baseUrl = config.liskServiceHost ? config.liskServiceHost : defaultUrl;
        if (!config.liskServiceHostFallbacks) {
            config.liskServiceHostFallbacks = [];
        }
        const fallbacks = [...config.liskServiceHostFallbacks, defaultUrl];
        return {baseUrl, fallbacks};
    };

    /**
     * For getting data at given path, with given filter params
     * @param metaStorePath - Meta store path to find the data (refer to meta.js)
     * @param filterParams - filter param object (key-value pairs)
     * @returns {Promise<*>}
     */

    get = async (metaStorePath, filterParams = {}) => {
        const response = await this.liskServiceClient.get(metaStorePath, filterParams);
        return response.data;
    };

    post = async (metaStorePath, payload = {}) => {
        const response = await this.liskServiceClient.post(metaStorePath, payload);
        return response.data;
    };

    postTransaction = async (payload) => await this.post(metaStore.Transactions.path, payload);

    getNetworkStatus = async () => await this.get('/api/v2/network/status');

    getNetworkStats = async () => await this.get('/api/v2/network/statistics');

    getFees = async () => await this.get('/api/v2/fees');

    getAccounts = async (filterParams) => (await this.get(metaStore.Accounts.path, filterParams)).data;

    getTransactions = async (filterParams) => (await this.get(metaStore.Transactions.path, filterParams)).data;

    getBlocks = async (filterParams) => (await this.get(metaStore.Blocks.path, filterParams)).data;

    getAccountByAddress = async (walletAddress) => {
        const accounts = await this.getAccounts({
            [metaStore.Accounts.filter.address]: walletAddress,
        });
        return firstOrNull(accounts);
    };

    getOutboundTransactions = async (senderAddress, fromTimestamp, limit, order = 'asc') => {
        const transactionFilterParams = {
            [metaStore.Transactions.filter.senderAddress]: senderAddress,
            [metaStore.Transactions.filter.timestamp]: `${fromTimestamp}:`,
            [metaStore.Transactions.filter.limit]: limit,
            [metaStore.Transactions.filter.moduleAssetId]: '2:0', // transfer transaction
            [metaStore.Transactions.filter.moduleAssetName]: 'token:transfer', // token transfer
        };
        if (order === 'desc') {
            transactionFilterParams[metaStore.Transactions.filter.sort] = metaStore.Transactions.sortBy.timestampDesc;
        }
        return await this.getTransactions(transactionFilterParams);
    };

    getInboundTransactionsFromBlock = async (recipientAddress, blockId) => {
        const transactionFilterParams = {
            [metaStore.Transactions.filter.recipientAddress]: recipientAddress,
            [metaStore.Transactions.filter.blockId]: blockId,
            [metaStore.Transactions.filter.moduleAssetId]: '2:0', // transfer transaction
            [metaStore.Transactions.filter.moduleAssetName]: 'token:transfer', // token transfer
        };
        return await this.getTransactions(transactionFilterParams);
    };

    getOutboundTransactionsFromBlock = async (senderAddress, blockId) => {
        const transactionFilterParams = {
            [metaStore.Transactions.filter.senderAddress]: senderAddress,
            [metaStore.Transactions.filter.blockId]: blockId,
            [metaStore.Transactions.filter.moduleAssetId]: '2:0', // transfer transaction
            [metaStore.Transactions.filter.moduleAssetName]: 'token:transfer', // token transfer
        };
        return await this.getTransactions(transactionFilterParams);
    };

    getLastBlockBelowTimestamp = async (timeStamp) => {
        const blockFilterParams = {
            [metaStore.Blocks.filter.timestamp]: `0:${timeStamp}`,
            [metaStore.Blocks.filter.sort]: metaStore.Blocks.sortBy.timestampDesc,
            [metaStore.Blocks.filter.limit]: 1,
        };
        const blocks = await this.getBlocks(blockFilterParams);
        return firstOrNull(blocks);
    };

    getLastBlock = async () => {
        const blockFilterParams = {
            [metaStore.Blocks.filter.sort]: metaStore.Blocks.sortBy.heightDesc,
            [metaStore.Blocks.filter.limit]: 1,
        };
        const blocks = await this.getBlocks(blockFilterParams);
        return firstOrNull(blocks);
    };

    getBlocksBetweenHeight = async (fromHeight, toHeight, limit) => {
        const blockFilterParams = {
            [metaStore.Blocks.filter.height]: `${fromHeight}:${toHeight}`,
            [metaStore.Blocks.filter.limit]: limit,
        };
        return await this.getBlocks(blockFilterParams);
    };

    getBlockAtHeight = async (height) => {
        const blockFilterParams = {
            [metaStore.Blocks.filter.height]: height,
        };
        const blocks = await this.getBlocks(blockFilterParams);
        return firstOrNull(blocks);
    };
}

module.exports = LiskServiceRepository;