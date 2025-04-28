
/*
RESOURCES:
[1] https://jordinl.com/posts/2019-02-15-how-to-generate-random-geocoordinates-within-given-radius.
[2] https://gis.stackexchange.com/questions/303300/calculating-correct-longitude-when-its-over-180

This modified version attempts to somewhat patch the problems, it will always return a valid point.
However, the distribution will not be uniform if too many points are generated taking the else branch.
This should not be a problem in practice since a 1000km radius is problematic only on latitudes where abs(lat) > 80deg.
*/

//Arhitmetic mean radius
const earthRadius = 6371.0088;      

export function obfuscateLocation(latDeg, lngDeg, radiusKm) {

    if (radiusKm > 1000) {
        throw new Error("Radius must be within 1000km");
    } else if (radiusKm < 0) {
        throw new Error("Radius must be a nonnegative value");
    } else if (radiusKm == 0) {
        return {
            lat: latDeg,
            lng: lngDeg
        }
    }

    let lat = latDeg * Math.PI / 180;
    let lng = lngDeg * Math.PI / 180;

    let r = Math.sqrt(Math.random()) * radiusKm / earthRadius;

    let deltaLat = r * Math.cos(Math.random() * Math.PI);
    let lat2 = lat + deltaLat;

    let x = Math.cos(r) - Math.cos(deltaLat);
    let y = Math.cos(lat) * Math.cos(lat2);
    let arg = x / y + 1;

    let deltaLng;
    if (Math.abs(arg) <= 1) {
        let sign = Math.sign(Math.random() - 0.5);
        deltaLng = sign * Math.acos(arg);
    } else {
        deltaLng = Math.random() * (2 * Math.PI) - Math.PI;
    }

    if (lat2 < -Math.PI / 2) {
        lat2 = -Math.PI - lat2;
        lng += Math.PI;
    } else if (lat2 > Math.PI / 2) {
        lat2 = Math.PI - lat2;
        lng += Math.PI;
    }

    //Readjust the longitude value, simple method found in [2] 
    //the loop should only run a few times in practice
    let lng2 = lng + deltaLng;
    while (Math.abs(lng2) > Math.PI) {
        lng2 -= Math.sign(lng2) * 2 * Math.PI;
    }

    return {
        latitude: lat2 * 180 / Math.PI,
        longitude: lng2 * 180 / Math.PI
    };

}
