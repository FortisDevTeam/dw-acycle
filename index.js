const cron = require('node-cron');
const express = require('express');
require('dotenv').config();

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const  { TextEncoder, TextDecoder } = require('util');
require('dotenv').config();

const defaultPrivateKey = process.env.PRIVATE_KEY;
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('https://testnet.telos.caleos.io:443', { fetch });

const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });


// import { setfreeze, recyclebyaid, stakegiveout } from "./eos-action.js"
// const { setfreeze, recyclebyaid, stakegiveout } = require("./eos-action.js");

app = express()

console.log("program executing");

cron.schedule('0 1 * * *', async function() {
    console.log('running a task` every second');
    try {
        await setfreeze(0,3);
        await recyclebyaid(0);
        await stakegiveout(0,0);
    } catch(exp) {
        console.log("Something Wrong");
        console.log(exp);
    }
})

app.listen(process.env.PORT)

async function setfreeze(config_id, freeze_level) {

    try {
        const result = await api.transact({
            actions: [{
              account: process.env.CONTRACT_NAME,
              name: 'setfreeze',
              authorization: [{
                actor: process.env.ACTOR_NAME,
                permission: 'active',
              }],
              data: {
                config_id: config_id,
                freeze_level: freeze_level,
              },
            }]
          },
          {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        //   console.dir(result);
        console.log("setfreeze SUCCESS with freeze_level = ", freeze_level);
    } catch (exp) {
        console.log("setfreeze ran into error");
        // console.log(exp);
    }

}

async function recyclebyaid(auction_id) {
    try {
        const result = await api.transact({
            actions: [{
              account: process.env.CONTRACT_NAME,
              name: 'recyclebyaid',
              authorization: [{
                actor: process.env.ACTOR_NAME,
                permission: 'active',
              }],
              data: {
                auction_id: auction_id,
              },
            }]
          }, {
            blocksBehind: 3,
            expireSeconds: 30,
          });
        //   console.dir(result);
        console.log("recyclebyaid SUCCESS with auction_id = ", auction_id)
    } catch(exp) {
        console.log("recyclebyaid ran into error");
        // console.log(exp);
    }
}

async function stakegiveout(auction_id, cycle_count) {
    try {
        const result = await api.transact({
            actions: [{
              account: process.env.CONTRACT_NAME,
              name: 'stakegiveout',
              authorization: [{
                actor: process.env.ACTOR_NAME,
                permission: 'active',
              }],
              data: {
                auction_id: auction_id,
                auction_cycle: cycle_count,
              },
            }]
          }, {
            blocksBehind: 3,
            expireSeconds: 30,
          });
        //   console.dir(result);
        console.log("stakegiveout SUCCESS with auction_id = ", auction_id);
    } catch(exp) {
        console.log("stakegiveout ran into error");
        // console.log(exp)
    }
}