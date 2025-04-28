import { TileLayer, Marker, Map } from "../leaflet/leaflet-src.esm.js";

/*
Crop to seven decimal places. There are 2 reasons for this.
1) 0.0000001 degrees is less than 1.2 cm (XKCD COMIC: https://xkcd.com/2170/)
2) We also limit the number input to 7 decimal places in the UI.
*/
const DECIMALS = 7;
const defaultLat = 51.476852;
const defaultLng = -0.000500;

class LocationPicker {
    static #attribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    static #tileLayerUrlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    static #maxZoom = 18; //16 works well too
    #domId;
    #leafletMap;
    #posMarker;
    #_clickHandler;


    constructor(domId) {
        this.#domId = domId;
    }


    initLeafletMap(lat, lng, zoomLvl, onPinSelection) {

        this.#leafletMap = new Map(this.#domId).setView({ lat, lng }, zoomLvl);
        new TileLayer(LocationPicker.#tileLayerUrlTemplate, {
            maxZoom: LocationPicker.#maxZoom,
            attribution: LocationPicker.#attribution
        }).addTo(this.#leafletMap);

        this.spawnMarker(lat, lng);

        this.#_clickHandler = (data) => {
            const { latlng } = data;
            const lat = latlng.lat.toFixed(DECIMALS);
            const lng = latlng.lng.toFixed(DECIMALS);
            this.spawnMarker(lat, lng);
            onPinSelection(lat, lng);
        };

        this.#leafletMap.on("click", this.#_clickHandler);
    }


    spawnMarker(lat, lng) {
        //remove previous marker if present
        if (this.#posMarker) {
            this.#leafletMap.removeLayer(this.#posMarker);
        }

        this.#posMarker = new Marker({ lat, lng }).addTo(this.#leafletMap);
        //Center map only if new marker is out of bounds
        const bounds = this.#leafletMap.getBounds();
        if (bounds && !bounds.contains({ lat, lng })) {
            this.#leafletMap.panTo({ lat, lng });
        }
    }


    disable() {
        if (this.#leafletMap) {
            this.#leafletMap.zoomControl.disable();
            this.#leafletMap.dragging.disable();
            this.#leafletMap.touchZoom.disable();
            this.#leafletMap.doubleClickZoom.disable();
            this.#leafletMap.scrollWheelZoom.disable();
            this.#leafletMap.boxZoom.disable();
            this.#leafletMap.keyboard.disable();
            if (this.#leafletMap.tap) {
                this.#leafletMap.tap.disable();
            }
            this.#leafletMap.off("click", this.#_clickHandler);
        }
    }

    
    enable() {
        if (this.#leafletMap) {
            this.#leafletMap.zoomControl.enable();
            this.#leafletMap.dragging.enable();
            this.#leafletMap.touchZoom.enable();
            this.#leafletMap.doubleClickZoom.enable();
            this.#leafletMap.scrollWheelZoom.enable();
            this.#leafletMap.boxZoom.enable();
            this.#leafletMap.keyboard.enable();
            if (this.#leafletMap.tap) {
                this.#leafletMap.tap.enable();
            }
            this.#leafletMap.on("click", this.#_clickHandler);
        }
    }

    invalidateSize(animate) {
        this.#leafletMap.invalidateSize(animate);
    }

}


export {
    LocationPicker,
    defaultLng,
    defaultLat,
}
