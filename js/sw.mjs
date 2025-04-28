import { obfuscateLocation } from "../modules/randomize-location.mjs";


function createDefaultMap() {
    const map = new Map();
    map.set("default_setting", {
        mode: "fixed",
        position: {
            latitude: 51.4779,
            longitude: -0.0015,
        }
    });

    return map;
}


async function onInstall(details) {
    //NOTE: remove 2nd check before publishing
    if (details.reason === "install" 
        /* || details.reason === "update" */) {
        await chrome.storage.local.set({
            map: [...createDefaultMap()]
        });
    }
}


chrome.runtime.onInstalled.addListener(onInstall);


/*
NOTE: mapInit promise might complete before 
onInstall setup serializes the default map during installation.
That is why we always call createDefaultMap() and only alter the map
in mapInit if we deserialize a non-empty map.
*/
let map = createDefaultMap(); //for caching
const mapInit = chrome.storage.local.get("map")
    .then(data => {
        if (data.map !== undefined) {
            map = new Map(data.map);
        }
        return map;
    });


/*
NOTE: Due to a known Chromium problem, 
functions used as onMessage handlers cannot be written using async/await.
The final return true; statement is a must. 
CHROME ISSUE PAGE: https://issues.chromium.org/issues/40753031
*/
async function callRandomizeLocation(message, sender) {
    await mapInit;
    let hostname = new URL(sender.url).hostname;
    let setting = map.get(hostname)
    if (!setting) {
        setting = map.get("default_setting");
        hostname = "default_setting";
    }
    const cachedData = await chrome.storage.session.get(hostname);
    if (cachedData[hostname]) {
        const { latlng, timestamp } = cachedData[hostname];
        //check timestamp
        if ((Date.now() - timestamp) <= setting.cacheTime * 1000) {
            return latlng;
        }
    }
    //we have to regenerate the ofuscated location since it doesn't exist or it has expired
    const latlng = obfuscateLocation(message.latitude, message.longitude, message.radius);
    //save to session storage
    await chrome.storage.session.set({
        [hostname]: {
            latlng,
            timestamp: Date.now()
        }
    });
    return latlng;
}



function _handleRandomizeLocation(message, sender, sendResponse) {
    if (message.type !== "randomize-location") {
        return;
    }

    callRandomizeLocation(message, sender)
        .then(latlng => sendResponse(latlng))
        .catch(err => sendResponse({ op: "failed", msg: err.message }))

    return true;
}


function _handleGetSetting(message, sender, sendResponse) {
    if (message.type !== "get-setting") {
        return;
    }
    mapInit.then(() => {
        const hostname = message.hostname ?? new URL(sender.url).hostname;
        const setting = map.get(hostname);
        sendResponse({
            hostname: setting ? hostname : "default_setting",
            setting: setting ? setting : map.get("default_setting")
        });
    }).catch(err => {
        sendResponse({
            op: "failed",
            msg: err.message
        });
    });
    return true;
}


function _handleGetAllDomains(message, _, sendResponse) {
    if (message.type !== "get-all-domains") {
        return;
    }
    mapInit.then(map => {
        //we will just return the keys
        sendResponse([...map.keys()]);
    }).catch(err => {
        sendResponse({
            op: "failed",
            msg: err.message
        });
    })
    return true;
}


function _handleDeleteSetting(message, _, sendResponse) {
    if (message.type !== "delete-setting") {
        return;
    }
    mapInit.then(map => {
        const wasPresent = map.delete(message.hostname);
        //no need to serialize map if the item targeted for deletion was not present
        if (wasPresent) {
            return chrome.storage.local.set({
                map: [...map]
            });
        }
        return null;
    }).then(_ => {
        sendResponse({ op: "success" });
    }).catch(err => {
        sendResponse({
            op: "failed",
            msg: err.message
        });
    });
    return true;
}


function _handleApplySetting(message, _, sendResponse) {
    if (message.type !== "apply-setting") {
        return;
    }
    mapInit.then(() => {
        map.set(message.hostname, message.setting);
        return chrome.storage.local.set({
            map: [...map]
        });
    }).then(() => {
        sendResponse({ op: "success" });
    }).catch(err => {
        sendResponse({
            op: "failed",
            msg: err.message
        });
    });
    return true;
}

chrome.runtime.onMessage.addListener(_handleGetSetting);
chrome.runtime.onMessage.addListener(_handleRandomizeLocation);
chrome.runtime.onMessage.addListener(_handleGetAllDomains);
chrome.runtime.onMessage.addListener(_handleDeleteSetting);
chrome.runtime.onMessage.addListener(_handleApplySetting);
