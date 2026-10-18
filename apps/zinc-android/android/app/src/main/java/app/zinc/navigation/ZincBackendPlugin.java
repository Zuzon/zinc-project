package app.zinc.navigation;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands the WebView the embedded backend's WebSocket URL; the counterpart
 * of apps/zinc-web/src/capacitorBackend.ts.
 */
@CapacitorPlugin(name = "ZincBackend")
public class ZincBackendPlugin extends Plugin {

    @PluginMethod
    public void connect(PluginCall call) {
        try {
            NodeHost.Endpoint endpoint = NodeHost.start(getContext());
            JSObject result = new JSObject();
            result.put("url", endpoint.bridgeUrl());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("The embedded backend failed to start", e);
        }
    }
}
