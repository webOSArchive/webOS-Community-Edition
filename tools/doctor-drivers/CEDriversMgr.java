package com.palm.nova.installer.core;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * webOS CE: the Doctor's driver step on a Mac.
 *
 * The Doctor's own DesktopDriversMgr installs a 2011 package (a bundle-style .pkg with a kernel
 * extension) that no current macOS will install. Outside Mac OS X 10.6 it also can't tell
 * whether the driver is there (it reads a receipts file that no longer exists), so it tried
 * that install on every run. On a Mac this class does the step instead; on Windows and Linux it
 * hands straight to DesktopDriversMgr, which is unchanged. build/harness.py points the one
 * caller (SystemCheckRunner's thread) here.
 *
 * On a Mac:
 * - If novacomd is already answering on its port, the driver is there and nothing is installed.
 * - Otherwise the package for this Mac's processor is taken out of the JAR and opened in
 *   macOS's Installer, as the Doctor always did, and the step waits for the person to finish.
 *   The processor is asked of the system (hw.optional.arm64), not of Java: an Intel Java under
 *   Rosetta says x86_64 on an Apple silicon Mac.
 * - The step succeeds when novacomd answers afterwards.
 *
 * Built for Java 7, which is as far back as today's compilers go; the Doctor's own classes are
 * Java 6. tools/doctor-drivers/build.sh compiles it and tests it.
 */
public class CEDriversMgr {
    /** novacomd's port. The property is for build.sh's test, on a machine whose own novacomd has 6968. */
    static final int NOVACOMD_PORT = Integer.getInteger("ce.novacomd.port", 6968);
    private final Logger logger = LoggerUtils.getInstance().getLogger(CEDriversMgr.class.getName());

    public boolean checkAndInstallDrivers() {
        // ce.os.name is for build.sh's test: a Java told os.name is a Mac's loads Mac classes of its own.
        String os = System.getProperty("ce.os.name", System.getProperty("os.name", "")).toUpperCase();
        if (os.indexOf("MAC") < 0) {
            return new DesktopDriversMgr().checkAndInstallDrivers();
        }
        logger.info("Mac: os.arch " + System.getProperty("os.arch") + ", os.version " + System.getProperty("os.version"));
        if (novacomdAnswers()) {
            logger.info("novacomd is running; no driver to install");
            return true;
        }
        String arch = appleSilicon() ? "arm64" : "x86_64";
        String resource = "/resources/novacom-installer-" + arch + ".pkg";
        File pkg = null;
        try {
            pkg = File.createTempFile("novacom-installer-" + arch + "-", ".pkg");
            copyResource(resource, pkg);
            logger.info("novacomd is not running; opening " + resource + " in Installer");
            int code = run("open", "-W", pkg.getAbsolutePath());
            logger.info("Installer exited with: " + code);
        } catch (Exception e) {
            logger.log(Level.WARNING, "couldn't install the novacom driver", e);
        } finally {
            if (pkg != null && !pkg.delete()) {
                pkg.deleteOnExit();
            }
        }
        // The package's postinstall starts novacomd; give it a moment.
        for (int i = 0; i < 20; i++) {
            if (novacomdAnswers()) {
                logger.info("novacomd is running after the install");
                return true;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                break;
            }
        }
        logger.warning("novacomd is still not running");
        return false;
    }

    /** Whether novacomd accepts a connection on this computer. */
    private boolean novacomdAnswers() {
        Socket s = new Socket();
        try {
            s.connect(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), NOVACOMD_PORT), 1000);
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            try {
                s.close();
            } catch (Exception e) {
                // nothing to do
            }
        }
    }

    /** Whether this Mac has an Apple silicon processor, whatever architecture this Java runs as. */
    private boolean appleSilicon() {
        try {
            Process p = new ProcessBuilder("sysctl", "-n", "hw.optional.arm64").redirectErrorStream(true).start();
            p.getOutputStream().close();
            InputStream in = p.getInputStream();
            StringBuilder out = new StringBuilder();
            byte[] buf = new byte[64];
            for (int n; (n = in.read(buf)) > 0; ) {
                out.append(new String(buf, 0, n, "US-ASCII"));
            }
            p.waitFor();
            String answer = out.toString().trim();
            logger.info("hw.optional.arm64: " + answer);
            if (answer.equals("1")) {
                return true;
            }
            if (answer.equals("0")) {
                return false;
            }
        } catch (Exception e) {
            logger.log(Level.INFO, "couldn't ask sysctl; going by os.arch", e);
        }
        // An Intel Mac has no such sysctl name. Java itself is the fallback.
        String arch = System.getProperty("ce.os.arch", System.getProperty("os.arch", "")).toLowerCase();
        return arch.indexOf("aarch64") >= 0 || arch.indexOf("arm") >= 0;
    }

    private void copyResource(String resource, File to) throws Exception {
        InputStream in = CEDriversMgr.class.getResourceAsStream(resource);
        if (in == null) {
            throw new Exception(resource + " is not in the JAR");
        }
        OutputStream out = new FileOutputStream(to);
        try {
            byte[] buf = new byte[65536];
            for (int n; (n = in.read(buf)) > 0; ) {
                out.write(buf, 0, n);
            }
        } finally {
            out.close();
            in.close();
        }
    }

    private int run(String... command) throws Exception {
        Process p = new ProcessBuilder(command).redirectErrorStream(true).start();
        p.getOutputStream().close();
        InputStream in = p.getInputStream();
        byte[] buf = new byte[4096];
        while (in.read(buf) > 0) {
            // discard
        }
        return p.waitFor();
    }
}
