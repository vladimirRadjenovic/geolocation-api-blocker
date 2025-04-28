import { debounce } from "../modules/debounce.mjs";
import { LocationPicker, defaultLat, defaultLng } from "../modules/map-utils.mjs";

const newRuleBtn = document.getElementById("new-rule-btn");
const tableBody = document.getElementById("table-body");
const tableControlsForm = document.getElementById("table-controls");

const ruleForm = document.getElementById("rule-form");
const dialog = document.getElementById("dialog");
const errDisp = document.getElementById("err-display");
const cancelBtn = document.getElementById("cancel-btn");
const formTitle = document.getElementById("form-title");
const rbOff = document.getElementById("off");
const rbRandom = document.getElementById("random");
const rbFixed = document.getElementById("fixed");
const fsFixed = document.getElementById("fs-fixed");
const fsRandom = document.getElementById("fs-random");
const hostnameInput = document.getElementById("hostname");
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");
const radiusInput = document.getElementById("radius");
const cacheTimeInput = document.getElementById("cache-time");


function setupDialog(hostname = undefined, setting = undefined) {
    //clear old values for random
    //we don't reset the map!
    radiusInput.value = "";
    cacheTimeInput.value = "";
    if (setting && hostname) {
        formTitle.textContent = "Edit rule";
        hostnameInput.value = hostname;
        hostnameInput.disabled = true;

        let lat = defaultLat;
        let lng = defaultLng;
        switch (setting.mode) {
            case "off":
                rbOff.checked = true;
                fsRandom.disabled = true;
                fsFixed.disabled = true;
                locationPicker.disable();
                break;
            case "random":
                rbRandom.checked = true;
                fsRandom.disabled = false;
                fsFixed.disabled = true;
                locationPicker.disable();
                radiusInput.value = setting.radius;
                cacheTimeInput.value = setting.cacheTime;
                break;
            case "fixed":
                rbFixed.checked = true;
                fsRandom.disabled = true;
                fsFixed.disabled = false;
                locationPicker.enable();
                lat = setting.position.latitude;
                lng = setting.position.longitude;
                break;
            default:
                throw new Error("Unexpected settings mode value");
        }

        latInput.value = lat;
        lngInput.value = lng;
        locationPicker.spawnMarker(lat, lng);

    } else {
        formTitle.textContent = "New rule";
        hostnameInput.value = "";
        hostnameInput.disabled = false;
        rbOff.checked = true;
        fsFixed.disabled = true;
        fsRandom.disabled = true;
        latInput.value = defaultLat;
        lngInput.value = defaultLng;
        locationPicker.disable();
    }
}

const locationPicker = new LocationPicker("map");

const onLatLngChange = debounce(() => {
    if (latInput.checkValidity() && lngInput.checkValidity()) {
        locationPicker.spawnMarker(latInput.value, lngInput.value);
    }
}, 250);

latInput.addEventListener("input", onLatLngChange);
lngInput.addEventListener("input", onLatLngChange);


async function saveChanges(event) {
    event.preventDefault();

    if (!ruleForm.checkValidity()) {
        ruleForm.reportValidity();
        return;
    }

    let setting = {
        mode: "off"
    };

    if (rbFixed.checked) {
        setting.mode = "fixed";
        setting.position = {
            latitude: parseFloat(latInput.value),
            longitude: parseFloat(lngInput.value),
        };
    } else if (rbRandom.checked) {
        setting.mode = "random";
        setting.radius = radiusInput.value;
        setting.cacheTime = cacheTimeInput.value;
    }

    const res = await chrome.runtime.sendMessage({
        type: "apply-setting",
        hostname: hostnameInput.value,
        setting
    });


    if (res.op === "success") {
        dialog.close();
        if (formTitle.textContent === "New rule") {
            await renderTable(); //rerender table of successful addition
        }
    } else {
        errDisp.hidden = false;
        errDisp.textContent = `A problem occured: ${res.msg}`;
        setTimeout(() => {
            errDisp.hidden = true;
            errDisp.textContent = null;
        }, 2500);
    }
}

ruleForm.addEventListener("submit", saveChanges);
cancelBtn.addEventListener("click", () => {
    dialog.close();
});

//Filter param is a stupid hack for simple search implementation, will leave it like this probably
async function renderTable(filter = _ => { return true; }) {

    tableBody.replaceChildren();

    const obj = await chrome.runtime.sendMessage({
        type: "get-all-domains"
    });

    if (obj.op && obj.op === "failed") {
        window.alert("Cannot load rule table!");
        return;
    }

    for (const entry of obj) {

        //Don't render if the entry is not valid
        if (!filter(entry)) {
            continue;
        }

        const tr = document.createElement("tr");
        const hostnameTd = document.createElement("td");
        hostnameTd.textContent = entry;
        const editTd = document.createElement("td");
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.type = "button";
        editBtn.style.width = "100%";
        editTd.appendChild(editBtn);


        editBtn.addEventListener("click", async () => {
            const { hostname, setting } = await chrome.runtime.sendMessage({
                type: "get-setting",
                hostname: entry
            });
            setupDialog(hostname, setting); //populates dialog fields
            dialog.showModal();
            //Leaflet needs to recalculate the map size after modal opens
            //SRC: https://stackoverflow.com/questions/42400662/loading-map-in-leaflet-is-very-slow
            locationPicker.invalidateSize(false);

        });

        const delTd = document.createElement("td");
        if (entry !== "default_setting") {
            const delBtn = document.createElement("button");
            delBtn.textContent = "Delete";
            delBtn.type = "button";
            delBtn.style.width = "100%";

            delBtn.addEventListener("click", async () => {
                const res = await chrome.runtime.sendMessage({
                    type: "delete-setting",
                    hostname: entry
                });
                if (res.op === "success") {
                    tr.remove(); //remove table row on successful delete
                }
            });
            delTd.appendChild(delBtn);
        }

        tr.append(hostnameTd, editTd, delTd);
        tableBody.appendChild(tr);

    }
}

tableControlsForm.addEventListener("submit", async event => {
    event.preventDefault();
    const val = event.target["search-rules"].value;
    let filter;
    if (val !== "") {
        filter = e => e.includes(val);
    }
    await renderTable(filter);
})


async function init() {
    //init map once, we will reposition each time we render the dialog
    locationPicker.initLeafletMap(defaultLat, defaultLng, 8, (lat, lng) => {
        latInput.value = lat;
        lngInput.value = lng;
    });

    await renderTable();

}


window.addEventListener("load", init);


rbOff.addEventListener("change", () => {
    fsRandom.disabled = true;
    fsFixed.disabled = true;
    locationPicker.disable();
});

rbRandom.addEventListener("change", () => {
    fsRandom.disabled = false;
    fsFixed.disabled = true;
    locationPicker.disable();
});

rbFixed.addEventListener("change", () => {
    fsRandom.disabled = true;
    fsFixed.disabled = false;
    locationPicker.enable();
});


newRuleBtn.addEventListener("click", async () => {
    setupDialog();
    dialog.showModal();
    locationPicker.invalidateSize(false);
});
