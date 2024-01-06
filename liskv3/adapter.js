'use strict';

const {
  getBase32AddressFromPublicKey,
} = require('@liskhq/lisk-cryptography');

const {
  cryptography: liskCryptography,
  transactions: liskTransactions
} = require('@liskhq/lisk-client');

const shuffle = require('lodash.shuffle');

const {toBuffer} = require('../common/utils');
const {InvalidActionError, multisigAccountDidNotExistError, blockDidNotExistError, accountWasNotMultisigError, accountDidNotExistError, transactionBroadcastError} = require('./errors');
const LiskServiceRepository = require('../lisk-service/repository');
const {blockMapper, transactionMapper} = require('./mapper');
const packageJSON = require('../package.json');

const DEFAULT_MODULE_ALIAS = 'lisk_v4_dex_adapter';

const MODULE_BOOTSTRAP_EVENT = 'bootstrap';

const notFound = (err) => err && err.response && err.response.status === 404;

const tokenTransferSchema = {
  $id: '/lisk/transferParams',
  title: 'Transfer transaction params',
  type: 'object',
  required: ['tokenID', 'amount', 'recipientAddress', 'data'],
  properties: {
    tokenID: {
      dataType: 'bytes',
      fieldNumber: 1,
      minLength: 8,
      maxLength: 8,
    },
    amount: {
      dataType: 'uint64',
      fieldNumber: 2,
    },
    recipientAddress: {
      dataType: 'bytes',
      fieldNumber: 3,
      format: 'lisk32',
    },
    data: {
      dataType: 'string',
      fieldNumber: 4,
      minLength: 0,
      maxLength: 64,
    },
  },
};

class LiskV3DEXAdapter {
    constructor({alias, config = {}, logger = console} = {config: {}, logger: console}) {
        this.alias = alias || DEFAULT_MODULE_ALIAS;
        this.logger = logger;
        this.dexWalletAddress = config.dexWalletAddress;
        this.chainSymbol = config.chainSymbol || 'lsk';
        this.liskServiceRepo = new LiskServiceRepository({config, logger});

        this.transactionMapper = (transaction) => {
            let sanitizedTransaction = {
              ...transaction,
              signatures: this.dexMultisigPublicKeys
                .map((publicKey, index) => {
                  const signerAddress = getBase32AddressFromPublicKey(toBuffer(publicKey), this.chainSymbol);
                  return {signerAddress, publicKey, signature: transaction.signatures[index]};
                })
                .filter(signaturePacket => signaturePacket.signature)
            };
            return transactionMapper(sanitizedTransaction);
        };

        this.MODULE_BOOTSTRAP_EVENT = MODULE_BOOTSTRAP_EVENT;
    }

    get dependencies() {
        return ['app'];
    }

    get info() {
        return {
            author: packageJSON.author,
            version: packageJSON.version,
            name: packageJSON.name,
        };
    }

    get events() {
        return [MODULE_BOOTSTRAP_EVENT];
    }

    get actions() {
        return {
            getStatus: {handler: () => ({version: packageJSON.version})},
            getMultisigWalletMembers: {handler: (action) => this.getMultisigWalletMembers(action)},
            getMinMultisigRequiredSignatures: {handler: (action) => this.getMinMultisigRequiredSignatures(action)},
            getOutboundTransactions: {handler: (action) => this.getOutboundTransactions(action)},
            getInboundTransactionsFromBlock: {handler: (action) => this.getInboundTransactionsFromBlock(action)},
            getOutboundTransactionsFromBlock: {handler: (action) => this.getOutboundTransactionsFromBlock(action)},
            getMaxBlockHeight: {handler: (action) => this.getMaxBlockHeight(action)},
            getBlocksBetweenHeights: {handler: (action) => this.getBlocksBetweenHeights(action)},
            getBlockAtHeight: {handler: (action) => this.getBlockAtHeight(action)},
            postTransaction: {handler: (action) => this.postTransaction(action)},
        };
    }

    isMultisigAccount(accountAuth) {
      return accountAuth.numberOfSignatures > 0;
    }

    async getMultisigWalletMembers({params: {walletAddress}}) {
        try {
            const accountAuth = await this.liskServiceRepo.getAuth(walletAddress);
            if (accountAuth) {
                if (!this.isMultisigAccount(accountAuth)) {
                    throw new InvalidActionError(accountWasNotMultisigError, `Account with address ${walletAddress} is not a multisig account`);
                }
                return accountAuth.optionalKeys.map((publicKey) => getBase32AddressFromPublicKey(toBuffer(publicKey), this.chainSymbol));
            }
            throw new InvalidActionError(multisigAccountDidNotExistError, `Error getting multisig account with address ${walletAddress}`);
        } catch (err) {
            if (err instanceof InvalidActionError) {
                throw err;
            }
            throw new InvalidActionError(multisigAccountDidNotExistError, `Error getting multisig account with address ${walletAddress}`, err);
        }
    }

    async getMinMultisigRequiredSignatures({params: {walletAddress}}) {
        try {
            const accountAuth = await this.liskServiceRepo.getAuth(walletAddress);
            if (accountAuth) {
                if (!this.isMultisigAccount(accountAuth)) {
                    throw new InvalidActionError(accountWasNotMultisigError, `Account with address ${walletAddress} is not a multisig account`);
                }
                return accountAuth.numberOfSignatures;
            }
            throw new InvalidActionError(multisigAccountDidNotExistError, `Error getting multisig account with address ${walletAddress}`);
        } catch (err) {
            if (err instanceof InvalidActionError) {
                throw err;
            }
            throw new InvalidActionError(multisigAccountDidNotExistError, `Error getting multisig account with address ${walletAddress}`, err);
        }
    }

