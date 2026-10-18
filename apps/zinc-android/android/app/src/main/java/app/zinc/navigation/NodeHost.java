package app.zinc.navigation;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.os.ParcelFileDescriptor;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import android.util.Log;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.security.SecureRandom;

/**
 * Runs the embedded Node backend (apps/zinc-android-node, staged in
 * assets/nodejs) once per process, on a loopback port only the WebView knows
 * the token for.
 */
final class NodeHost {

    private static final String TAG = "ZincNodeHost";
    private static final String ASSETS = "nodejs";
    private static final String PREFS = "zinc-node-host";
    private static final String STAGED_VERSION = "stagedVersion";
    /** V8 needs more stack than a default Java thread has. */
    private static final long STACK_SIZE = 16L * 1024 * 1024;

    /** Where the WebView reaches the backend. */
    static final class Endpoint {

        final int port;
        final String token;

        Endpoint(int port, String token) {
            this.port = port;
            this.token = token;
        }

        /** rxjs-bridge WebSocket; the token check lives in apps/zinc-android-node/src/access.ts. */
        String bridgeUrl() {
            return "ws://127.0.0.1:" + port + "/rx?t=" + token;
        }
    }

    private static Endpoint endpoint;

    static {
        System.loadLibrary("node");
        System.loadLibrary("zinc-node-host");
    }

    private NodeHost() {}

    private static native int startNode(String[] args);

    /**
     * Starts Node on first use. Later calls, e.g. after the activity was
     * recreated, return the running backend: libnode cannot start twice.
     */
    static synchronized Endpoint start(Context context) throws IOException, ErrnoException {
        if (endpoint != null) {
            return endpoint;
        }
        Context app = context.getApplicationContext();
        File projectDir = stageProject(app);
        File dataDir = new File(app.getFilesDir(), "zinc");
        if (!dataDir.isDirectory() && !dataDir.mkdirs()) {
            throw new IOException("Cannot create " + dataDir);
        }

        // Node listens on a socket opened here, so the port cannot be taken in between.
        FileDescriptor socket = Os.socket(OsConstants.AF_INET, OsConstants.SOCK_STREAM, 0);
        int listenFd;
        int port;
        try {
            Os.bind(socket, InetAddress.getByName("127.0.0.1"), 0);
            Os.listen(socket, 64);
            port = ((InetSocketAddress) Os.getsockname(socket)).getPort();
            listenFd = ParcelFileDescriptor.dup(socket).detachFd();
        } finally {
            Os.close(socket);
        }
        String token = newToken();

        Os.setenv("ZINC_DATA_DIR", dataDir.getAbsolutePath(), true);
        Os.setenv("ZINC_PORT", Integer.toString(port), true);
        Os.setenv("ZINC_LISTEN_FD", Integer.toString(listenFd), true);
        Os.setenv("ZINC_TOKEN", token, true);
        Os.setenv(
            "ZINC_SQLITE_BINDING",
            new File(app.getApplicationInfo().nativeLibraryDir, "libbetter_sqlite3.so").getAbsolutePath(),
            true
        );
        Os.setenv("HOME", app.getFilesDir().getAbsolutePath(), true);
        Os.setenv("TMPDIR", app.getCacheDir().getAbsolutePath(), true);

        String script = new File(projectDir, "main.cjs").getAbsolutePath();
        Thread thread = new Thread(
            null,
            () -> {
                int code = startNode(new String[] { "node", script });
                Log.e(TAG, "Embedded Node exited with code " + code);
            },
            "zinc-node",
            STACK_SIZE
        );
        thread.start();

        endpoint = new Endpoint(port, token);
        return endpoint;
    }

    /** Copies assets/nodejs to app storage when the APK changed: Node needs real files. */
    private static File stageProject(Context app) throws IOException {
        File projectDir = new File(app.getFilesDir(), ASSETS);
        long version;
        try {
            version = app.getPackageManager().getPackageInfo(app.getPackageName(), 0).lastUpdateTime;
        } catch (android.content.pm.PackageManager.NameNotFoundException e) {
            throw new IOException(e);
        }
        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (projectDir.isDirectory() && prefs.getLong(STAGED_VERSION, -1) == version) {
            return projectDir;
        }
        deleteRecursively(projectDir);
        copyAssets(app.getAssets(), ASSETS, projectDir);
        prefs.edit().putLong(STAGED_VERSION, version).commit();
        return projectDir;
    }

    private static void copyAssets(AssetManager assets, String path, File target) throws IOException {
        String[] children = assets.list(path);
        if (children == null || children.length == 0) {
            try (InputStream in = assets.open(path); OutputStream out = new FileOutputStream(target)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                }
            }
            return;
        }
        if (!target.isDirectory() && !target.mkdirs()) {
            throw new IOException("Cannot create " + target);
        }
        for (String child : children) {
            copyAssets(assets, path + "/" + child, new File(target, child));
        }
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }
        // A file that cannot be deleted fails the copy over it instead.
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    private static String newToken() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }
}
