import { debounce } from "../modules/debounce.mjs";
import { LocationPicker, defaultLat, defaultLng } from "../modules/map-utils.mjs";

// Radio buttons
const rbOff = document.getElementById("off");
const rbRandom = document.getElementById("random");
const rbFixed = document.getElementById("fixed");
// Fieldsets
const fsMiddle = document.getElementById("fs-middle");
const fsLower = document.getElementById("fs-lower");
// Inputs
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");
const radiusInput = document.getElementById("radius");
const cacheTimeInput = document.getElementById("cache-time");

const errDisp = document.getElementById("error-display");

let currHostname;

const locationPicker = new LocationPicker("map");

const onLatLngChange = debounce(() => {
    if (latInput.checkValidity() && lngInput.checkValidity()) {
        locationPicker.spawnMarker(latInput.value, lngInput.value);
    }
}, 250);

latInput.addEventListener("input", onLatLngChange);
lngInput.addEventListener("input", onLatLngChange);

async function init() {

    const queryOptions = {
        active: true,
        lastFocusedWindow: true
    };
    const [tab] = await chrome.tabs.query(queryOptions);
    currHostname = new URL(tab.url).hostname;

    const { hostname, setting } = await chrome.runtime.sendMessage({
        type: "get-setting",
        hostname: currHostname
    });

    let lat = defaultLat;
    let lng = defaultLng;

    switch (setting.mode) {
        case "fixed":
            rbFixed.checked = true;
            fsLower.hidden = false;
            fsLower.disabled = false;
            lat = setting.position.latitude;
            lng = setting.position.longitude;
            break;
        case "random":
            rbRandom.checked = true;
            fsMiddle.hidden = false;
            fsMiddle.disabled = false;
            radiusInput.value = setting.radius;
            cacheTimeInput.value = setting.cacheTime;
            break;
        case "off":
            rbOff.checked = true;
            break;
        default:
            throw new Error("Unexpected settings mode value");
    }

    latInput.value = lat;
    lngInput.value = lng;
    locationPicker.initLeafletMap(lat, lng, 8, (lat, lng) => {
        latInput.value = lat;
        lngInput.value = lng;
    });

    //Set status message for user
    const status = hostname === "default_setting" ?
        `No setting detected for current hostname, reverting to default setting (${setting.mode}).` :
        `Current setting for ${hostname} is ${setting.mode}.`;
    document.getElementById("curr-setting").textContent = status;

}

//save button function
async function saveSettings(event) {
    event.preventDefault();

    let setting = {
        mode: "off"
    };

    if (rbFixed.checked) {
        setting.mode = "fixed";
        setting.position = {
            latitude: parseFloat(latInput.value),
            longitude: parseFloat(lngInput.value),
        }
    } else if (rbRandom.checked) {
        setting.mode = "random";
        setting.radius = radiusInput.value;
        setting.cacheTime = cacheTimeInput.value;
    }

    const res = await chrome.runtime.sendMessage({
        type: "apply-setting",
        hostname: currHostname,
        setting
    });

    if (res.op === "success") {
        window.close();
    } else {
        errDisp.hidden = false;
        errDisp.textContent = `A problem occured: ${res.msg}`;
        setTimeout(() => {
            errDisp.hidden = true;
            errDisp.textContent = null;
        }, 2500);
    }
}

window.addEventListener("load", init);
document.getElementById("settings-form").addEventListener("submit", saveSettings);

rbOff.addEventListener("change", () => {
    fsMiddle.hidden = true;
    fsMiddle.disabled = true;
    fsLower.hidden = true;
    fsMiddle.disabled = true;
});

rbRandom.addEventListener("change", () => {
    fsMiddle.hidden = false;
    fsMiddle.disabled = false;
    fsLower.hidden = true;
    fsLower.disabled = true;
});

rbFixed.addEventListener("change", () => {
    fsMiddle.hidden = true;
    fsMiddle.disabled = true;
    fsLower.hidden = false;
    fsLower.disabled = false;
});

document.getElementById("btn-options").addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
});
