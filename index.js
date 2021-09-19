const cron = require('node-cron');
const express = require('express');
require('dotenv').config();

const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const  { TextEncoder, TextDecoder } = require('util');

const defaultPrivateKey = process.env.PRIVATE_KEY;
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc(process.env.RPC, { fetch });

const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });


// import { setfreeze, recyclebyaid, stakegiveout } from "./eos-action.js"
// const { setfreeze, recyclebyaid, stakegiveout } = require("./eos-action.js");

app = express()
// app.listen(process.env.PORT);

console.log("program executing");

auctions = [
  {
    auctionid: 0,
    stakecycle: 107,
    auctioncycle: 23,
  }
];



cron.schedule(process.env.CRON, async function() {
    console.log('running a task` every second');
    try {
        if(process.env.ACTIVE == "TRUE") {
          for(let i=0; i<auctions.length; i++){
            await setfreeze(auctions[i].auctionid,3);
            await new Promise(resolve => setTimeout(resolve, process.env.WAIT_AUCTION_CYCLE));
  
            console.log("recycle auction with auction id ", auctions[i].auctionid);
            await recyclebyaid(auctions[i].auctionid);
            await new Promise(resolve => setTimeout(resolve, process.env.WAIT_STAKE_CYCLE));
  
            console.log("stake giveout with auction id ", auctions[i].auctionid, " and cycle count ", auctions[i].stakecycle);
            await stakegiveout(auctions[i].auctionid, auctions[i].auctioncycle);
            await new Promise(resolve => setTimeout(resolve, process.env.WAIT_OPEN));
            
            await setfreeze(auctions[i].auctionid,0);
  
            auctions[i].auctioncycle += 1;
            auctions[i].stakecycle += 1;
          }
        } else {
          console.log("not active");
        }
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
                permission: process.env.PERMISSION,
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
        console.log(exp);
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
                permission: process.env.PERMISSION,
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
        console.log(exp);
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
                permission: process.env.PERMISSION,
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
        console.log("stakegiveout SUCCESS with auction_id = ", auction_id, " and cycle count ", cycle_count);
    } catch(exp) {
        console.log("stakegiveout ran into error");
        console.log(exp)
    }
}