    async getOutboundTransactions({params: {walletAddress, fromTimestamp, limit, order}}) {
        try {
            const transactions = await this.liskServiceRepo.getOutboundTransactions(walletAddress, fromTimestamp, limit, order);
            return transactions.map(this.transactionMapper);
        } catch (err) {
            if (notFound(err)) {
                return [];
            }
            throw new InvalidActionError(accountDidNotExistError, `Error getting outbound transactions with account address ${walletAddress}`, err);
        }
    }

    async getInboundTransactionsFromBlock({params: {walletAddress, blockId}}) {
        try {
            const transactions = await this.liskServiceRepo.getInboundTransactionsFromBlock(walletAddress, blockId);
            return transactions.map(this.transactionMapper);
        } catch (err) {
            if (notFound(err)) {
                return [];
            }
            throw new InvalidActionError(accountDidNotExistError, `Error getting inbound transactions with account address ${walletAddress}`, err);
        }
    }

    async getOutboundTransactionsFromBlock({params: {walletAddress, blockId}}) {
        try {
            const transactions = await this.liskServiceRepo.getOutboundTransactionsFromBlock(walletAddress, blockId);
            return transactions.map(this.transactionMapper);
        } catch (err) {
            if (notFound(err)) {
                return [];
            }
            throw new InvalidActionError(accountDidNotExistError, `Error getting outbound transactions with account address ${walletAddress}`, err);
        }
    }

    async getMaxBlockHeight() {
        try {
            const block = await this.liskServiceRepo.getLastBlock();
            if (block) {
                return block.height;
            }
            throw new InvalidActionError(blockDidNotExistError, 'Error getting block at max height');
        } catch (err) {
            if (err instanceof InvalidActionError) {
                throw err;
            }
            throw new InvalidActionError(blockDidNotExistError, 'Error getting block at max height', err);
        }
    }

    async getBlocksBetweenHeights({params: {fromHeight, toHeight, limit}}) {
        try {
            const blocks = await this.liskServiceRepo.getBlocksBetweenHeights(fromHeight, toHeight, limit);
            return blocks.map(blockMapper);
        } catch (err) {
            if (notFound(err)) {
                return [];
            }
            throw new InvalidActionError(blockDidNotExistError, `Error getting blocks between heights ${fromHeight} - ${toHeight}`, err);
        }
    }

    async getBlockAtHeight({params: {height}}) {
        try {
            const block = await this.liskServiceRepo.getBlockAtHeight(height);
            if (block) {
                return blockMapper(block);
            }
            throw new InvalidActionError(blockDidNotExistError, `Error getting block at height ${height}`);
        } catch (err) {
            if (err instanceof InvalidActionError) {
                throw err;
            }
            throw new InvalidActionError(blockDidNotExistError, `Error getting block at height ${height}`, err);
        }
    }

    async postTransaction({params: {transaction}}) {
        let selectedSignatures;

        if (transaction.signatures.length) {
            selectedSignatures = [
                transaction.signatures[0],
                ...shuffle(transaction.signatures.slice(1)).slice(0, this.dexNumberOfSignatures - 1)
            ];
        } else {
            selectedSignatures = [];
        }

        let publicKeySignatures = {};
        for (let signaturePacket of selectedSignatures) {
            publicKeySignatures[signaturePacket.publicKey] = signaturePacket;
        }

        const signatures = this.dexMultisigPublicKeys.map((memberPublicKey) => {
            let signaturePacket = publicKeySignatures[memberPublicKey];
            return Buffer.from(signaturePacket ? signaturePacket.signature : '', 'hex');
        });

        let signedTxn = {
            module: 'token',
            command: 'transfer',
            nonce: BigInt(transaction.nonce),
            fee: BigInt(transaction.fee),
            senderPublicKey: Buffer.from(transaction.senderPublicKey, 'hex'),
            signatures,
            params: {
                tokenID: Buffer.from(transaction.tokenID, 'hex'),
                recipientAddress: liskCryptography.address.getAddressFromLisk32Address(transaction.recipientAddress),
                amount: BigInt(transaction.amount),
                data: transaction.message
            }
        };

        try {
            let binaryTxn = liskTransactions.getBytes(signedTxn, tokenTransferSchema);
            let payloadTxn = binaryTxn.toString('hex');
            let response = await this.liskServiceRepo.postTransaction(payloadTxn);

            if (!response || !response.transactionID) {
                throw new Error('Invalid transaction response');
            }
        } catch (err) {
            const baseMessage = err.message ? ` - ${err.message}` : '';
            throw new InvalidActionError(transactionBroadcastError, `Error broadcasting transaction to the lisk network${baseMessage}`, err);
        }
    }

    async load(channel) {
        if (!this.dexWalletAddress) {
            throw new Error('Dex wallet address not provided in the config');
        }
        this.channel = channel;

        await this.channel.invoke('app:updateModuleState', {
            [this.alias]: {},
        });

        await channel.publish(`${this.alias}:${MODULE_BOOTSTRAP_EVENT}`);

        const accountAuth = await this.liskServiceRepo.getAuth(this.dexWalletAddress);
        this.dexMultisigPublicKeys = Array.from(new Set([...accountAuth.mandatoryKeys, ...accountAuth.optionalKeys]));
        this.dexNumberOfSignatures = accountAuth.numberOfSignatures;
    }

    async unload() {}
}

module.exports = LiskV3DEXAdapter;
