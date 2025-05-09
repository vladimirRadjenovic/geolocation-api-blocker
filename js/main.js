(() => {
    if ("geolocation" in navigator) {
        /*
        It seems that Chrome implementation returns up to 7 decimal places.
        Couldn't find any documentation whether this is true, but it makes sense accuracy wise.
        */
        const DECIMALS = 7;

        const channel = new MessageChannel();

        function sendMessageToIsolated(message) {
            return new Promise((resolve, reject) => {

                channel.port1.addEventListener("message", resp => {
                    if (resp.data.errMsg) {
                        reject(resp.data);
                    } else {
                        resolve(resp.data);
                    }
                }, { once: true });

                channel.port1.postMessage(message);
            });
        }

        window.postMessage({
            type: "geolocation-api-blocker-connect"
        }, {
            transfer: [channel.port2]
        });


        /*
        NOTE: Assuming V8 engine stack formats since error objects differ between browsers.
        For example err.hasOwnProperty("stack") is true on Chrome, but false on Firefox.
        When using trapErrAndModifyTrace we usually need to remove three stack frames from the original stack.
        SRC: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack
        */
        function trapErrAndModifyTrace(func, frameCount = 3, startFrame = 0) {
            try {
                return func();
            } catch (err) {
                const stackArray = err.stack.split("\n");
                //zero index contains the exception message
                stackArray.splice(startFrame + 1, frameCount);
                err.stack = stackArray.join("\n");
                throw err;
            }
        }


        /*
        Proxying the default toString method is required in order to hide modifications.
        Calling toString on a Proxy object won't return the expected result.
        */
        const toStringMap = new WeakMap();
        const _toString = Function.prototype.toString;
        Function.prototype.toString = new Proxy(_toString, {
            apply(target, thisArg, args) {
                const redirectTo = toStringMap.get(thisArg) ?? thisArg;
                return trapErrAndModifyTrace(() => Reflect.apply(target, redirectTo, args), 3, 1);
            }
        });

        toStringMap.set(Function.prototype.toString, _toString);

        /*
        There is a problem with timing. A malicious content script can register an event handler
        and get a hold of MessageChannel's port2. We need to delay this until we get a signal from isolated script.
        */
        let enabled = false;
        let messageHandlerQueue = [];
        const _addEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = new Proxy(_addEventListener, {
            apply(target, thisArg, args) {
                if (!enabled && args[0] === "message" &&
                    (args.length > 1 &&
                        (args[1] === null ||
                            args[1] === undefined ||
                            typeof args[1] === "function" ||
                            typeof args[1] === "object"
                        )
                    )
                ) {
                    messageHandlerQueue.push({
                        isAEL: true,
                        args
                    });
                    return undefined;
                }
                return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
            },
        });

        toStringMap.set(EventTarget.prototype.addEventListener, _addEventListener);

        let delayedMessagesArgs = [];
        const _postMessage = window.postMessage;
        window.postMessage = new Proxy(_postMessage, {
            apply(target, thisArg, args) {
                if (!enabled) {
                    delayedMessagesArgs.push(args);
                    return undefined;
                }
                return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
            }
        })
        toStringMap.set(window.postMessage, _postMessage);

        const _onMessageDesc = Object.getOwnPropertyDescriptor(window, "onmessage");
        const _onMessageGet = _onMessageDesc.get;
        const _onMessageSet = _onMessageDesc.set;
        let index = null;

        const onMessageGetProxy = new Proxy(_onMessageGet, {
            apply(target, thisArg, args) {
                if (enabled) {
                    return Reflect.apply(target, thisArg, args);
                } else if (index !== null) {
                    return messageHandlerQueue[index].args[0];
                } else {
                    return null;
                }
            }
        });

        toStringMap.set(onMessageGetProxy, _onMessageGet);

        let onMessageSetProxy = new Proxy(_onMessageSet, {
            apply(target, thisArg, args) {
                if (enabled) {
                    return Reflect.apply(target, thisArg, args);
                } else if (index === null && typeof args[0] === "function") {
                    index = messageHandlerQueue.length;
                    messageHandlerQueue.push({ args });
                } else {
                    if (typeof args[0] === "function") {
                        messageHandlerQueue[index] = { args };
                    } else {
                        messageHandlerQueue.splice(index, 1);
                        index = null;
                    }
                }
            }
        });

        toStringMap.set(onMessageSetProxy, _onMessageSet);

        Object.defineProperty(window, "onmessage", {
            configurable: _onMessageDesc.configurable,
            enumerable: _onMessageDesc.enumerable,
            get: onMessageGetProxy,
            set: onMessageSetProxy
        });

        _addEventListener.call(channel.port1, "message", message => {
            if (message.data === "ACK") {
                //switch proxied functions to default behavior
                enabled = true;

                for (const entry of messageHandlerQueue) {
                    if (entry.isAEL) {
                        _addEventListener.apply(window, entry.args)
                    } else {
                        _onMessageSet.apply(window, entry.args);
                    }
                }

                for (const args of delayedMessagesArgs) {
                    _postMessage.apply(window, args);
                }

                index = null;
                messageHandlerQueue = [];
                delayedMessagesArgs = [];

            }
        }, { once: true });
        channel.port1.start();



        //used in case of user turning off the extension
        let contextInvalidated = false;     
        let prototypeAltered = false;
        let _latGet;
        let _lngGet;
        //GeolocationCoords, latng
        const coordsMap = new WeakMap();    


        //Called only once
        function hackGCProto(position) {
            const coordsProto = Object.getPrototypeOf(position.coords);

            const _latProp = Object.getOwnPropertyDescriptor(coordsProto, "latitude");
            const _lngProp = Object.getOwnPropertyDescriptor(coordsProto, "longitude");

            _latGet = _latProp.get;
            _lngGet = _lngProp.get;

            const latGetProxy = new Proxy(_latGet, {
                apply(target, thisArg, args) {
                    if (thisArg instanceof GeolocationCoordinates) {
                        const latlng = coordsMap.get(thisArg);
                        if (latlng) {
                            return parseFloat(latlng.latitude.toFixed(DECIMALS));
                        }
                    }
                    return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
                }
            });

            toStringMap.set(latGetProxy, _latGet);

            Object.defineProperty(coordsProto, "latitude", {
                configurable: _latProp.configurable,
                enumerable: _latProp.enumerable,
                get: latGetProxy
            });


            const lngGetProxy = new Proxy(_lngGet, {
                apply(target, thisArg, args) {
                    if (thisArg instanceof GeolocationCoordinates) {
                        const latlng = coordsMap.get(thisArg);
                        if (latlng) {
                            return parseFloat(latlng.longitude.toFixed(DECIMALS));
                        }
                    }
                    return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
                }
            });

            toStringMap.set(lngGetProxy, _lngGet);

            Object.defineProperty(coordsProto, "longitude", {
                configurable: _lngProp.configurable,
                enumerable: _lngProp.enumerable,
                get: lngGetProxy
            });
        }


        async function _map(position) {
            //user has turned off their extension
            if (contextInvalidated) {
                return position;
            }

            try {
                const { setting } = await sendMessageToIsolated({
                    type: "get-setting",
                });

                if (!prototypeAltered) {
                    hackGCProto(position);
                    prototypeAltered = true;
                }

                switch (setting.mode) {
                    case "fixed":
                        coordsMap.set(position.coords, {
                            latitude: setting.position.latitude,
                            longitude: setting.position.longitude
                        });
                        break;
                    case "random":
                        const latlng = await sendMessageToIsolated({
                            type: "randomize-location",
                            radius: setting.radius,
                            latitude: _latGet.call(position.coords),
                            longitude: _lngGet.call(position.coords)
                        });

                        coordsMap.set(position.coords, {
                            latitude: latlng.latitude,
                            longitude: latlng.longitude
                        });
                        break;
                    default:
                    /*
                    There is no need to do anything here. If the value is original,
                    getter functions will return it if they don't find an entry in the weak map.
                    */
                }

            } catch (err) {
                /*
                If the user turns off their extension we basically disable the _map function.
                Unfortunately turning on the extension again cannot restore functinality 
                since the isolated.js script will throw "Extension context invalidated" error.
                */
                if (err.errMsg === "Extension context invalidated.") {
                    contextInvalidated = true;
                }
            } finally {
                return position;
            }
        }


        const _gcp = navigator.geolocation.getCurrentPosition;

        Object.getPrototypeOf(navigator.geolocation).getCurrentPosition =
            new Proxy(_gcp, {
                apply(target, thisArg, args) {
                    if (thisArg instanceof Geolocation && typeof args[0] === "function") {
                        const success = args[0];
                        args[0] = async function (position) {
                            success(await _map(position));
                        }
                    }
                    return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
                }
            });

        toStringMap.set(navigator.geolocation.getCurrentPosition, _gcp);


        const _wp = navigator.geolocation.watchPosition;

        Object.getPrototypeOf(navigator.geolocation).watchPosition =
            new Proxy(_wp, {
                apply(target, thisArg, args) {
                    if (thisArg instanceof Geolocation && typeof args[0] === "function") {
                        const success = args[0];
                        args[0] = async function (position) {
                            success(await _map(position));
                        }
                    }
                    return trapErrAndModifyTrace(() => Reflect.apply(target, thisArg, args));
                }
            });

        toStringMap.set(navigator.geolocation.watchPosition, _wp);
    }
})();
