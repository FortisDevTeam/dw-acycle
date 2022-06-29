const cron = require('node-cron')
const express = require('express')
require('dotenv').config()

const { Api, JsonRpc, RpcError } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextEncoder, TextDecoder } = require('util')

const defaultPrivateKey = process.env.PRIVATE_KEY;
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc(process.env.RPC, { fetch })

const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

// import { setfreeze, recyclebyaid, stakegiveout } from "./eos-action.js"
// const { setfreeze, recyclebyaid, stakegiveout } = require("./eos-action.js");

app = express()
// app.listen(process.env.PORT);
const ROWS_PER_PAGE = 20

console.log('program executing')

auctions = [
  {
    auctionid: 1,
  },
  {
    auctionid: 2,
  },
  {
    auctionid: 3,
  },
  {
    auctionid: 4,
  },
]

entry = null

cron.schedule(process.env.CRON, async function () {
  try {
    if (process.env.ACTIVE == 'TRUE') {
      for (let i = 0; i < auctions.length; i++) {
        // Querrying the cyclecount table
        entry = await rpc.get_table_rows({
          json: true,
          code: process.env.CONTRACT_NAME,
          scope: process.env.CONTRACT_NAME,
          table: 'cyclecount',
          limit: 1,
          lower_bound: auctions[i].auctionid,
          upper_bound: auctions[i].auctionid,
        })

        // Get auction cycle count
        auction_cycle_count = entry.rows[0].auction_cycle_count

        // Get stake cycle count
        stake_cycle_count = entry.rows[0].stake_cycle_count

        // STEP 1: Freeze the contract
        await setfreeze(auctions[i].auctionid, 3);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_AUCT)
        );

        // STEP 2: Call recyclebyaid action
        await recyclebyaid(auctions[i].auctionid);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_LOOP)
        );

        // STEP 3: Call loopstakes action
        await loopstakes(auctions[i].auctionid, auction_cycle_count)
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_STKE),
        )

        // STEP 4: Call stakegiveout action
        await stakegiveout(auctions[i].auctionid, auction_cycle_count);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_OPEN)
        );

        // STEP 5: Unfreeze
        await setfreeze(auctions[i].auctionid, 0);

      }
    } else {
      console.log('not active')
    }
  } catch (exp) {
    console.log('Something Wrong')
    console.log(exp)
  }
})

app.listen(process.env.PORT)

async function setfreeze(config_id, freeze_level) {
  try {
    const result = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "setfreeze",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              config_id: config_id,
              freeze_level: freeze_level,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    //   console.dir(result);
    console.log("setfreeze SUCCESS with freeze_level = ", freeze_level);
  } catch (exp) {
    console.log("setfreeze ran into error");
    console.log(exp);
  }
}

async function recyclebyaid(auction_id) {
  try {
    const result = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "recyclebyaid",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              auction_id: auction_id,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    //   console.dir(result);
    console.log("recyclebyaid SUCCESS with auction_id = ", auction_id);
  } catch (exp) {
    console.log("recyclebyaid ran into error");
    console.log(exp);
  }
}

async function loopstakes(auction_id, auction_cycle) {
  const stakes = await getStakesCount()
  const denominator = parseInt(process.env.LOOP_DNM)
  console.log(denominator, "   ", stakes)
  const quotient = Math.floor(stakes / denominator)
  const remainder = stakes % denominator

  console.log("quotient => ", quotient)
  console.log("remainder => ", remainder)

  console.log('stakes = ', stakes)

  for (let i = 0; i < quotient; i++) {
    await callLoopstakeAction(auction_id, auction_cycle, denominator);
    console.log("callLoopstakeAction(", auction_id, auction_cycle, denominator, ");")
  }
  await callLoopstakeAction(auction_id, auction_cycle, remainder);
  console.log("callLoopstakeAction(", auction_id, auction_cycle, remainder, ");")

  console.log('loopstakes action COMPLETED')
}

async function stakegiveout(auction_id, auction_cycle) {
  const count = await getTotalStakeCount();
  const numberOfAcceptedTokens = await getAcceptedTokensCount(auction_id);
  const denominator = process.env.STKE_DNM;
  const quotient = Math.floor(count / denominator);
  const remainder = count % denominator;
  for (let i = 0; i < numberOfAcceptedTokens; i++) {
    for (let j = 0; j < quotient; j++) {
      await callStakegiveoutAction(auction_id, auction_cycle, denominator);
    }
    await callStakegiveoutAction(auction_id, auction_cycle, remainder);
  }
}

async function callStakegiveoutAction(auction_id, auction_cycle, count) {
  try {
    const result = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "stakegiveout",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              auction_id: auction_id,
              auction_cycle: auction_cycle,
              count: count,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    console.log(
      "stakegiveout SUCCESS with auction_id = ",
      auction_id,
      " count: ",
      count
    );
  } catch (exp) {
    console.log("stakegiveout ran into error");
    console.log(exp);
  }
}

async function callLoopstakeAction(auction_id, auction_cycle, count) {
  try {
    const result = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "loopstakes",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              auction_id: auction_id,
              auction_cycle: auction_cycle,
              count: count,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    //   console.dir(result);
    console.log(
      "loopstakes SUCCESS for auction_id = ",
      auction_id,
      " count: ",
      count
    );
  } catch (exp) {
    console.log("callLoopstakeAction ran into error");
    console.log(exp);
  }
}

async function getStakesCount() {
  console.log("calling getStakesCount")
  let count = 0
  let res
  let lower_bound

  while (true) {
    res = await rpc.get_table_rows({
      json: true,
      code: process.env.CONTRACT_NAME,
      scope: process.env.CONTRACT_NAME,
      table: 'stakes',
      limit: ROWS_PER_PAGE,
      lower_bound: lower_bound
    })
    count += res.rows.length

    if (res.more) lower_bound = res.next_key
    else break
  }

  return count
}

async function getTotalStakeCount() {
  const res = await rpc.get_table_rows({
    json: true,
    code: process.env.CONTRACT_NAME,
    scope: process.env.CONTRACT_NAME,
    table: 'totalstake',
    limit: 10000000000000,
  })
  return res.rows.length
}

async function getAcceptedTokensCount(auction_id) {
  const table = await rpc.get_table_rows({
    json: true,
    code: process.env.CONTRACT_NAME,
    scope: process.env.CONTRACT_NAME,
    table: 'acceptedtkns',
    limit: 10000000000000,
  })
  const data = table.rows.filter((row) => row.auction_id == auction_id)
  return data.length
}

/*

TODO:

1. Freeze (as usual)
2. Get the total number of stakes
3. Loop through all the stakes
4. Get the total number of entries in totalstakes table
5. Calculate and call stakegiveout
6. Unfreeze (as usual)

*/
