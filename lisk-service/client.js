const axios = require('axios');

class HttpClient {

    static HttpGetRequestFn = (path, params) => (baseUrl) => axios.get(`${baseUrl}${path}`, {params});
    static HttpPostRequestFn = (path, payload) => (baseUrl) => axios.post(`${baseUrl}${path}`, payload);

    constructor(config) {
        this.baseUrl = config.baseUrl;
        this.fallbacks = config.fallbacks;
        this.logger = config.logger
    }

    tryWithFallback = async (requestFn) => {
        for (const fallback of this.fallbacks) {
            try {
                return await requestFn(fallback)
            } catch (e) {
                this.logger.warn(`Failed to process data from fallback ${fallback}, trying next fallback`)
            }
        }
        return null
    }

    get = async (path, params) => {
        const getReqFn = HttpClient.HttpGetRequestFn(path, params)
        try {
            return await getReqFn(this.baseUrl)
        } catch (err) {
            this.logger.warn(`Failed to get data from ${this.baseUrl}, trying fallbacks in given order`)
            const response = await this.tryWithFallback(getReqFn)
            if (response) {
                return response
            }
            throw err
        }
    }

    post = async (path, payload) => {
        const postReqFn = HttpClient.HttpPostRequestFn(path, payload)
        try {
            return await postReqFn(this.baseUrl)
        } catch (err) {
            this.logger.warn(`Failed to get data from ${this.baseUrl}, trying fallbacks in the given order`)
            const response = await this.tryWithFallback(postReqFn)
            if (response) {
                return response
            }
            throw err
        }
    }
}

module.exports = HttpClient
