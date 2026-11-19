/*
 * A server's back-off, kept for Palm's mojomail-eas (preload.c's curl glue).
 *
 * Exchange Online throttles a device partnership: a reply carries X-MS-BackOffDuration
 * ("L/<milliseconds>"), or a 503 or 429 carries Retry-After (seconds) and X-MS-ASThrottle (the
 * reason, RecentCommands and the like). Palm's service, written before any of that, reads none
 * of it and keeps asking, and every request in the back-off lengthens it: one crash loop locked
 * the Fold3 out for hours (2026-11-06). Here the reply's headers are read, and the host's
 * "not before" time is kept in a file of hosts, so that it outlives the service process: the
 * service exits when idle and is started again, and a crash loop is a new process each time.
 * Until that time a request to the host doesn't go out (preload.c makes it fail locally, as a
 * network error the service retries later).
 *
 * Scoped by what the server says, never by "every EAS request": a server that sends none of
 * these headers (Zoho, an Exchange of one's own that doesn't throttle) is never held back.
 *
 * No dependencies beyond libc, so LunaRuntimes/pdk/tests/backoff_test.c builds it on the build
 * machine.
 */
#ifndef LUNACY_BACKOFF_H
#define LUNACY_BACKOFF_H

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <time.h>
#include <unistd.h>

/* The longest back-off kept, whatever a header says: a garbled value can't lock a host out for good. */
#define BO_MAX_SECONDS (6 * 3600)
/* A throttle reason with no duration at all: about what Exchange Online's Retry-After said (15 min). */
#define BO_THROTTLE_SECONDS 900

/* What one reply's headers said. */
struct bo_reply {
	int status;              /* the HTTP status, from the status line */
	long backoff_ms;         /* X-MS-BackOffDuration, or -1 */
	long retry_after;        /* Retry-After in seconds, or -1 */
	char throttle[64];       /* X-MS-ASThrottle, or "" */
};

static void bo_reset(struct bo_reply *r)
{
	r->status = 0; r->backoff_ms = -1; r->retry_after = -1; r->throttle[0] = 0;
}

/* The header's value if line is that header (case-insensitive name), else NULL. */
static const char *bo_value(const char *line, size_t len, const char *name, size_t *vlen)
{
	size_t n = strlen(name);
	if (len <= n || strncasecmp(line, name, n) != 0 || line[n] != ':') return NULL;
	const char *v = line + n + 1, *end = line + len;
	while (v < end && (*v == ' ' || *v == '\t')) v++;
	while (end > v && (end[-1] == '\r' || end[-1] == '\n' || end[-1] == ' ' || end[-1] == '\t')) end--;
	*vlen = (size_t)(end - v);
	return v;
}

/* A run of digits at the start of v (at most vlen bytes), or -1. */
static long bo_number(const char *v, size_t vlen)
{
	long n = 0; size_t i = 0;
	if (!vlen || !isdigit((unsigned char)v[0])) return -1;
	for (; i < vlen && isdigit((unsigned char)v[i]); i++) {
		if (n > 100000000L) return 100000000L;   /* enough: capped later */
		n = n * 10 + (v[i] - '0');
	}
	return n;
}

/* One header line as curl hands it to a header callback (with its CRLF, not 0-terminated). */
static void bo_header(struct bo_reply *r, const char *line, size_t len)
{
	size_t vlen;
	const char *v;
	/* A status line starts a reply's headers afresh (a 100 Continue, a redirect, then the reply). */
	if (len > 12 && strncmp(line, "HTTP/", 5) == 0) {
		const char *sp = memchr(line, ' ', len);
		bo_reset(r);
		if (sp && (size_t)(sp - line) + 4 <= len) r->status = (int)bo_number(sp + 1, 3);
		return;
	}
	if ((v = bo_value(line, len, "X-MS-BackOffDuration", &vlen))) {
		/* "L/300000": milliseconds after the slash. */
		const char *slash = memchr(v, '/', vlen);
		if (slash) r->backoff_ms = bo_number(slash + 1, vlen - (size_t)(slash + 1 - v));
		else r->backoff_ms = bo_number(v, vlen);
	} else if ((v = bo_value(line, len, "Retry-After", &vlen))) {
		r->retry_after = bo_number(v, vlen);   /* an HTTP date isn't read: Exchange sends seconds */
	} else if ((v = bo_value(line, len, "X-MS-ASThrottle", &vlen))) {
		size_t k = vlen < sizeof r->throttle - 1 ? vlen : sizeof r->throttle - 1;
		memcpy(r->throttle, v, k); r->throttle[k] = 0;
	}
}

/*
 * How long the server asked to be left alone, in seconds; 0 for an ordinary reply. Microsoft's
 * own back-off counts whatever the status; Retry-After only with a 503 or 429, where it means
 * "come back later" (on a 3xx it means something else); a throttle reason alone gets the
 * 15 minutes Exchange Online has asked for.
 */
static long bo_seconds(const struct bo_reply *r)
{
	long s = 0;
	if (r->backoff_ms > 0) s = (r->backoff_ms + 999) / 1000;
	if ((r->status == 503 || r->status == 429) && r->retry_after > s) s = r->retry_after;
	if (s == 0 && r->throttle[0] && (r->status == 503 || r->status == 429)) s = BO_THROTTLE_SECONDS;
	return s > BO_MAX_SECONDS ? BO_MAX_SECONDS : s;
}

/*
 * The store: one "host until" line per host (until in seconds since the epoch), in a file that
 * every service process reads. Small (a host or two); rewritten whole, through a temporary file
 * renamed over it, so a reader never sees half of it.
 */
#define BO_HOSTS 16

/* The time before which host is to be left alone, from the store; 0 if none. */
static long bo_until(const char *path, const char *host)
{
	FILE *f = fopen(path, "r");
	if (!f) return 0;
	char line[256], h[200];
	long until = 0, u;
	while (fgets(line, sizeof line, f))
		if (sscanf(line, "%199s %ld", h, &u) == 2 && strcmp(h, host) == 0) until = u;
	fclose(f);
	return until;
}

/* Keeps "host until"; entries already past are dropped on the way. 0 on success. */
static int bo_set(const char *path, const char *host, long until, long now)
{
	char hosts[BO_HOSTS][200]; long untils[BO_HOSTS];
	int n = 0;
	FILE *f = fopen(path, "r");
	if (f) {
		char line[256], h[200]; long u;
		while (n < BO_HOSTS - 1 && fgets(line, sizeof line, f))
			if (sscanf(line, "%199s %ld", h, &u) == 2 && strcmp(h, host) != 0 && u > now) {
				snprintf(hosts[n], sizeof hosts[n], "%s", h); untils[n++] = u;
			}
		fclose(f);
	}
	snprintf(hosts[n], sizeof hosts[n], "%s", host); untils[n++] = until;
	char tmp[1024];
	if (snprintf(tmp, sizeof tmp, "%s.%ld", path, (long)getpid()) >= (int)sizeof tmp) return -1;
	f = fopen(tmp, "w");
	if (!f) return -1;
	for (int i = 0; i < n; i++) fprintf(f, "%s %ld\n", hosts[i], untils[i]);
	if (fclose(f) != 0) { remove(tmp); return -1; }
	if (rename(tmp, path) != 0) { remove(tmp); return -1; }
	return 0;
}

#endif
