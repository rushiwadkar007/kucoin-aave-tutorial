const dotenv = require('dotenv').config();

const ccxt = require('ccxt');

const axios = require('axios');
const express = require("express");
const app = express();
const cors = require("cors");
const tick = async (config, kucoinClient) => {
    const { asset, base, allocation, spread } = config;
    console.log(`1. ${asset}, ${base}, ${allocation}, ${spread}`)
    const market = `${asset}/${base}`;
    console.log(`2. market ${market}`)
    const orders = await kucoinClient.fetchOpenOrders(market);
    orders.forEach(async order => {
        await kucoinClient.cancelOrder(order.id);
    });

    let aavePrice = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=aave&vs_currencies=usd')
        .then((result) => {
            // console.log(result["data"]["aave"]["usd"]);
            return result["data"]["aave"]["usd"];
        })
        .catch((error) => { return error });

    let tetherPrice = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd`)
        .then((result) => {
            return result["data"]["tether"]["usd"];
        })
        .catch((error) => { return error });

    console.log(`3. ${aavePrice}    ${tetherPrice}...prices of aave and tether`);

    const marketPrice = aavePrice / tetherPrice;

    const sellPrice = marketPrice * (1 + spread);
    const buyPrice = marketPrice * (1 - spread);

    const balances = await kucoinClient.fetchBalance()
        .then((result) => {

            return result
        })
        .catch((error) => { return error });
    const assetBalance = balances.free[asset];
    console.log(`4. AAVE Balance  ${assetBalance}`);
    const baseBalance = balances.free[base];
    console.log(`5. USDT Balance ${baseBalance}`);
    const sellVolume = assetBalance * (allocation);
    const buyVolume = (baseBalance * allocation) / marketPrice;

    await kucoinClient.createLimitSellOrder(market, sellVolume, sellPrice)
        .then((result) => { return result })
        .catch((error) => { return error });
    await kucoinClient.createLimitBuyOrder(market, buyVolume, aavePrice)
        .then((result) => { return result })
        .catch((error) => { return error });
    var today = new Date();
    console.log(

        `6. Time: ${today}
        7. New tick for ${market}...
        8. Create limit buy order for ${buyVolume}@${aavePrice}
        9. Created limit sell order for ${sellVolume}@${sellPrice}`

    )
}
const run = () => {
    const config = {
        asset: 'AAVE',
        base: 'USDT',
        allocation: 0.5,
        spread: 0.0030,
        tickInterval: 900000
    }
    // 1000 = 1 sec.
    // 6000 = 6 secs
    // 60000 = 60 secs. or 1 min
    // 600000 = 600 secs or 10 mins
    // 1.01 = 1.94 aave at apr 9 14.29
    // 0.1 = 0.192 aaave at apr 9 14.3
    // first preference spread 0.01
    const kucoinClient = new ccxt.kucoin({
        apiKey: process.env.API_KEY,
        secret: process.env.API_SECRET,
        password: process.env.PASSWORD
    });

    tick(config, kucoinClient);
    setInterval(tick, config.tickInterval, config, kucoinClient);
}


app.use(cors());

let PORT = process.env.PORT || 8080;
app.listen(PORT, () => {

    console.log(`Server running at ${PORT}...`)
    run();
});