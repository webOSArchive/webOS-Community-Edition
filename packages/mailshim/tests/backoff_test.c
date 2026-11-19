/*
 * The back-off store (libpreload/backoff.h), on the build machine.
 *
 *   cc -O2 -Wall -I../libpreload backoff_test.c -o backoff_test && ./backoff_test
 *
 * Replies as Exchange Online sends them when it throttles must give the time it asked for, an
 * ordinary reply (or another server's) must give none, and the store must keep each host's time
 * across readers, dropping times already past.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "backoff.h"

static int failures;

static void check(int ok, const char *what)
{
	if (!ok) { printf("FAIL: %s\n", what); failures++; }
}

static long reply(const char *const *lines)
{
	struct bo_reply r; bo_reset(&r);
	for (; *lines; lines++) bo_header(&r, *lines, strlen(*lines));
	return bo_seconds(&r);
}

int main(void)
{
	/* Exchange Online's throttle, as the Fold3 got it on 2026-11-06. */
	const char *ms[] = { "HTTP/1.1 503 Service Unavailable\r\n", "Content-Length: 0\r\n",
		"Retry-After: 900\r\n", "X-MS-ASThrottle: RecentCommands\r\n", "X-MS-BackOffDuration: L/300000\r\n", "\r\n", NULL };
	check(reply(ms) == 900, "503 with Retry-After 900 and a 300 s back-off: the longer");
	const char *ms2[] = { "HTTP/1.1 200 OK\r\n", "x-ms-backoffduration: L/12345\r\n", "\r\n", NULL };
	check(reply(ms2) == 13, "a back-off on a 200, any case, rounded up to whole seconds");
	const char *throttle[] = { "HTTP/1.1 503 Service Unavailable\r\n", "X-MS-ASThrottle: RecentCommands\r\n", "\r\n", NULL };
	check(reply(throttle) == BO_THROTTLE_SECONDS, "a throttle reason alone");
	const char *ok[] = { "HTTP/1.1 200 OK\r\n", "MS-ASProtocolVersions: 2.5,12.0,12.1,14.0,14.1\r\n", "\r\n", NULL };
	check(reply(ok) == 0, "an ordinary reply");
	const char *moved[] = { "HTTP/1.1 301 Moved Permanently\r\n", "Retry-After: 120\r\n", "\r\n", NULL };
	check(reply(moved) == 0, "Retry-After on a redirect isn't a back-off");
	const char *plain503[] = { "HTTP/1.1 503 Service Unavailable\r\n", "\r\n", NULL };
	check(reply(plain503) == 0, "a 503 that asks for nothing");
	const char *busy[] = { "HTTP/1.1 429 Too Many Requests\r\n", "Retry-After:  30 \r\n", "\r\n", NULL };
	check(reply(busy) == 30, "a 429's Retry-After");
	const char *huge[] = { "HTTP/1.1 503 Service Unavailable\r\n", "Retry-After: 99999999999\r\n", "\r\n", NULL };
	check(reply(huge) == BO_MAX_SECONDS, "a garbled duration is capped");
	const char *again[] = { "HTTP/1.1 100 Continue\r\n", "Retry-After: 60\r\n", "\r\n", "HTTP/1.1 200 OK\r\n", "\r\n", NULL };
	check(reply(again) == 0, "a later status line starts afresh");

	char path[] = "/tmp/backoff_test_XXXXXX";
	int fd = mkstemp(path);
	check(fd >= 0, "temporary file");
	close(fd); remove(path);
	check(bo_until(path, "outlook.office365.com") == 0, "no store: nothing held");
	check(bo_set(path, "outlook.office365.com", 2000, 1000) == 0, "kept");
	check(bo_set(path, "example.com", 1500, 1000) == 0, "a second host");
	check(bo_until(path, "outlook.office365.com") == 2000, "read back");
	check(bo_until(path, "example.com") == 1500, "the second read back");
	check(bo_until(path, "msync.zoho.com") == 0, "another host is never held");
	check(bo_set(path, "outlook.office365.com", 2500, 1600) == 0, "renewed, the past one dropped");
	check(bo_until(path, "outlook.office365.com") == 2500, "renewed time");
	check(bo_until(path, "example.com") == 0, "a time already past is gone");
	remove(path);

	if (failures) { printf("backoff: %d failed\n", failures); return 1; }
	printf("backoff: all passed\n");
	return 0;
}
