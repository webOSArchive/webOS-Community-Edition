#!/usr/bin/env python3
"""Static file server with HTTP Range support (python's http.server has none,
which makes every seek over HTTP look broken). Logs the Range header per GET."""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
            else:  # suffix range
                start = max(0, size - int(m.group(2)))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return None
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.log_message('range=%s -> %d-%d/%d', rng, start, end, size)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f = open(path, "rb")
        f.seek(start)
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining > 0:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

if __name__ == "__main__":
    # rangeserver.py [port] [--tls CERT KEY]  -- --tls serves TLS 1.3 ONLY, which
    # the stock webOS media stack (GnuTLS 2.10) cannot negotiate
    args = sys.argv[1:]
    port = int(args[0]) if args and args[0].isdigit() else 8080
    srv = ThreadingHTTPServer(("0.0.0.0", port), RangeHandler)
    if "--tls" in args:
        import ssl
        i = args.index("--tls")
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
        ctx.load_cert_chain(args[i + 1], args[i + 2])
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()
