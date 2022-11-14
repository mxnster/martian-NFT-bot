export const config = {
    mainAccountPrivateKey: '',
    nftCountPerAccount: 3,
    aptosAmountPerAccount: { min: 0.03, max: 0.05 }, // increase the amount in proportion to NFT count
    gasUnitPrice: 100,
    maxGasAmount: 10000, // increase gas for faster transactions, strictly not recommended
    nodeUrl: "https://fullnode.testnet.aptoslabs.com"
}