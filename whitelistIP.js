const axios = require("axios");
const cron = require("node-cron");
require('dotenv').config();

// Global Config
const tenant = "sudha";
const region = "ind";
const authBase = `https://${region}.iam.checkmarx.net/auth/realms/${tenant}`;
const iamBase = `https://${region}.iam.checkmarx.net/auth/admin/realms/${tenant}`;
const auditEndpoint = `https://${region}.ast.checkmarx.net/api/audit/`;
const whitelist = ["27.107.51.58", "103.149.126.38", "44.218.110.68","94.205.42.224", "203.192.204.169"];
let lastProcessedDate = null;
let client_id= process.env.CLIENT_ID
let client_secret= process.env.CLIENT_SECRET

let tokenCache = {
  token: null,
  timestamp: null,
};

// Token Refresh - Every 29 minutes
cron.schedule("*/29 * * * *", async () => {
  await getToken(true); // force refresh
});

async function getToken(force = false) {
  const now = Date.now();
  const isExpired =
    !tokenCache.token || now - tokenCache.timestamp > 29 * 60 * 1000;

  if (isExpired || force) {
    console.log("Fetching new token...");
    const response = await axios.post(
      `${authBase}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: client_id,
        client_secret: client_secret,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      }
    );
    tokenCache.token = response.data.access_token;
    tokenCache.timestamp = now;
  }

  return tokenCache.token;
}

async function fetchAuditTrail(token) {
  try {
    const response = await axios.get(auditEndpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*; version=1.0",
      },
    });

    const ipidMap = {};
    let maxTimestamp = lastProcessedDate;

    response.data?.events?.forEach((event) => {
      const eventTimestamp = new Date(event.eventDate);

      // Skip already processed events
      if (lastProcessedDate && eventTimestamp <= lastProcessedDate) return;

      // Track the max timestamp in this batch
      if (!maxTimestamp || eventTimestamp > maxTimestamp) {
        maxTimestamp = eventTimestamp;
      }

      // Process new event
      if (event.ipAddress && event.actionUserId) {
        if (!ipidMap[event.ipAddress]) ipidMap[event.ipAddress] = new Set();
        ipidMap[event.ipAddress].add(event.actionUserId);
      }
    });

    // Update the lastProcessedDate for the next cycle
    lastProcessedDate = maxTimestamp;

    console.log("New Events:", ipidMap);
    console.log("Last processed at:", lastProcessedDate);
    console.log("Latest event processed:", maxTimestamp);

    return ipidMap;
  } catch (err) {
    console.error(
      "Fetching audit trail failed:",
      err.response?.data || err.message
    );
    throw err;
  }
}

async function implementWhitelist(ipidMap) {
  const toBeBlocked = {};
  for (const [ip, userIds] of Object.entries(ipidMap)) {
    if (!whitelist.includes(ip)) {
      toBeBlocked[ip] = [...userIds];
    }
  }
  return toBeBlocked;
}

async function sessionInvalidator(userId, token) {
  try {
    const getSessionsEndpoint = `${iamBase}/users/${userId}/sessions`;
    const response = await axios.get(getSessionsEndpoint, {
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    });

    const sessions = response.data;
    for (const session of sessions) {
      const sessionId = session.id;
      const deleteEndpoint = `${iamBase}/sessions/${sessionId}`;
      await axios.delete(deleteEndpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (err) {
    console.error(
      `Session invalidation failed for ${userId}:`,
      err.response?.data || err.message
    );
  }
}

async function kickOut(toBeBlocked, token, ipidMap) {
  for (const userIds of Object.values(toBeBlocked)) {
    for (const userId of userIds) {
      await sessionInvalidator(userId, token);

      // After kicking out, remove userId from all ip entries in ipidMap
      for (const ip in ipidMap) {
        if (ipidMap[ip].has(userId)) {
          ipidMap[ip].delete(userId);
          if (ipidMap[ip].size === 0) {
            delete ipidMap[ip];
          }
        }
      }
    }
  }
}

// Audit + Kickout - Every 10 seconds
cron.schedule("*/10 * * * * *", async () => {
  try {
    const token = await getToken();
    const ipidMap = await fetchAuditTrail(token);
    const toBeBlocked = await implementWhitelist(ipidMap);
    if (Object.keys(toBeBlocked).length > 0) {
      await kickOut(toBeBlocked, token, ipidMap);
    } else {
      console.log("Nothing to block at this cycle.");
    }
  } catch (err) {
    console.error("Cycle failed:", err.message);
  }
});

// Run immediately on start
(async () => {
  await getToken(true);
})();

//logic:
//continously monitor the audit-log and create a hash-map of (ip, id) key-value pair
//if an IP is not in allowlist, then call the kickout function and pass the actionUserId from hash-map in it
//kickout function internally calls 2 functions
//sessionInvalidator(): DELETE all the sessions initiated by the actionUserId
//updateRoll(): reverse the current role-set
//when the user logs in again from a whitelisted ip, then call the updateRole() again.

//to-do:
//add the updateRole() function at needed places.
