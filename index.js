import { AptosClient, AptosAccount, CoinClient } from "aptos";
import { Buffer } from "buffer";
import { config } from "./config.js";
import consoleStamp from 'console-stamp';
import fs from 'fs'

consoleStamp(console, { format: ':date(HH:MM:ss)' });

const pk = config.mainAccountPrivateKey.slice(2, config.mainAccountPrivateKey.length);
const client = new AptosClient(config.nodeUrl);
const coinClient = new CoinClient(client)
const mainAccount = new AptosAccount(Uint8Array.from(Buffer.from(pk, 'hex')));
const generateRandomAmount = (min, max) => Math.random() * (max - min) + min;
const timeout = ms => new Promise(res => setTimeout(res, ms))


async function sendTransaction(sender, payload, nonce) {
    try {
        const txnRequest = await client.generateTransaction(sender.address(), payload, {
            gas_unit_price: config.gasUnitPrice,
            max_gas_amount: config.maxGasAmount,
            sequence_number: nonce
        });

        const signedTxn = await client.signTransaction(sender, txnRequest);
        const transactionRes = await client.submitTransaction(signedTxn);

        return await client.waitForTransactionWithResult(transactionRes.hash, { checkSuccess: true })
    } catch (err) {
        try {
            console.log('[ERROR]', JSON.parse(err?.message).message)
        } catch { console.log('[ERROR]', err.message) }
        await timeout(60000)
    }
}

async function sendAptos(from, to, amount) {
    amount = amount.toFixed(7);
    console.log(`Sending ${amount} APT to ${to.address()}`);

    return await sendTransaction(from, {
        type: "entry_function_payload",
        function: "0x1::aptos_account::transfer",
        type_arguments: [],
        arguments: [to.address().hex(), (amount * 100000000).toFixed(0)]
    })
}

async function approveNFT(sender, label) {
    console.log(`Approving ${label}`);

    return await sendTransaction(sender, {
        type: "entry_function_payload",
        function: "0x3::token::create_collection_script",
        type_arguments: [],
        arguments: [
            label,
            "Martian Testnet NFT",
            "https://aptos.dev",
            "9007199254740991",
            [false, false, false]
        ],
    }, generator.next().value)
}

async function mintNFT(sender, label, name) {
    console.log(`Minting ${name}`);

    return await sendTransaction(sender, {
        type: "entry_function_payload",
        function: "0x3::token::create_token_script",
        type_arguments: [],
        arguments: [
            label,
            name,
            "OG Martian",
            "1",
            "9007199254740991",
            "https://gateway.pinata.cloud/ipfs/QmXiSJPXJ8mf9LHijv6xFH1AtGef4h8v5VPEKZgjR4nzvM",
            sender.address(),
            "0",
            "0",
            [!1, !1, !1, !1, !1],
            [],
            [],
            []
        ]
    }, generator.next().value)
}

async function nftCreationHandler(sender) {
    let number = (Math.floor(9e4 * Math.random()) + 1e4).toString();
    let label = "Martian Testnet" + number;
    let name = "Martian NFT #" + number;

    await approveNFT(sender, label)
    await mintNFT(sender, label, name)
}

async function checkBalance(account) {
    try {
        let balance = Number(await coinClient.checkBalance(account)) / 100000000
        console.log(`Balance ${balance} APT`);
        return balance
    } catch (err) {
        try {
            console.log('[ERROR]', JSON.parse(err?.message).message)
        } catch {
            console.log('[ERROR]', err.message)
        }
        await timeout(60000)
    }
    return 1
}

function savePrivateKey(privateKey) {
    fs.appendFileSync("keys.txt", `${privateKey}\n`, "utf8");
}

let generator;

function* nonceMaker(i) {
    let nonce = i;
    while (true) {
        yield nonce++;
    }
}


(async () => {
    while (await checkBalance(mainAccount) > config.aptosAmountPerAccount.max) {
        const sandwich = new AptosAccount();
        let randomAmount = generateRandomAmount(config.aptosAmountPerAccount.min, config.aptosAmountPerAccount.max)
        await sendAptos(mainAccount, sandwich, randomAmount);

        const nftAccount = new AptosAccount();
        savePrivateKey(nftAccount.toPrivateKeyObject().privateKeyHex)
        await sendAptos(sandwich, nftAccount, randomAmount - generateRandomAmount(0.003, 0.005));

        generator = nonceMaker(0);
        await Promise.all(Array(config.nftCountPerAccount).fill(0).map(() => nftCreationHandler(nftAccount)))

        console.log(`Check NFTs: https://explorer.aptoslabs.com/account/${nftAccount.address()}/tokens`);
        console.log("-".repeat(130));
    }
})()