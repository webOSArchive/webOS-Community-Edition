#!/bin/bash
# A stand-in provider and a local copy of the broker, for testing com.palm.service.oauth
# without Google or Microsoft (Docs/EMAIL-MODERNIZATION-PLAN.md, phase 2).
#
#   tools/oauth-test/servers.sh start [host]    host: this machine's LAN address (default: the
#                                               first one), so a TouchPad reaches them too
#   tools/oauth-test/servers.sh stop
#
#   :8091  Lunacy's Workbench/oauth-test/fake-provider.py (run from ../Lunacy, never changed):
#          OAuth 2 with refresh, /admin/expire and /admin/revoke; the account is dummy@lunacy.test
#   :8092  ../oauth-broker-for-webos, a scratch copy in Docker (php:8.3-cli), with one app,
#          `fake`, that points at the stand-in
#
# test.js runs against them; device-providers.json (written by start) is what a TouchPad's
# /var/palm/data/com.palm.service.oauth/providers.json should hold to use them.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
W=$ROOT/build/work/oauth-test
BROKER_SRC=${BROKER_SRC:-$ROOT/../oauth-broker-for-webos}
FAKE=${FAKE:-$ROOT/../Lunacy/Workbench/oauth-test/fake-provider.py}

stop() {
    docker rm -f ce-oauth-broker >/dev/null 2>&1 || true
    [ -f "$W/fake.pid" ] && kill "$(cat "$W/fake.pid")" 2>/dev/null || true
    rm -f "$W/fake.pid"
}

case "$1" in
stop) stop ;;
start)
    HOST=${2:-$(hostname -I | awk '{print $1}')}
    [ -f "$FAKE" ] && [ -d "$BROKER_SRC" ] || { echo "need $FAKE and $BROKER_SRC" >&2; exit 1; }
    stop
    rm -rf "$W/broker"; mkdir -p "$W/broker" "$W/cache"; chmod 777 "$W/cache"
    cp -r "$BROKER_SRC"/*.php "$BROKER_SRC/lib" "$W/broker/"
    mkdir -p "$W/broker/apps/fake"
    cat > "$W/broker/config.php" <<PHP
<?php
\$BROKER_BASE_URL = 'http://$HOST:8092';
\$CACHE_PATH = '/cache';
\$CACHE_TTL = 7200;
\$APPS_PATH = __DIR__ . '/apps';
\$DEBUG = true;
PHP
    cat > "$W/broker/apps/fake/config.php" <<PHP
<?php
return array(
    'flow' => 'oauth2_authcode', 'title' => 'Fake Provider',
    'client_id' => 'ce-test', 'client_secret' => 'ce-test-secret',
    'authorize_url' => 'http://$HOST:8091/authorize',
    'token_url' => 'http://$HOST:8091/token',
    'scope' => 'mail openid email',
);
PHP
    ( cd "$W" && nohup python3 -I "$FAKE" --host "$HOST" --expires "${EXPIRES:-3600}" > "$W/fake.log" 2>&1 & echo $! > "$W/fake.pid" )
    docker run -d --rm --name ce-oauth-broker -p 8092:8092 -v "$W/broker:/app:ro" -v "$W/cache:/cache" \
        php:8.3-cli php -S 0.0.0.0:8092 -t /app >/dev/null
    cat > "$HERE/device-providers.json" <<JSON
{
	"broker": "http://$HOST:8092",
	"providers": {
		"google": {
			"title": "Google (test)", "templateId": "org.webosarchive.ce.google", "brokerApp": "fake",
			"mail": { "server": "$HOST", "port": 3145, "encryption": "none",
				"smtpConfig": { "server": "$HOST", "port": 3027, "encryption": "none", "useSmtpAuth": true } }
		}
	}
}
JSON
    for i in 1 2 3 4 5 6 7 8 9 10; do
        curl -s -o /dev/null "http://$HOST:8092/get-code.php?app=fake" && curl -s -o /dev/null "http://$HOST:8091/admin/expire" && { echo "provider http://$HOST:8091, broker http://$HOST:8092"; exit 0; }
        read -t 1 _ < /dev/zero || true
    done
    echo "servers didn't come up; see $W/fake.log and: docker logs ce-oauth-broker" >&2; exit 1 ;;
*) echo "usage: $0 start [host] | stop" >&2; exit 2 ;;
esac
