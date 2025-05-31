# Geolocation API Blocker

[Geolocation API Blocker](https://chromewebstore.google.com/detail/geolocation-api-blocker/cbpmbkimnhdlaibdcngplgmchiibjeni) is a minimalist Chrome extension that allows the user to control the behavior of the [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).

The extension applies its settings on a per-hostname basis. There are three settings available:

* _Fixed_ - The user can input their latitude and longitude of choice. Successful Geolocation API calls will always return that fixed value.

* _Random_ - The user defines a radius _r_ and time to cache. Successful Geolocation API calls will return a location uniformly distributed inside a disc of radius _r_. Coordinates remain fixed for the specified duration. The algorithm used is a slight modification of Jordi Noguera's haversine-based [algorithm](https://jordinl.com/posts/2019-02-15-how-to-generate-random-geocoordinates-within-given-radius).

* _Off_ - Original coordinates remain unaltered.

If a site uses your IP to detect your location, this extension cannot do anything about it. Its only purpose is to alter the behavior of Geolocation API, which is a much more accurate method of obtaining location.
