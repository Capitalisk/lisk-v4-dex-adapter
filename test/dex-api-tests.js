const assert = require('assert');

const LiskV3DEXAdapterModule = require('../index');
const Channel = require('./utils/channel');
const AppModuleMock = require('./utils/app');
const {wait, computeDEXTransactionId} = require('../common/utils');

const {
  cryptography: liskCryptography,
  transactions: liskTransactions
} = require('@liskhq/lisk-client');

const toBuffer = (data) => Buffer.from(data, 'hex');

// This test suite can be adapted to check whether or not a custom chain module is compatible with Lisk DEX.
// All the boilerplate can be modified except the 'it' blocks where the assertions are made.
// If a module passes all the test case cases in this file, then it is compatible with Lisk DEX.

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

describe('DEX API tests', async () => {
    let adapterModule;
    let bootstrapEventTriggered;
    let chainChangeEvents = [];

    before(async () => {
        adapterModule = new LiskV3DEXAdapterModule({
            config: {
                dexWalletAddress: 'lskdx59zzxpdrpnqjhjt43hq3225fc9umoq7u7e4g',
                serviceURL: 'https://service.lisk.com'
            },
            logger: {
                info: () => {
                },
                // info: (...args) => console.info.apply(console, args),
                debug: () => {
                },
                // debug: (...args) => console.debug.apply(console, args),
                warn: (...args) => console.warn.apply(console, args),
                error: (...args) => console.error.apply(console, args),
            },
        });

        this.channel = new Channel({
            modules: {
                app: new AppModuleMock(),
            },
        });

        this.channel.subscribe(`${adapterModule.alias}:${adapterModule.MODULE_BOOTSTRAP_EVENT}`, () => {
            bootstrapEventTriggered = true;
        });

        await adapterModule.load(this.channel);
    });

    after(async () => {
        await adapterModule.unload();
    });

    describe('module state', () => {

        it('should expose an info property', () => {
            let moduleInfo = adapterModule.info;
            assert(moduleInfo.author);
            assert(moduleInfo.version);
            assert(moduleInfo.name);
        });

        it('should expose an alias property', () => {
            assert(adapterModule.alias);
        });

        it('should expose an events property', () => {
            let events = adapterModule.events;
            assert(events.includes('bootstrap'));
        });

    });

    describe('module actions', async () => {

        describe('getMultisigWalletMembers action', async () => {

            const multiSigWalletAddress = 'lskdx59zzxpdrpnqjhjt43hq3225fc9umoq7u7e4g';

            it('should return an array of member addresses', async () => {
                let walletMembers = await adapterModule.actions.getMultisigWalletMembers.handler({
                    params: {
                        walletAddress: multiSigWalletAddress,
                    },
                });

                const memberAddessList = [
                  'lsk7fzrxa3xe93cccvzaxkan3juuy3n8cg4xnaqrk',
                  'lskcd3auuxumqomc3kx84o2dufsbxsnbd5xqzboxr',
                  'lskeyk3pxgu8u69kzf4ft83xdpdkx2cwpp77e7exp',
                  'lskfb4pkbu36sv6dyogjpbq6mekn3tutpg6odefp9',
                  'lskgjgwueod5y4dcj6uoqynwyfwxx434do72v72za',
                  'lsktkapj8sefwa4dc5fu9do2gtcj6d352h4vkt2bb',
                  'lskwgu9u48tro29jp6omyom8cddtwdwz2pfrbujx4',
                  'lskygvzo6r4s6f3h3sq8jo5asrdbc7n5mes92fatt'
                ];

                // Must be an array of wallet address strings.
                assert.equal(JSON.stringify(walletMembers.sort()), JSON.stringify(memberAddessList.sort()));
            });

            it('should throw a MultisigAccountDidNotExistError if the multisig wallet address does not exist', async () => {
                let caughtError = null;
                try {
                    await adapterModule.actions.getMultisigWalletMembers.handler({
                        params: {
                            walletAddress: 'ldpos6312b77c6ca4233141835eb37f8f33a45f18d50f',
                        },
                    });
                } catch (error) {
                    caughtError = error;
                }
                assert.notEqual(caughtError, null);
                assert.equal(caughtError.type, 'InvalidActionError');
                assert.equal(caughtError.name, 'MultisigAccountDidNotExistError');
            });

        });

        describe('getMinMultisigRequiredSignatures action', async () => {

            const multiSigWalletAddress = 'lskdx59zzxpdrpnqjhjt43hq3225fc9umoq7u7e4g';

            it('should return the number of required signatures', async () => {
                let requiredSignatureCount = await adapterModule.actions.getMinMultisigRequiredSignatures.handler({
                    params: {
                        walletAddress: multiSigWalletAddress,
                    },
                });
                assert.equal(requiredSignatureCount, 4);
            });

            it('should throw an AccountDidNotExistError if the wallet address does not exist', async () => {
                let caughtError = null;
                try {
                    await adapterModule.actions.getMinMultisigRequiredSignatures.handler({
                        params: {
                            walletAddress: 'ldpos6312b77c6ca4233141835eb37f8f33a45f18d50f',
                        },
                    });
                } catch (error) {
                    caughtError = error;
                }
                assert.notEqual(caughtError, null);
                assert.equal(caughtError.type, 'InvalidActionError');
                assert.equal(caughtError.name, 'MultisigAccountDidNotExistError');
            });

            it('should throw an AccountWasNotMultisigError if the account is not a multisig wallet', async () => {
                let caughtError = null;
                try {
                    await adapterModule.actions.getMinMultisigRequiredSignatures.handler({
                        params: {
                            walletAddress: 'lskx5t5nc997jczxn6s7ggoqtwcdbgs3u5r8q5b42',
                        },
                    });
                } catch (error) {
                    caughtError = error;
                }
                assert.notEqual(caughtError, null);
                assert.equal(caughtError.type, 'InvalidActionError');
                assert.equal(caughtError.name, 'AccountWasNotMultisigError');
            });

        });

        describe('getOutboundTransactions action', async () => {

            const senderWalletAddress = 'lskrhqvvvsh9st2e9z7rk9xoecwwqso395fg5pfnb';

            it('should return an array of transactions sent from the specified walletAddress', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactions.handler({
                    params: {
                        walletAddress: senderWalletAddress,
                        fromTimestamp: 0,
                        limit: 3,
                    },
                });

                assert(Array.isArray(transactions));
                assert.equal(transactions.length, 3);
                assert.equal(transactions[0].senderAddress, senderWalletAddress);
                assert.equal(typeof transactions[0].message, 'string');
                assert.equal(transactions[1].senderAddress, senderWalletAddress);
                assert.equal(typeof transactions[1].message, 'string');
                assert.equal(transactions[2].senderAddress, senderWalletAddress);
                assert.equal(typeof transactions[2].message, 'string');

                for (let txn of transactions) {
                    assert.equal(typeof txn.id, 'string');
                    assert.equal(typeof txn.message, 'string');
                    assert.equal(typeof txn.amount, 'string');
                    assert.equal(Number.isNaN(Number(txn.amount)), false);
                    assert.equal(Number.isInteger(txn.timestamp), true);
                }
            });

            it('should return transactions which are greater than fromTimestamp by default in asc order', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactions.handler({
                    params: {
                        walletAddress: senderWalletAddress,
                        fromTimestamp: 0,
                        limit: 3,
                    },
                });

                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 3);
                assert.equal(transactions[0].senderAddress, senderWalletAddress);
                assert.equal(transactions[0].timestamp, 1702420100);
                assert.equal(transactions[1].senderAddress, senderWalletAddress);
                assert.equal(transactions[1].timestamp, 1702421370);
                assert.equal(transactions[2].senderAddress, senderWalletAddress);
                assert.equal(transactions[2].timestamp, 1702506060);
            });

            it('should return transactions which are lower than or equal to fromTimestamp when order is desc', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactions.handler({
                    params: {
                        walletAddress: senderWalletAddress,
                        fromTimestamp: 1702421370,
                        limit: 2,
                        order: 'desc',
                    },
                });

                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 2);
                assert.equal(transactions[0].senderAddress, senderWalletAddress);
                assert.equal(transactions[0].timestamp, 1702421370);
                assert.equal(transactions[1].senderAddress, senderWalletAddress);
                assert.equal(transactions[1].timestamp, 1702420100);
            });

            it('should limit the number of transactions based on the specified limit', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactions.handler({
                    params: {
                        walletAddress: senderWalletAddress,
                        fromTimestamp: 0,
                        limit: 1,
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 1);
                assert.equal(transactions[0].senderAddress, senderWalletAddress);
                assert.equal(transactions[0].message, '');
            });

            it('should return an empty array if no transactions can be matched', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactions.handler({
                    params: {
                        walletAddress: senderWalletAddress,
                        fromTimestamp: 3434323432,
                        limit: 100,
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 0);
            });

        });

        describe('getInboundTransactionsFromBlock action', async () => {

            it('should return an array of transactions sent to the specified walletAddress', async () => {
                let recipientAddress = 'lskdfgve6v7h7x3mn84c39m9esmjabtj5yv9j9hzk';
                let transactions = await adapterModule.actions.getInboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: recipientAddress,
                        blockId: '3dd17c521eed2676271ec28b83795abe815243aea281c534e8681b57e62ea9f1',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 1);
                let txn = transactions[0];

                assert.equal(typeof txn.id, 'string');
                assert.equal(typeof txn.message, 'string');
                assert.equal(typeof txn.amount, 'string');
                assert.equal(Number.isNaN(Number(txn.amount)), false);
                assert.equal(Number.isInteger(txn.timestamp), true);
                assert.equal(typeof txn.senderAddress, 'string');
                assert.equal(typeof txn.recipientAddress, 'string');

                assert.equal(transactions[0].recipientAddress, recipientAddress);
                assert.equal(transactions[0].message, '');
            });

            it('should return an empty array if no transactions match the specified blockId', async () => {
                let recipientAddress = 'lskdfgve6v7h7x3mn84c39m9esmjabtj5yv9j9hzk';
                let transactions = await adapterModule.actions.getInboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: recipientAddress,
                        blockId: '963fa8fc2ba0c9bd24f4fc0b3470f0abdca6341ef5469052f083597f87f3e87b',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 0);
            });

            it('should return an empty array if no transactions match the specified walletAddress', async () => {
                let recipientAddress = 'ldpos5f0bc55450657f7fcb188e90122f7e4cee894199';
                let transactions = await adapterModule.actions.getInboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: 'lsksag7kga5pcsppyfw3zv48cy68p79nkmpdk2qo3',
                        blockId: '3dd17c521eed2676271ec28b83795abe815243aea281c534e8681b57e62ea9f1',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 0);
            });
        });

        describe('getOutboundTransactionsFromBlock action', async () => {

            it('should return an array of transactions sent from the specified walletAddress', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: 'lskrhqvvvsh9st2e9z7rk9xoecwwqso395fg5pfnb',
                        blockId: '3dd17c521eed2676271ec28b83795abe815243aea281c534e8681b57e62ea9f1',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 1);

                for (let txn of transactions) {
                    assert.equal(typeof txn.id, 'string');
                    assert.equal(typeof txn.message, 'string');
                    assert.equal(typeof txn.amount, 'string');
                    assert.equal(Number.isNaN(Number(txn.amount)), false);
                    assert.equal(Number.isInteger(txn.timestamp), true);
                    assert.equal(typeof txn.senderAddress, 'string');
                    assert.equal(typeof txn.recipientAddress, 'string');
                }

                assert.equal(transactions[0].senderAddress, 'lskrhqvvvsh9st2e9z7rk9xoecwwqso395fg5pfnb');
                assert.equal(transactions[0].message, '');
            });

            it('should return transactions with a valid signatures property if transaction is from a multisig wallet', async () => {
                const multiSigWalletAddress = 'lskrhqvvvsh9st2e9z7rk9xoecwwqso395fg5pfnb';
                let transactions = await adapterModule.actions.getOutboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: multiSigWalletAddress,
                        blockId: '3dd17c521eed2676271ec28b83795abe815243aea281c534e8681b57e62ea9f1',
                    },
                });
                assert(Array.isArray(transactions));
                assert.equal(transactions.length, 1);
                let txn = transactions[0];

                assert.equal(typeof txn.id, 'string');
                assert.equal(typeof txn.message, 'string');
                assert.equal(typeof txn.amount, 'string');
                assert(!Number.isNaN(Number(txn.amount)));
                assert(Number.isInteger(txn.timestamp));
                assert(Array.isArray(txn.signatures));
                for (let signature of txn.signatures) {
                    assert.notEqual(signature, null);
                    assert.equal(typeof signature.signerAddress, 'string');
                }
                assert.equal(typeof txn.senderAddress, 'string');
                assert.equal(typeof txn.recipientAddress, 'string');
            });

            it('should return an empty array if no transactions match the specified blockId', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: 'lskrhqvvvsh9st2e9z7rk9xoecwwqso395fg5pfnb',
                        blockId: '963fa8fc2ba0c9bd24f4fc0b3470f0abdca6341ef5469052f083597f87f3e87b',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 0);
            });

            it('should return an empty array if no transactions match the specified walletAddress', async () => {
                let transactions = await adapterModule.actions.getOutboundTransactionsFromBlock.handler({
                    params: {
                        walletAddress: 'lskhoeyvtvoczuzgnompgeynoar2fyoqdq9hh2zjm',
                        blockId: '3dd17c521eed2676271ec28b83795abe815243aea281c534e8681b57e62ea9f1',
                    },
                });
                assert.equal(Array.isArray(transactions), true);
                assert.equal(transactions.length, 0);
            });
        });

        describe('getMaxBlockHeight action', async () => {

            it('should return the height of the block as an integer number', async () => {
                let height = await adapterModule.actions.getMaxBlockHeight.handler();
                assert(Number.isInteger(height));
            });

        });

        describe('getBlocksBetweenHeights action', async () => {

            it('should return blocks whose height is greater than fromHeight and less than or equal to toHeight', async () => {
                let blocks = await adapterModule.actions.getBlocksBetweenHeights.handler({
                    params: {
                        fromHeight: 23476950,
                        toHeight: 23476951,
                        limit: 100,
                    },
                });
                assert.equal(Array.isArray(blocks), true);
                assert.equal(blocks.length, 1);
                let block = blocks[0];
                assert.equal(typeof block.id, 'string');
                assert.equal(Number.isInteger(block.timestamp), true);
                assert.equal(block.height, 23476951);
            });

            it('should return blocks whose height is greater than fromHeight and less than or equal to toHeight', async () => {
                let blocks = await adapterModule.actions.getBlocksBetweenHeights.handler({
                    params: {
                        fromHeight: 14577190,
                        toHeight: 14577191,
                        limit: 1,
                    },
                });
                assert.equal(Array.isArray(blocks), true);
                assert.equal(blocks.length, 0);
            });

            it('should return an empty array if no blocks are matched', async () => {
                let blocks = await adapterModule.actions.getBlocksBetweenHeights.handler({
                    params: {
                        fromHeight: 100,
                        toHeight: 200,
                        limit: 1,
                    },
                });
                assert.equal(Array.isArray(blocks), true);
                assert.equal(blocks.length, 0);
            });
        });

        describe('getBlockAtHeight action', async () => {

            it('should expose a getBlockAtHeight action', async () => {
                let block = await adapterModule.actions.getBlockAtHeight.handler({
                    params: {
                        height: 23476951,
                    },
                });
                assert.notEqual(block, null);
                assert.equal(block.height, 23476951);
                assert.equal(Number.isInteger(block.timestamp), true);
            });

            it('should throw a BlockDidNotExistError if no block could be matched', async () => {
                let caughtError = null;
                try {
                    await adapterModule.actions.getBlockAtHeight.handler({
                        params: {
                            height: 9,
                        },
                    });
                } catch (error) {
                    caughtError = error;
                }
                assert.notEqual(caughtError, null);
                assert.equal(caughtError.type, 'InvalidActionError');
                assert.equal(caughtError.name, 'BlockDidNotExistError');
            });

        });

        describe.skip('postTransaction action', async () => {

            it('should accept a prepared (signed) transaction object as argument', async () => {
                // The format of the prepared (signed) transaction will be different depending on the
                // implementation of the chain module and the specified ChainCrypto adapter.
                // Since this is used for posting multisig transactions, the transaction will have
                // a 'signatures' property containing an array of signature objects created by the DEX.
                // The format of each signature object is flexible depending on the output of the ChainCrypto
                // adapter but it will have a 'signerAddress' property.
                // The chain module can handle the transaction and signature objects however it wants.

                let chainId = '00000000';
                let chainIdBytes = toBuffer(chainId);

                let recipientAddress = ''; // TODO

                let sharedPassphrase = ''; // TODO


                let passphrase = ''; // TODO
                let multisigWalletKeys = {
                  mandatoryKeys: [],
                  optionalKeys: []
                };
                let nonceString = '1';// TODO

                const txnData = {
                  module: 'token',
                  command: 'transfer',
                  nonce: BigInt(nonceString),
                  fee: BigInt('700000'),
                  senderPublicKey: multisigWalletKeys.optionalKeys[0],// TODO
                  signatures: [],
                  params: {
                    tokenID: toBuffer('0000000000000000'),
                    recipientAddress: liskCryptography.address.getAddressFromLisk32Address(recipientAddress),
                    amount: BigInt('20000000'),
                    data: 'testing'
                  }
                };

                let {publicKey: sharedPublicKey, privateKey: sharedPrivateKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(sharedPassphrase);
                let {publicKey: signerPublicKey, privateKey: signerPrivateKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(passphrase);

                let signedTxn = liskTransactions.signMultiSignatureTransaction(txnData, chainIdBytes, sharedPrivateKey, multisigWalletKeys, tokenTransferSchema);
                liskTransactions.signMultiSignatureTransaction(signedTxn, chainIdBytes, signerPrivateKey, multisigWalletKeys, tokenTransferSchema);

                let senderAddress = liskCryptography.address.getLisk32AddressFromPublicKey(sharedPublicKey);
                let signerAddress = liskCryptography.address.getLisk32AddressFromPublicKey(signerPublicKey);

                let preparedTxn = {
                  id: computeDEXTransactionId(senderAddress, nonceString),
                  message: signedTxn.params.data,
                  amount: signedTxn.params.amount.toString(),
                  tokenID: signedTxn.params.tokenID.toString('hex'),
                  timestamp: Date.now(),
                  senderAddress,
                  recipientAddress: liskCryptography.address.getLisk32AddressFromAddress(signedTxn.params.recipientAddress),
                  signatures: [
                    {
                      signerAddress: senderAddress,
                      publicKey: sharedPublicKey.toString('hex'),
                      signature: signedTxn.signatures[0].toString('hex')
                    }
                  ],
                  module: signedTxn.module,
                  command: signedTxn.command,
                  fee: signedTxn.fee.toString(),
                  nonce: nonceString,
                  senderPublicKey: signedTxn.senderPublicKey.toString('hex')
                };

                // The signature needs to be an object with a signerAddress property, the other
                // properties are flexible and depend on the requirements of the underlying blockchain.
                let multisigTxnSignature = {
                  signerAddress,
                  publicKey: signerPublicKey.toString('hex'),
                  signature: signedTxn.signatures[1].toString('hex')
                };

                preparedTxn.signatures.push(multisigTxnSignature);

                await adapterModule.actions.postTransaction.handler({
                    params: {
                        transaction: preparedTxn,
                    },
                });
            });

        });

    });

    describe('module events', async () => {

        it('should trigger bootstrap event after launch', async () => {
            assert(bootstrapEventTriggered);
        });

    });

});
