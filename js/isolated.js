(() => {
    if (!window.isSecureContext) {
        return;
    }

    function handleConnectEvent(event) {
        if (event.origin === window.origin
            && event.data.type === 0x474142
            && event.ports[0] instanceof MessagePort) {

            removeEventListener(event.type, handleConnectEvent);
            const port = event.ports[0];

            port.addEventListener("message", async message => {
                try {
                    const res = await chrome.runtime.sendMessage(message.data);
                    if (res.op === "failed") {
                        throw new Error(`Operation "${message.data.type}" failed.`);
                    }
                    port.postMessage(res);
                } catch (err) {
                    port.postMessage({
                        errMsg: err.message
                    });
                }
            });

            //must be invoked when using addEventListener
            port.start(); 
            port.postMessage(0x41434B);
        }
    }

    addEventListener("message", handleConnectEvent);

})();
