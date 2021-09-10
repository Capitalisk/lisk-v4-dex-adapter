const HttpClient = require('./client')
const metaStore = require('./meta')
class LiskServiceRepository {

    constructor(config) {
        this.liskServiceClient = new HttpClient(config)
    }

    /**
     * For getting data at given path, with given filter params
     * @param metaStorePath - Meta store path to find the data (refer to meta.js)
     * @param filterParams - filter param object (key-value pairs)
     * @returns {Promise<*>}
     */

    get = async (metaStorePath, filterParams = {}) => {
        const response = await this.liskServiceClient.get(metaStorePath, filterParams)
        return response.data
    }

    post = async (metaStorePath, payload = {}) => {
        const response = await this.liskServiceClient.post(metaStorePath, payload)
        return response.data
    }

    postTransaction = async (payload) => await this.post(metaStore.Transactions.path, payload)

    getNetworkStatus = async () => await this.get('/api/v2/network/status')

    getNetworkStats = async () => await this.get('/api/v2/network/statistics')

    getFees = async () => await this.get('/api/v2/fees')

    getAccounts = async (filterParams) => await this.get(metaStore.Accounts.path, filterParams)

    getTransactions = async (filterParams) => await this.get(metaStore.Transactions.path, filterParams)

    getBlocks = async (filterParams) => await this.get(metaStore.Blocks.path, filterParams)
}

module.exports = LiskServiceRepository
