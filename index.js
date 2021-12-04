const cron = require("node-cron");
const express = require("express");
require("dotenv").config();

const { Api, JsonRpc, RpcError } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextEncoder, TextDecoder } = require("util");

const defaultPrivateKey = process.env.PRIVATE_KEY;
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc(process.env.RPC, { fetch });

const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

// import { setfreeze, recyclebyaid, stakegiveout } from "./eos-action.js"
// const { setfreeze, recyclebyaid, stakegiveout } = require("./eos-action.js");

app = express();
// app.listen(process.env.PORT);

console.log("program executing");

auctions = [
  {
    auctionid: 0,
  },
];

entry = null;

cron.schedule(process.env.CRON, async function () {
  try {
    if (process.env.ACTIVE == "TRUE") {
      for (let i = 0; i < auctions.length; i++) {
        entry = await rpc.get_table_rows({
          json: true,
          code: process.env.CONTRACT_NAME,
          scope: process.env.CONTRACT_NAME,
          table: "cyclecount",
          limit: 1,
          lower_bound: auctions[i].auctionid,
          upper_bound: auctions[i].auctionid,
        });

        // Get auction cycle count
        auction_cycle_count = entry.rows[0].auction_cycle_count;

        // Get stake cycle count
        stake_cycle_count = entry.rows[0].stake_cycle_count;

        // STEP 0: Set the indexes for sanity
        await setindex();

        // STEP 1: Freeze the contract
        await setfreeze(auctions[i].auctionid, 3);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_AUCTION_CYCLE)
        );

        // STEP 2: Call recyclebyaid action
        await recyclebyaid(auctions[i].auctionid);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_LOOPSTAKE_CYCLE)
        );

        // STEP 3: Call loopstakes action
        await loopstakes(auctions[i].auctionid, auction_cycle_count);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_STAKE_CYCLE)
        );

        // STEP 4: Call stakegiveout action
        await stakegiveout(auctions[i].auctionid, auction_cycle_count);
        await new Promise((resolve) =>
          setTimeout(resolve, process.env.WAIT_OPEN)
        );

        // STEP 5: Unfreeze
        await setfreeze(auctions[i].auctionid, 0);

        // auctions[i].auctioncycle += 1;
        // auctions[i].stakecycle += 1;
      }
    } else {
      console.log("not active");
    }
  } catch (exp) {
    console.log("Something Wrong");
    console.log(exp);
  }
});

app.listen(process.env.PORT);

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

async function setindex() {
  try {
    console.log("setindex action STARTED");
    const result1 = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "setstkgividx",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              idx: 0,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    const result2 = await api.transact(
      {
        actions: [
          {
            account: process.env.CONTRACT_NAME,
            name: "setlpstkidx",
            authorization: [
              {
                actor: process.env.ACTOR_NAME,
                permission: process.env.PERMISSION,
              },
            ],
            data: {
              idx: 0,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    console.log("setindex SUCCESS");
  } catch (exp) {
    console.log("setindex ran into error");
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
  const stakes = await getStakesCount();
  const denominator = process.env.LOOPSTAKE_DENOMINATOR;
  const quotient = Math.floor(stakes / denominator);
  const remainder = stakes % denominator;

  for (let i = 0; i < quotient; i++) {
    await callLoopstakeAction(auction_id, auction_cycle, denominator);
  }
  await callLoopstakeAction(auction_id, auction_cycle, remainder);
  console.log("loopstakes action COMPLETED");
}

async function stakegiveout(auction_id, auction_cycle) {
  const count = await getTotalStakeCount();
  const numberOfAcceptedTokens = await getAcceptedTokensCount(auction_id);
  const denominator = process.env.STAKE_DENOMINATOR;
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
  const res = await rpc.get_table_rows({
    json: true,
    code: process.env.CONTRACT_NAME,
    scope: process.env.CONTRACT_NAME,
    table: "stakes",
    limit: 10000000000000,
  });
  return res.rows.length;
}

async function getTotalStakeCount() {
  const res = await rpc.get_table_rows({
    json: true,
    code: process.env.CONTRACT_NAME,
    scope: process.env.CONTRACT_NAME,
    table: "totalstake",
    limit: 10000000000000,
  });
  return res.rows.length;
}

async function getAcceptedTokensCount(auction_id) {
  const table = await rpc.get_table_rows({
    json: true,
    code: process.env.CONTRACT_NAME,
    scope: process.env.CONTRACT_NAME,
    table: "acceptedtkns",
    limit: 10000000000000,
  });
  const data = table.rows.filter((row) => row.auction_id == auction_id);
  return data.length;
}
