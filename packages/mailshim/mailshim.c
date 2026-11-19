/*
 * libce-mailshim.so: preloaded into Palm's mail services on webOS CE, beside libssl_compat.so
 * (Docs/EMAIL-MODERNIZATION-PLAN.md). It stands in front of three things the services reach
 * through the dynamic linker - libcurl (mojomail-eas, through libemail-common and libglibcurl),
 * LSMessageRespond (libmojoluna) and glib's channel reads and writes (IMAP and SMTP) - and
 * changes what Palm's unchanged binaries say on the wire.
 *
 * This file is the mail part of Lunacy's LunaRuntimes/pdk/libpreload/preload.c (its line 1260
 * to the end; see README.md for the commit), with CE's differences: no webOS root to map paths
 * into, the log goes to syslog, and the adapters are split by build switches so that an image
 * only carries what has been tested on a TouchPad:
 *
 *   always                 an event's time zone in Windows' form (calfilter.h, calf_fix_zones),
 *                          a server's back-off kept (backoff.h), and a throttled sign-in said
 *                          as "unavailable" (easerr.h). They work against any Exchange server.
 *   CE_MAILSHIM_EAS16=1    the Exchange Online adapters: version, provisioning, device
 *                          information, the 16.1 reply filter, ComposeMail, calendar items and
 *                          exceptions, attachments as ItemOperations. Phase 3.
 *   CE_MAILSHIM_OAUTH=1    an OAuth handle as the password becomes a bearer token (Exchange)
 *                          or XOAUTH2 (IMAP, SMTP; mailauth.h). The token comes from
 *                          palm://com.palm.service.oauth/token (ma_token). Phase 3.
 *   CE_MAILSHIM_DUMP=1     development only: request and reply bodies to a file (lc_dump).
 *
 * The headers in lunacy/ are Lunacy's, unchanged; a switched-off adapter's code is not in the
 * binary (its static functions are never referenced).
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <syslog.h>
#include <time.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include "mailauth.h"
#include "wbxmlfilter.h"
#include "composemail.h"
#include "attfetch.h"
#include "backoff.h"
#include "calfilter.h"
#include "easerr.h"

#ifndef CE_MAILSHIM_EAS16
#define CE_MAILSHIM_EAS16 0
#endif
#ifndef CE_MAILSHIM_OAUTH
#define CE_MAILSHIM_OAUTH 0
#endif
#ifndef CE_MAILSHIM_DUMP
#define CE_MAILSHIM_DUMP 0
#endif
#if CE_MAILSHIM_OAUTH && !CE_MAILSHIM_EAS16
#error "CE_MAILSHIM_OAUTH is built with CE_MAILSHIM_EAS16: an OAuth Exchange account is Exchange Online"
#endif

/* The services' stderr goes nowhere on a TouchPad; /var/log/messages is where one looks.
   CE_MAILSHIM_STDERR is for the build machine's tests. */
static void shim_log(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
static void shim_log(const char *fmt, ...)
{
	va_list ap;
	va_start(ap, fmt);
#ifdef CE_MAILSHIM_STDERR
	fputs("ce-mailshim: ", stderr);
	vfprintf(stderr, fmt, ap);
#else
	char line[512];
	vsnprintf(line, sizeof line, fmt, ap);
	line[strcspn(line, "\n")] = 0;
	syslog(LOG_INFO, "ce-mailshim: %s", line);
#endif
	va_end(ap);
}

/*
 * The replies of the mail services' bus: the Exchange validator's answer to a throttling server
 * said as webOS words it (easerr.h); every other reply passes as it was. libmojoluna calls
 * LSMessageRespond through the dynamic linker, so this stands in front of it.
 */
typedef struct LSMessage LSMessage;
typedef struct LSError LSError;
bool LSMessageRespond(LSMessage *m, const char *payload, LSError *e)
{
	static bool (*real)(LSMessage *, const char *, LSError *);
	if (!real) real = (bool (*)(LSMessage *, const char *, LSError *))dlsym(RTLD_NEXT, "LSMessageRespond");
	if (!real) return false;
	char *again = ee_reply(payload);
	if (!again) return real(m, payload, e);
	shim_log("a throttled server's sign-in answered as unavailable, not as a bad login\n");
	bool r = real(m, again, e);
	free(again);
	return r;
}

static void *ma_next(const char *name) { return dlsym(RTLD_NEXT, name); }

#if CE_MAILSHIM_OAUTH
/* ---- OAuth for IMAP and SMTP (mailauth.h; Lunacy's Docs/oauth.md) ----
 *
 * Palm's mail services read and write their connections, plain and TLS alike, with glib's
 * g_io_channel_read_chars and g_io_channel_write_chars (libemail-common's GIOChannelWrapper,
 * over libpalmsocket's channels). Here those calls pass through mailauth.h, which turns a login
 * carrying an OAuth handle into XOAUTH2. Channels on files and pipes are left alone. The four
 * glib types used are its ABI.
 */
typedef int GIOStatus;   /* G_IO_STATUS_ERROR 0, NORMAL 1, EOF 2, AGAIN 3 */
enum { MA_G_ERROR = 0, MA_G_NORMAL = 1, MA_G_AGAIN = 3 };
typedef struct { int ref_count; } GIOChannel;   /* glib 2's public struct starts so */
typedef struct _GError GError;
GIOStatus g_io_channel_write_chars(GIOChannel *, const char *, long, size_t *, GError **);
GIOStatus g_io_channel_read_chars(GIOChannel *, char *, size_t, size_t *, GError **);
GIOChannel *g_io_channel_new_file(const char *, const char *, GError **);
GIOChannel *g_io_channel_unix_new(int);
void g_io_channel_unref(GIOChannel *);

#define MA_CHANNELS 64
static struct ma_channel { GIOChannel *ch; int excluded; struct mailauth *m; } ma_channels[MA_CHANNELS];
static pthread_mutex_t ma_lock = PTHREAD_MUTEX_INITIALIZER;

/* The channel's entry, made when make is set (an excluded channel needs no state). */
static struct ma_channel *ma_find(GIOChannel *ch, int make)
{
	struct ma_channel *free_slot = NULL;
	for (int i = 0; i < MA_CHANNELS; i++) {
		if (ma_channels[i].ch == ch) return &ma_channels[i];
		if (!ma_channels[i].ch && !free_slot) free_slot = &ma_channels[i];
	}
	if (!make || !free_slot) return NULL;
	free_slot->ch = ch; free_slot->excluded = 0; free_slot->m = NULL;
	return free_slot;
}

static void ma_exclude(GIOChannel *ch)
{
	if (!ch) return;
	pthread_mutex_lock(&ma_lock);
	struct ma_channel *c = ma_find(ch, 1);
	if (c) c->excluded = 1;
	pthread_mutex_unlock(&ma_lock);
}

GIOChannel *g_io_channel_new_file(const char *name, const char *mode, GError **err)
{
	static GIOChannel *(*real)(const char *, const char *, GError **);
	if (!real) real = ma_next("g_io_channel_new_file");
	GIOChannel *ch = real(name, mode, err);
	ma_exclude(ch);
	return ch;
}

GIOChannel *g_io_channel_unix_new(int fd)
{
	static GIOChannel *(*real)(int);
	if (!real) real = ma_next("g_io_channel_unix_new");
	GIOChannel *ch = real(fd);
	struct stat st;
	if (fstat(fd, &st) != 0 || !S_ISSOCK(st.st_mode)) ma_exclude(ch);
	return ch;
}

void g_io_channel_unref(GIOChannel *ch)
{
	static void (*real)(GIOChannel *);
	if (!real) real = ma_next("g_io_channel_unref");
	if (ch && ch->ref_count == 1) {   /* this unref frees it: its address can come back as another channel */
		pthread_mutex_lock(&ma_lock);
		struct ma_channel *c = ma_find(ch, 0);
		if (c) { if (c->m) { mailauth_free(c->m); free(c->m); } c->ch = NULL; c->m = NULL; c->excluded = 0; }
		pthread_mutex_unlock(&ma_lock);
	}
	real(ch);
}

static GIOStatus (*ma_real_write)(GIOChannel *, const char *, long, size_t *, GError **);
static GIOStatus (*ma_real_read)(GIOChannel *, char *, size_t, size_t *, GError **);

/* All of p to the server, waiting out a full socket (the lines sent here are short). */
static int ma_send(void *ctx, const char *p, size_t n)
{
	GIOChannel *ch = ctx;
	int waited = 0;
	while (n) {
		size_t w = 0;
		GIOStatus s = ma_real_write(ch, p, (long)n, &w, NULL);
		if (s == MA_G_NORMAL || s == MA_G_AGAIN) { p += w; n -= w; }
		else return -1;
		if (n && !w) { if (++waited > 15000) return -1; usleep(1000); }
	}
	return 0;
}

/* A JSON string's contents, escaped. */
static size_t ma_json(char *out, size_t cap, const char *s)
{
	size_t o = 0;
	for (; *s && o + 7 < cap; s++) {
		unsigned char c = (unsigned char)*s;
		if (c == '"' || c == '\\') { out[o++] = '\\'; out[o++] = (char)c; }
		else if (c < 0x20) o += (size_t)snprintf(out + o, cap - o, "\\u%04x", c);
		else out[o++] = (char)c;
	}
	out[o] = 0;
	return o;
}

/*
 * The access token for a handle: mailauth_io's token (1, or 2 for one just issued; 0 for a
 * handle the service doesn't know; -1 when no token can be had now - the service unreachable,
 * or the provider for a refresh).
 *
 * Lunacy asks its OAuth service over its own bus socket. CE asks
 * palm://com.palm.service.oauth/token on the private bus, by running luna-send (plan D3):
 * about half a second on a TouchPad, a second and a half when the service has to start
 * (measured 2026-11-19). mojomail-eas sets its credentials for every request, so a token is
 * kept here for as long as the service says it lasts, less five minutes; a token the server
 * refused (stale) is always asked for again.
 */
#include <signal.h>
#include <sys/wait.h>
#ifndef CE_LUNA_SEND
#define CE_LUNA_SEND "/usr/bin/luna-send"
#endif
#define MA_KEPT 4
static struct ma_kept { char handle[64]; char token[MAILAUTH_TOKEN_MAX]; long until, fresh_until; } ma_kept[MA_KEPT];
static pthread_mutex_t ma_kept_lock = PTHREAD_MUTEX_INITIALIZER;

/* The wall clock (the monotonic one is in librt on the TouchPad's glibc): a clock set back only
   keeps a token past its time, which the server then refuses, and a refused token is asked for again. */
static long ma_clock(void) { return (long)time(NULL); }

/* luna-send's one reply to the token call, into reply; its length, or -1. */
static long ma_ask(const char *handle, int stale, char *reply, size_t cap)
{
	char payload[128];
	int fds[2];
	snprintf(payload, sizeof payload, "{\"handle\":\"%s\"%s}", handle, stale ? ",\"stale\":true" : "");
	if (pipe(fds) != 0) return -1;
	pid_t pid = fork();
	if (pid < 0) { close(fds[0]); close(fds[1]); return -1; }
	if (pid == 0) {
		/* luna-send without a terminal needs its input from /dev/null. */
		int null = open("/dev/null", O_RDWR);
		if (null >= 0) { dup2(null, 0); dup2(null, 2); }
		dup2(fds[1], 1);
		for (int fd = 3; fd < 256; fd++) close(fd);   /* the service's sockets aren't luna-send's */
		unsetenv("LD_PRELOAD");
		execl(CE_LUNA_SEND, "luna-send", "-n", "1", "palm://com.palm.service.oauth/token", payload, (char *)NULL);
		_exit(127);
	}
	close(fds[1]);
	size_t got = 0;
	long deadline = ma_clock() + 40;   /* a refresh is one curl call of at most 25 s in the service */
	while (got < cap - 1) {
		long left = deadline - ma_clock();
		struct pollfd pf = { fds[0], POLLIN, 0 };
		if (left <= 0 || poll(&pf, 1, (int)(left * 1000)) <= 0) break;
		ssize_t r = read(fds[0], reply + got, cap - 1 - got);
		if (r <= 0) break;
		got += (size_t)r;
	}
	close(fds[0]);
	reply[got] = 0;
	int status;
	if (waitpid(pid, &status, WNOHANG) == 0) { kill(pid, SIGKILL); waitpid(pid, &status, 0); }
	return (long)got;
}

static int ma_token(void *ctx, const char *user, const char *handle, int stale, char *buf, size_t cap)
{
	(void)ctx; (void)user;
	/* Only what goes safely into the request: the handles the service makes. */
	size_t hl = strlen(handle);
	if (hl >= sizeof ma_kept[0].handle || strspn(handle, "abcdefghijklmnopqrstuvwxyz0123456789:") != hl) return 0;
	long now = ma_clock();
	pthread_mutex_lock(&ma_kept_lock);
	struct ma_kept *k = NULL, *spare = &ma_kept[0];
	for (int i = 0; i < MA_KEPT; i++) {
		if (strcmp(ma_kept[i].handle, handle) == 0) k = &ma_kept[i];
		else if (ma_kept[i].until < spare->until) spare = &ma_kept[i];   /* an empty one, or the soonest to end */
	}
	if (k && !stale && now < k->until && strlen(k->token) < cap) {
		strcpy(buf, k->token);
		int r = now < k->fresh_until ? 2 : 1;
		pthread_mutex_unlock(&ma_kept_lock);
		return r;
	}
	if (k) { memset(k, 0, sizeof *k); }   /* refused, or run out */
	pthread_mutex_unlock(&ma_kept_lock);

	static char reply[MAILAUTH_TOKEN_MAX + 4096];
	static pthread_mutex_t ask_lock = PTHREAD_MUTEX_INITIALIZER;
	pthread_mutex_lock(&ask_lock);
	long got = ma_ask(handle, stale, reply, sizeof reply);
	int r = -1;
	long expires_in = 0;
	if (got > 0 && strstr(reply, "\"returnValue\":true")) {
		const char *t = strstr(reply, "\"accessToken\":\""), *e = strstr(reply, "\"expiresIn\":");
		if (t) {
			size_t o = 0;
			for (t += 15; *t && *t != '"' && o + 1 < cap; t++) {
				if (*t == '\\' && t[1]) t++;   /* \/ and the like: tokens are printable ASCII */
				buf[o++] = *t;
			}
			buf[o] = 0;
			r = strstr(reply, "\"fresh\":true") ? 2 : 1;
			if (e) expires_in = atol(e + 12);
		}
	} else if (got > 0 && strstr(reply, "\"errorCode\":-11")) r = 0;   /* no such handle; any other error, or no answer, is for now */
	if (got > 0) memset(reply, 0, (size_t)got);
	pthread_mutex_unlock(&ask_lock);
	if (r > 0 && buf[0] && expires_in > 360 && strlen(buf) < sizeof ma_kept[0].token) {
		pthread_mutex_lock(&ma_kept_lock);
		k = spare;
		memset(k, 0, sizeof *k);
		snprintf(k->handle, sizeof k->handle, "%s", handle);
		strcpy(k->token, buf);
		k->until = now + expires_in - 300;
		k->fresh_until = r == 2 ? now + 60 : 0;
		pthread_mutex_unlock(&ma_kept_lock);
	}
	return r;
}

GIOStatus g_io_channel_write_chars(GIOChannel *ch, const char *buf, long count, size_t *written, GError **err)
{
	if (!ma_real_write) ma_real_write = ma_next("g_io_channel_write_chars");
	if (count < 0) count = buf ? (long)strlen(buf) : 0;
	pthread_mutex_lock(&ma_lock);
	struct ma_channel *c = ma_find(ch, 1);
	if (!c || c->excluded || !count) { pthread_mutex_unlock(&ma_lock); return ma_real_write(ch, buf, count, written, err); }
	if (!c->m && (c->m = calloc(1, sizeof *c->m))) mailauth_init(c->m);
	struct mailauth *m = c->m;
	pthread_mutex_unlock(&ma_lock);
	if (!m) return ma_real_write(ch, buf, count, written, err);
	struct mailauth_io io = { ma_send, ma_token, ch };
	int direct;
	long r = mailauth_out(m, &io, buf, (size_t)count, &direct);
	if (r < 0) { if (written) *written = 0; return MA_G_ERROR; }
	if (direct) {
		size_t w = 0;
		GIOStatus s = ma_real_write(ch, buf, r, &w, err);
		if (w < (size_t)r) m->out_mode = MA_PASS;   /* the rest of the line is still to come */
		if (written) *written = w;
		return s;
	}
	if (written) *written = (size_t)r;
	return MA_G_NORMAL;
}

GIOStatus g_io_channel_read_chars(GIOChannel *ch, char *buf, size_t count, size_t *got, GError **err)
{
	if (!ma_real_read) ma_real_read = ma_next("g_io_channel_read_chars");
	if (!ma_real_write) ma_real_write = ma_next("g_io_channel_write_chars");
	pthread_mutex_lock(&ma_lock);
	struct ma_channel *c = ma_find(ch, 0);
	struct mailauth *m = c && !c->excluded ? c->m : NULL;
	pthread_mutex_unlock(&ma_lock);
	if (!m || !count) return ma_real_read(ch, buf, count, got, err);
	size_t n = mailauth_pending(m, buf, count);
	if (n) { if (got) *got = n; return MA_G_NORMAL; }
	size_t r = 0;
	GIOStatus s = ma_real_read(ch, buf, count, &r, err);
	if (got) *got = r;
	if (s != MA_G_NORMAL || !r || !mailauth_watching(m)) return s;
	struct mailauth_io io = { ma_send, ma_token, ch };
	long k = mailauth_in(m, &io, buf, r, count);
	if (k < 0) { if (got) *got = 0; return MA_G_ERROR; }
	if (got) *got = (size_t)k;
	return k ? MA_G_NORMAL : MA_G_AGAIN;
}

#endif /* CE_MAILSHIM_OAUTH */

/* ---- Exchange ActiveSync: libcurl ----
 *
 * (Lunacy's "OAuth for Exchange ActiveSync", Docs/oauth.md; the bearer part is CE_MAILSHIM_OAUTH.)
 * mojomail-eas reaches its server through libemail-common's CurlConnection, which hands curl
 * the account's "user:password" as CURLOPT_USERPWD (Basic auth) and its own headers as
 * CURLOPT_HTTPHEADER. A password that is an OAuth handle is taken out here: the request goes
 * without Basic auth and with `Authorization: Bearer <token>` added to its own header list
 * (a copy, so the caller's list is never changed). A 401 to a bearer request marks the token
 * refused, so the next login asks for a fresh one (mailauth.h's stale), as for IMAP. Every
 * other option and request passes as it was.
 */
typedef void CURL;
struct curl_slist { char *data; struct curl_slist *next; };
typedef size_t (*lc_header_fn)(char *, size_t, size_t, void *);
typedef size_t (*lc_read_fn)(char *, size_t, size_t, void *);
typedef int (*lc_seek_fn)(void *, long long, int);   /* curl_off_t is 64-bit here (the *_LARGE options) */
#define LC_CURLOPT_USERPWD 10005
#define LC_CURLOPT_HTTPHEADER 10023
#define LC_CURLOPT_HTTPAUTH 107
#define LC_CURLINFO_RESPONSE_CODE 0x200002
#define LC_OFF_T_BASE 30000

#define LC_HANDLES 32
static struct lc_handle {
	CURL *h;
	struct curl_slist *theirs;     /* the caller's own header list */
	struct curl_slist *ours;       /* theirs + Authorization, set in its place */
	char bearer[MAILAUTH_TOKEN_MAX];
	char handle[64];
	lc_header_fn their_header;     /* the caller's header callback, and its data */
	void *header_data;
	lc_header_fn their_write;      /* the caller's body callback, and its data */
	void *write_data;
	char host[128];                /* the request's server, for the versions it offers */
	long post_size;                /* the request body's size, as the caller set it */
	int initial_provision;         /* the body is Palm's initial Provision (lc_with_device_info) */
	unsigned char *post;           /* a body of ours set in place of the caller's */
	int body_seen;                 /* bytes of this response's body looked at */
	int provision;                 /* the body asked for provisioning (status 142-144) */
	int filtering;                 /* the body goes through wbxmlfilter.h (a 16.1 reply to a 12.1 client) */
	struct wbxf wbxf;
	lc_read_fn their_read;         /* the caller's request body callback, and its data */
	void *read_data;
	lc_seek_fn their_seek;         /* the caller's rewind callback, and its data */
	void *seek_data;
	int sending;                   /* this request is a send, in ComposeMail form (composemail.h) */
	unsigned char cm_pre[1024];    /* the bytes before the message */
	size_t cm_pre_len, cm_pos;     /* and how far into the prefix or suffix */
	int cm_phase;                  /* 0 prefix, 1 the caller's message, 2 suffix, 3 done */
	int send_status;               /* the reply's ComposeMail status */
	struct bo_reply bo;            /* what this reply's headers say about backing off (backoff.h) */
	char url[1024];                /* the request's own URL, while one held back stands in for it */
	int held;                      /* the URL set is the stand-in: the host's back-off hadn't passed */
	int no_token;                  /* an OAuth handle with no token to be had just now: the request fails locally */
	int token_final;               /* the token sent was fresh, or a retry's: a 401 to it is the server's last word */
	const void *post_ptr;          /* the request body being sent (the caller's, or ours in its place) */
	int post_fresh;                /* post_ptr was set for the request now being made, not an earlier one */
	int fetching;                  /* this request is a GetAttachment sent as ItemOperations Fetch (attfetch.h) */
	int af_pass;                   /* its reply isn't a 200: headers and body pass as they came */
	int af_ended;                  /* the reply was judged at its end (af_done), af_code its verdict */
	int af_code;
	int af_refused;                /* the caller refused a header or the file's bytes */
	struct af_reply af;
} lc_handles[LC_HANDLES];
static pthread_mutex_t lc_lock = PTHREAD_MUTEX_INITIALIZER;
#if CE_MAILSHIM_EAS16
static int lc_version(const char *host, const char *asked, char *out, size_t cap);
#endif

static int (*lc_real_setopt)(CURL *, int, ...);
static struct curl_slist *(*lc_slist_append)(struct curl_slist *, const char *);
static void (*lc_slist_free)(struct curl_slist *);

static void lc_init(void)
{
	if (!lc_real_setopt) lc_real_setopt = ma_next("curl_easy_setopt");
	if (!lc_slist_append) lc_slist_append = ma_next("curl_slist_append");
	if (!lc_slist_free) lc_slist_free = ma_next("curl_slist_free_all");
#ifdef CE_MAILSHIM_TEST_YEAR
	calf_year = CE_MAILSHIM_TEST_YEAR;   /* the build machine's glue test: the year its sample request is from */
#endif
}

static struct lc_handle *lc_find(CURL *h, int make)
{
	struct lc_handle *free_slot = NULL;
	for (int i = 0; i < LC_HANDLES; i++) {
		if (lc_handles[i].h == h) return &lc_handles[i];
		if (!lc_handles[i].h && !free_slot) free_slot = &lc_handles[i];
	}
	if (!make || !free_slot) return NULL;
	memset(free_slot, 0, sizeof *free_slot);
	free_slot->h = h;
	return free_slot;
}

#if CE_MAILSHIM_EAS16 || CE_MAILSHIM_OAUTH
/* Sets the caller's headers plus the bearer on the handle (lock held). */
static int lc_apply_headers(struct lc_handle *e)
{
	struct curl_slist *list = NULL;
	for (struct curl_slist *s = e->theirs; s; s = s->next) {
		if (e->handle[0] && strncasecmp(s->data, "Authorization:", 14) == 0) continue;
#if CE_MAILSHIM_EAS16
		char v[16], line[64];
		if (e->fetching && strncasecmp(s->data, "Content-Type:", 13) == 0) continue;   /* WBXML, below */
		if (e->sending && strncasecmp(s->data, "Content-Type:", 13) == 0 && strcasecmp(s->data + 13 + strspn(s->data + 13, " "), "message/rfc822") == 0) {
			list = lc_slist_append(list, "Content-Type: application/vnd.ms-sync.wbxml");
		} else if (strncasecmp(s->data, "MS-ASProtocolVersion:", 21) == 0 && lc_version(e->host, s->data + 21 + strspn(s->data + 21, " "), v, sizeof v)) {
			snprintf(line, sizeof line, "MS-ASProtocolVersion: %s", v);
			list = lc_slist_append(list, line);
		} else
#endif
		list = lc_slist_append(list, s->data);
	}
	if (e->fetching) {
		list = lc_slist_append(list, "Content-Type: application/vnd.ms-sync.wbxml");
		list = lc_slist_append(list, "MS-ASAcceptMultiPart: T");
	}
	char line[MAILAUTH_TOKEN_MAX + 32];
	if (e->handle[0]) {
		snprintf(line, sizeof line, "Authorization: Bearer %s", e->bearer);
		list = lc_slist_append(list, line);
	}
	memset(line, 0, sizeof line);
	int r = lc_real_setopt(e->h, LC_CURLOPT_HTTPHEADER, list);
	if (e->ours) lc_slist_free(e->ours);
	e->ours = list;
	return r;
}
#endif

#define LC_CURLOPT_HEADERFUNCTION 20079
#define LC_CURLOPT_HEADERDATA 10029

#if CE_MAILSHIM_EAS16
/*
 * Palm's mojomail-eas speaks EAS 2.5 to 14.1 but takes the highest version a server offers
 * (MS-ASProtocolVersions); Microsoft 365 offers 16.0 and 16.1, and the service then sent 14.1's
 * requests as 16.1 and got 400s. The header is shown to it with only the versions up to 14.1, as
 * a server of its day would have offered. Its header callback (one for every handle in
 * libemail-common, CurlHeaderCallback) is wrapped to do it; every other header passes as it was.
 */

/*
 * The versions the server last offered (MS-ASProtocolVersions, comma-separated). Palm's service
 * sends some requests at a version it chose for itself (FolderSync at 12.1 whatever the server
 * said); a version the server no longer offers - Exchange Online takes 16.1 only since March 2026
 * - is sent as the nearest one it does, the lowest offered above it. FolderSync, Sync and the
 * rest of mail are the same on the wire from 12.1 to 16.1.
 */
#define LC_SERVERS 8
static struct { char host[128]; char offered[128]; } lc_servers[LC_SERVERS];

static char *lc_offered_for(const char *host, int make)
{
	for (int i = 0; i < LC_SERVERS; i++) if (lc_servers[i].host[0] && strcmp(lc_servers[i].host, host) == 0) return lc_servers[i].offered;
	if (!make) return NULL;
	for (int i = 0; i < LC_SERVERS; i++) if (!lc_servers[i].host[0]) { snprintf(lc_servers[i].host, sizeof lc_servers[i].host, "%s", host); return lc_servers[i].offered; }
	snprintf(lc_servers[0].host, sizeof lc_servers[0].host, "%s", host);   /* full: the oldest goes */
	return lc_servers[0].offered;
}

/* The version to send for `asked` to host, into out; 0 when asked is fine as it is (lock held). */
static int lc_version(const char *host, const char *asked, char *out, size_t cap)
{
	const char *offered = host && host[0] ? lc_offered_for(host, 0) : NULL;
	if (!offered || !offered[0]) return 0;
	double want = atof(asked), best = 0;
	char bestv[16] = "";
	const char *p = offered;
	while (*p) {
		const char *q = strchr(p, ','); size_t n = q ? (size_t)(q - p) : strlen(p);
		char one[16]; if (n >= sizeof one) n = sizeof one - 1;
		memcpy(one, p, n); one[n] = 0;
		double v = atof(one);
		if (v > want - 1e-6 && v < want + 1e-6) return 0;              /* offered: as it is */
		if (v > want && (best == 0 || v < best)) { best = v; strcpy(bestv, one); }
		p = q ? q + 1 : p + n;
	}
	if (!bestv[0]) return 0;
	snprintf(out, cap, "%s", bestv);
	return 1;
}
#endif /* CE_MAILSHIM_EAS16 */

/*
 * Development only (CE_MAILSHIM_DUMP=1 builds, never an image's): when /var/preferences/ce-eas-dump
 * names a host (one line), every request body sent to it is appended to /tmp/ce-eas-dump, as
 * "> <url> <length>\n" and the bytes, for decoding on a desk; with CE_MAILSHIM_EAS16, every
 * reply body too ("< <length>\n"). No file, no dump. Bodies hold mail, so the file is for a
 * test account.
 */
#if CE_MAILSHIM_DUMP
static int lc_dump_wanted(const char *host)
{
	char want[128] = "";
	if (!host[0]) return 0;
	FILE *f = fopen("/var/preferences/ce-eas-dump", "r");
	if (!f) return 0;
	if (!fgets(want, sizeof want, f)) want[0] = 0;
	fclose(f);
	want[strcspn(want, "\r\n ")] = 0;
	return want[0] && strcmp(want, host) == 0;
}

static void lc_dump(const char *host, const char *head, const void *bytes, size_t n)
{
	if (!lc_dump_wanted(host)) return;
	FILE *f = fopen("/tmp/ce-eas-dump", "a");
	if (!f) return;
	fprintf(f, "%s %lu\n", head, (unsigned long)n);
	if (n) fwrite(bytes, 1, n, f);
	fputc('\n', f);
	fclose(f);
}
#endif

/*
 * The server's back-off (backoff.h). Kept in a file, so every service process and every restart
 * sees it; while it hasn't passed, a request to that host is pointed at a closed port on this
 * device instead (lc_hold), and fails at once as a network failure, which the service retries
 * later. Nothing reaches the server until the time it asked for. (CE_BACKOFF_FILE: the build
 * machine's glue test keeps its own.)
 */
#ifndef CE_BACKOFF_FILE
#define CE_BACKOFF_FILE "/var/preferences/ce-eas-backoff"
#endif
#define LC_HELD_URL "http://127.0.0.1:1/"

static int lc_backoff_path(char *out, size_t cap)
{
	return snprintf(out, cap, "%s", CE_BACKOFF_FILE) < (int)cap;
}

/* One header line of a reply; at the blank line that ends them, a back-off asked for is kept. */
static void lc_backoff_header(void *data, const char *buf, size_t len)
{
	char host[128] = "", throttle[64] = "";
	long seconds = 0;
	pthread_mutex_lock(&lc_lock);
	for (int i = 0; i < LC_HANDLES; i++) {
		struct lc_handle *e = &lc_handles[i];
		if (!e->h || e->header_data != data || !e->host[0]) continue;
		if (len <= 2 && (len == 0 || buf[0] == '\r' || buf[0] == '\n')) {
			seconds = bo_seconds(&e->bo);
			if (seconds > 0) { snprintf(host, sizeof host, "%s", e->host); snprintf(throttle, sizeof throttle, "%s", e->bo.throttle); }
			bo_reset(&e->bo);
		} else bo_header(&e->bo, buf, len);
		break;
	}
	pthread_mutex_unlock(&lc_lock);
	if (seconds <= 0) return;
	char path[PATH_MAX];
	if (!lc_backoff_path(path, sizeof path)) return;
	long now = (long)time(NULL), until = bo_until(path, host);
	if (until < now + seconds) until = now + seconds;
	int kept = bo_set(path, host, until, now) == 0;
	shim_log("%s asks to be left alone for %ld s%s%s; %s\n", host, seconds,
		throttle[0] ? ", throttled: " : "", throttle, kept ? "nothing goes to it until then" : "couldn't keep it");
}

/* Whether a request to this handle's host must wait out a back-off; points it elsewhere if so (lock held). */
static void lc_hold(CURL *h, struct lc_handle *e)
{
	char path[PATH_MAX];
	long now = (long)time(NULL);
	long until = e->host[0] && lc_backoff_path(path, sizeof path) ? bo_until(path, e->host) : 0;
	if (e->no_token) {
		/* No token to send (the sign-in couldn't be refreshed just now): fails as a network
		   failure, which the service tries again later, rather than a login refused. */
		if (!e->held) lc_real_setopt(h, 10002, (void *)LC_HELD_URL);
		e->held = 1;
		shim_log("no token for %s just now; the request waits for a later try\n", e->host);
	} else if (until > now) {
		if (!e->held) lc_real_setopt(h, 10002, (void *)LC_HELD_URL);
		e->held = 1;
		shim_log("a request to %s waits: %ld s of its back-off left\n", e->host, until - now);
	} else if (e->held) {
		/* The same request again after the back-off: its own URL back. */
		lc_real_setopt(h, 10002, (void *)e->url);
		e->held = 0;
	}
}

#define LC_CURLOPT_POST 47
#define LC_CURLOPT_POSTFIELDS 10015
#define LC_CURLOPT_POSTFIELDSIZE 60

#if CE_MAILSHIM_EAS16
/*
 * Whether the request this handle is about to make is an attachment download to send as
 * ItemOperations (attfetch.h); sets it up (lock held). Only where the request goes out at 14.0 or
 * later, which the version adapter decides, as for sends. Done as the request starts, after every
 * option the service sets, so its method and body are the ones that go.
 */
static void lc_fetch_setup(CURL *h, struct lc_handle *e)
{
	char ref[1024], url[sizeof e->url], asked[16] = "", ver[16];
	if (e->fetching || !af_parse_url(e->url, ref, sizeof ref)) return;
	for (struct curl_slist *q = e->theirs; q; q = q->next)
		if (strncasecmp(q->data, "MS-ASProtocolVersion:", 21) == 0) snprintf(asked, sizeof asked, "%s", q->data + 21 + strspn(q->data + 21, " "));
	if (!asked[0] || !lc_version(e->host, asked, ver, sizeof ver) || atof(ver) < 14.0 - 1e-6) return;
	size_t len;
	unsigned char *b;
	if (!af_url(e->url, url, sizeof url) || !(b = af_body(ref, &len))) return;
	free(e->post); e->post = b; e->post_ptr = b; e->post_size = (long)len; e->post_fresh = 1;
	snprintf(e->url, sizeof e->url, "%s", url);
	if (!e->held) lc_real_setopt(h, 10002, (void *)e->url);
	lc_real_setopt(h, LC_CURLOPT_POST, 1L);
	lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, (long)len);
	lc_real_setopt(h, LC_CURLOPT_POSTFIELDS, (void *)b);
	e->fetching = 1; e->af_pass = 0; e->af_ended = 0; e->af_code = 0; e->af_refused = 0;
	af_free(&e->af); af_init(&e->af);
	lc_apply_headers(e);
	shim_log("an attachment download from %s sent as ItemOperations at %s\n", e->host, ver);
}
#endif

int curl_multi_add_handle(void *multi, CURL *h)
{
	static int (*real)(void *, CURL *);
	if (!real) real = ma_next("curl_multi_add_handle");
	lc_init();
	pthread_mutex_lock(&lc_lock);
	struct lc_handle *e = lc_find(h, 0);
#if CE_MAILSHIM_EAS16
	if (e) lc_fetch_setup(h, e);
#endif
	if (e) lc_hold(h, e);
#if CE_MAILSHIM_DUMP
	if (e && !e->held) {
		char head[1100];
		snprintf(head, sizeof head, "> %s", e->url);
		lc_dump(e->host, head, e->post_ptr, e->post_fresh && e->post_ptr && e->post_size > 0 ? (size_t)e->post_size : 0);
	}
#endif
	if (e) e->post_fresh = 0;   /* the next request says its own body */
	pthread_mutex_unlock(&lc_lock);
	return real(multi, h);
}

/* The caller's header callback for the request whose header data is this (lock taken here). */
static lc_header_fn lc_their_header(void *data)
{
	lc_header_fn f = NULL;
	pthread_mutex_lock(&lc_lock);
	for (int i = 0; i < LC_HANDLES && !f; i++)
		if (lc_handles[i].h && lc_handles[i].their_header && lc_handles[i].header_data == data) f = lc_handles[i].their_header;
	pthread_mutex_unlock(&lc_lock);
	return f;
}

static size_t lc_header(char *buf, size_t size, size_t n, void *data)
{
	lc_header_fn theirs = lc_their_header(data);
	if (!theirs) return size * n;   /* can't happen: set together with the callback */
	size_t len = size * n;
	lc_backoff_header(data, buf, len);
#if CE_MAILSHIM_EAS16
	/* An attachment Fetch's reply: its own size and type are told with the file (lc_write). */
	int fetch_hide = 0;
	pthread_mutex_lock(&lc_lock);
	for (int i = 0; i < LC_HANDLES; i++) {
		struct lc_handle *e = &lc_handles[i];
		if (!e->h || !e->fetching || e->header_data != data) continue;
		if (len > 9 && strncmp(buf, "HTTP/", 5) == 0) {
			const char *sp = memchr(buf, ' ', len);
			e->af_pass = !sp || atoi(sp + 1) != 200;
		} else if (!e->af_pass) {
			fetch_hide = strncasecmp(buf, "Content-Length:", 15) == 0 || strncasecmp(buf, "Content-Type:", 13) == 0
				|| len <= 2;   /* the blank line that ends them: said once the size is known */
		}
		break;
	}
	pthread_mutex_unlock(&lc_lock);
	if (fetch_hide) return len;
	static const char name[] = "MS-ASProtocolVersions:";
	if (len > sizeof name && len < 512 && strncasecmp(buf, name, sizeof name - 1) == 0) {
		/* The server's list, for the requests that follow to it (lc_version). */
		pthread_mutex_lock(&lc_lock);
		for (int i = 0; i < LC_HANDLES; i++) {
			if (!lc_handles[i].h || lc_handles[i].header_data != data || !lc_handles[i].host[0]) continue;
			char *offered = lc_offered_for(lc_handles[i].host, 1);
			size_t k = 0;
			for (const char *c = buf + sizeof name - 1; c < buf + len && k < 127; c++)
				if (*c != ' ' && *c != '\r' && *c != '\n') offered[k++] = *c;
			offered[k] = 0;
			break;
		}
		pthread_mutex_unlock(&lc_lock);
		/* Offered as the one version it should take: the highest the server has up to 14.1 (how
		   the service picks from a list isn't known, and a full list gave it 2.5). */
		char out[512], *w = out, best[16] = "";
		double bestv = 0;
		const char *p = buf + sizeof name - 1;
		while (p < buf + len) {
			while (p < buf + len && (*p == ' ' || *p == ',')) p++;
			const char *q = p;
			while (q < buf + len && *q != ',' && *q != '\r' && *q != '\n') q++;
			if (q > p && q - p < (long)sizeof best) {
				char one[16]; memcpy(one, p, (size_t)(q - p)); one[q - p] = 0;
				double v = atof(one);
				if (v <= 14.1 + 1e-6 && v > bestv) { bestv = v; strcpy(best, one); }
			}
			p = q;
			if (p < buf + len && (*p == '\r' || *p == '\n')) break;
		}
		if (!best[0]) return theirs(buf, size, n, data);   /* nothing it knows: Exchange Online since March 2026 (16.1 only) */
		w += snprintf(out, sizeof out, "%s %s\r\n", name, best);
		size_t r = theirs(out, 1, (size_t)(w - out), data);
		return r == (size_t)(w - out) ? len : 0;   /* curl wants its own length back */
	}
#endif
	return theirs(buf, size, n, data);
}

#define LC_CURLOPT_WRITEFUNCTION 20011
#define LC_CURLOPT_WRITEDATA 10001
#define LC_CURLOPT_READFUNCTION 20012
#define LC_CURLOPT_READDATA 10009
#define LC_CURLOPT_SEEKFUNCTION 20167
#define LC_CURLOPT_SEEKDATA 10168

#if CE_MAILSHIM_EAS16
/*
 * EAS 12.1, which Palm's service works at, asked a device to provision (accept the server's
 * security policy) with HTTP 449; from 14.0 the server says it in the reply's top-level Status
 * (142 not provisioned, 143 policy refresh, 144 bad policy key) with HTTP 200, which the service
 * takes for a failed command. A reply whose WBXML opens with such a status is reported to it as
 * 449, and it provisions as it always did. Only the first bytes of a body are looked at.
 */

static struct lc_handle *lc_by_write_data(void *data)
{
	for (int i = 0; i < LC_HANDLES; i++)
		if (lc_handles[i].h && lc_handles[i].their_write && lc_handles[i].write_data == data) return &lc_handles[i];
	return NULL;
}

/* An attachment Fetch's file, told to the service as GetAttachment's reply was (attfetch.h). */
#define LC_WRITEFUNC_PAUSE 0x10000001   /* libemail-common's CurlWriteCallback pauses while the service can't take bytes */
static int lc_fetch_head(void *ctx, const char *type, size_t size)
{
	struct lc_handle *e = ctx;
	char line[256];
	int n;
	if (type && type[0] && !strpbrk(type, "\r\n")) {
		n = snprintf(line, sizeof line, "Content-Type: %s\r\n", type);
		if (n > 0 && n < (int)sizeof line && e->their_header(line, 1, (size_t)n, e->header_data) != (size_t)n) { e->af_refused = 1; return 1; }
	}
	n = snprintf(line, sizeof line, "Content-Length: %lu\r\n", (unsigned long)size);
	if (e->their_header(line, 1, (size_t)n, e->header_data) != (size_t)n) { e->af_refused = 1; return 1; }
	if (e->their_header("\r\n", 1, 2, e->header_data) != 2) { e->af_refused = 1; return 1; }
	return 0;
}

static int lc_fetch_data(void *ctx, const unsigned char *b, size_t n)
{
	struct lc_handle *e = ctx;
	size_t w = e->their_write((char *)b, 1, n, e->write_data);
	if (w == LC_WRITEFUNC_PAUSE) return AF_PAUSE;   /* its file isn't open yet (the file cache answers over the bus) */
	if (w != n) { e->af_refused = 1; return 1; }
	return 0;
}

static size_t lc_write(char *buf, size_t size, size_t n, void *data)
{
	pthread_mutex_lock(&lc_lock);
	struct lc_handle *e = lc_by_write_data(data);
	lc_header_fn theirs = e ? e->their_write : NULL;
#if CE_MAILSHIM_DUMP
	if (e) lc_dump(e->host, "<", buf, size * n);
#endif
	if (e && e->fetching && !e->af_pass && e->their_header) {
		/* The handle's slot stays this request's until it ends: the service's callbacks run
		   on this thread, unlocked, as for every other reply. */
		pthread_mutex_unlock(&lc_lock);
		int r = af_feed(&e->af, (unsigned char *)buf, size * n, e, lc_fetch_head, lc_fetch_data);
		if (r == -2) return LC_WRITEFUNC_PAUSE;   /* curl gives the piece again once the service unpauses */
		if (r && e->af_refused) return 0;   /* the service's own failure: curl stops */
		if (r && !e->af_code) {
			/* A failed Fetch: the rest is dropped, its code told (getinfo). */
			e->af_code = e->af.code ? e->af.code : 500;
			shim_log("%s refused an attachment Fetch: status %d/%d, told as HTTP %d\n",
				e->host, e->af.info.status, e->af.info.fetch_status, e->af_code);
		}
		return size * n;
	}
	if (e && e->body_seen == 0) {
		/* A WBXML reply from a server the version adapter speaks 16.1 to: newer code pages out. */
		char ver[16];
		e->filtering = !e->sending && size * n >= 4 && (unsigned char)buf[0] == 0x03 && (unsigned char)buf[2] == 0x6a && lc_version(e->host, "12.1", ver, sizeof ver);
		if (e->filtering) wbxf_init(&e->wbxf);
		if (e->sending) {
			e->send_status = cm_status((unsigned char *)buf, size * n);
			if (e->send_status && e->send_status != 1) shim_log("%s refused a send: ComposeMail status %d\n", e->host, e->send_status);
		}
	}
	if (e && e->body_seen < 48) {
		/* WBXML: 03 01 6a 00, then a page switch and the command's tags; the status is an
		   inline string (03 "142" 00) a few bytes in. */
		size_t len = size * n, look = len < (size_t)(48 - e->body_seen) ? len : (size_t)(48 - e->body_seen);
		if (e->body_seen == 0 && len >= 4 && (unsigned char)buf[0] == 0x03 && (unsigned char)buf[2] == 0x6a) {
			for (size_t i = 4; i + 4 < look; i++)
				if (buf[i] == 0x03 && buf[i + 1] == '1' && buf[i + 2] == '4' && buf[i + 3] >= '2' && buf[i + 3] <= '4' && buf[i + 4] == 0) e->provision = 1;
		}
		e->body_seen += (int)look;
	}
	if (e && e->filtering && theirs) {
		size_t len = size * n;
		unsigned char *out = malloc(len + 16 + WBXF_HOLD);
		size_t o = out ? wbxf_feed(&e->wbxf, (unsigned char *)buf, len, out) : 0;
		pthread_mutex_unlock(&lc_lock);
		if (!out) return 0;
		size_t r = o ? theirs((char *)out, 1, o, data) : 0;
		free(out);
		return r == o ? len : 0;   /* curl wants its own length back */
	}
	pthread_mutex_unlock(&lc_lock);
	return theirs ? theirs(buf, size, n, data) : size * n;
}

/*
 * EAS 14.1 and later want a device to describe itself in its first Provision request
 * (settings:DeviceInformation); without it Exchange Online answers status 165 and never gives a
 * policy key. Palm's service, written for 12.1, sends only the policy type. Where the version
 * adapter is at work (the server no longer offers the version the service asks for), that one
 * request - Palm's exact initial Provision - gets the block, saying what this is: a TouchPad on
 * webOS CE. Every other body is left as it was.
 */

static const unsigned char lc_provision_head[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x0e, 0x45 };
static const unsigned char lc_provision_rest[] = { 0x46, 0x47, 0x48, 0x03,
	'M','S','-','E','A','S','-','P','r','o','v','i','s','i','o','n','i','n','g','-','W','B','X','M','L', 0x00,
	0x01, 0x01, 0x01, 0x01 };

/* The initial Provision with DeviceInformation, into a new buffer; its length in *len. */
static unsigned char *lc_with_device_info(size_t *len)
{
	static const char *const fields[][2] = {
		{ "\x57", "TouchPad" },          /* Model */
		{ "\x59", "TouchPad" },          /* FriendlyName */
		{ "\x5a", "webOS CE" },          /* OS */
		{ "\x5b", "English" },           /* OSLanguage */
		{ "\x60", "Palm/1.0.1" },        /* UserAgent: what the service sends as User-Agent */
	};
	unsigned char *b = malloc(256), *w = b;
	if (!b) return NULL;
	memcpy(w, lc_provision_head, sizeof lc_provision_head); w += sizeof lc_provision_head;
	*w++ = 0x00; *w++ = 0x12;         /* the Settings page */
	*w++ = 0x56; *w++ = 0x48;         /* DeviceInformation, Set */
	for (size_t i = 0; i < sizeof fields / sizeof fields[0]; i++) {
		*w++ = (unsigned char)fields[i][0][0]; *w++ = 0x03;
		size_t n = strlen(fields[i][1]); memcpy(w, fields[i][1], n); w += n; *w++ = 0x00;
		*w++ = 0x01;
	}
	*w++ = 0x01; *w++ = 0x01;         /* /Set, /DeviceInformation */
	*w++ = 0x00; *w++ = 0x0e;         /* back to the Provision page */
	memcpy(w, lc_provision_rest, sizeof lc_provision_rest); w += sizeof lc_provision_rest;
	*len = (size_t)(w - b);
	return b;
}

/* The request body of a send, in ComposeMail form: prefix, the caller's message unread, suffix. */
#define LC_READFUNC_ABORT 0x10000000
#define LC_READFUNC_PAUSE 0x10000001

static struct lc_handle *lc_by_read_data(void *data)
{
	for (int i = 0; i < LC_HANDLES; i++)
		if (lc_handles[i].h && lc_handles[i].sending && lc_handles[i].read_data == data) return &lc_handles[i];
	return NULL;
}

static size_t lc_read(char *buf, size_t size, size_t n, void *data)
{
	size_t cap = size * n, o = 0;
	pthread_mutex_lock(&lc_lock);
	struct lc_handle *e = lc_by_read_data(data);
	if (!e) { pthread_mutex_unlock(&lc_lock); return LC_READFUNC_ABORT; }   /* can't happen: set with the handle */
	if (e->cm_phase == 0) {
		size_t k = e->cm_pre_len - e->cm_pos < cap ? e->cm_pre_len - e->cm_pos : cap;
		memcpy(buf, e->cm_pre + e->cm_pos, k); e->cm_pos += k; o += k;
		if (e->cm_pos == e->cm_pre_len) { e->cm_phase = 1; e->cm_pos = 0; }
		if (o == cap) { pthread_mutex_unlock(&lc_lock); return o; }
	}
	if (e->cm_phase == 1) {
		lc_read_fn theirs = e->their_read;
		pthread_mutex_unlock(&lc_lock);
		size_t r = theirs(buf + o, 1, cap - o, data);
		if (r == LC_READFUNC_ABORT) return r;
		if (r == LC_READFUNC_PAUSE) return o ? o : r;   /* asked again once it's unpaused */
		if (r && cm_fix_reply(buf + o, r)) shim_log("a meeting reply's calendar part said as one (method=REPLY)\n");
		if (r) return o + r;
		pthread_mutex_lock(&lc_lock);
		e = lc_by_read_data(data);
		if (!e) { pthread_mutex_unlock(&lc_lock); return o; }
		e->cm_phase = 2; e->cm_pos = 0;
	}
	if (e->cm_phase == 2) {
		size_t k = sizeof cm_suffix - e->cm_pos < cap - o ? sizeof cm_suffix - e->cm_pos : cap - o;
		memcpy(buf + o, cm_suffix + e->cm_pos, k); e->cm_pos += k; o += k;
		if (e->cm_pos == sizeof cm_suffix) e->cm_phase = 3;
	}
	pthread_mutex_unlock(&lc_lock);
	return o;
}

static int lc_seek(void *data, long long offset, int origin)
{
	pthread_mutex_lock(&lc_lock);
	struct lc_handle *e = lc_by_read_data(data);
	lc_seek_fn theirs = e ? e->their_seek : NULL;
	void *their_data = e ? e->seek_data : NULL;
	if (e && offset == 0 && origin == 0) { e->cm_phase = 0; e->cm_pos = 0; }
	pthread_mutex_unlock(&lc_lock);
	if (!e || offset != 0 || origin != 0) return 2;   /* CURL_SEEKFUNC_CANTSEEK: only a rewind to the start */
	return theirs ? theirs(their_data, 0, 0) : 0;
}

/* Whether the request this handle is about to make is a send to wrap; sets it up (lock held). */
static void lc_send_setup(CURL *h, struct lc_handle *e, const char *url)
{
	struct cm_send cs;
	e->sending = 0; e->send_status = 0;
	if (!e->their_read || e->post_size <= 0 || !cm_parse_url(url, &cs)) return;
	int rfc822 = 0;
	char asked[16] = "", ver[16];
	for (struct curl_slist *q = e->theirs; q; q = q->next) {
		if (strncasecmp(q->data, "Content-Type:", 13) == 0 && strcasecmp(q->data + 13 + strspn(q->data + 13, " "), "message/rfc822") == 0) rfc822 = 1;
		if (strncasecmp(q->data, "MS-ASProtocolVersion:", 21) == 0) snprintf(asked, sizeof asked, "%s", q->data + 21 + strspn(q->data + 21, " "));
	}
	/* Only where the request goes out at 14.0 or later, which the version adapter decides. */
	if (!rfc822 || !asked[0] || !lc_version(e->host, asked, ver, sizeof ver) || atof(ver) < 14.0 - 1e-6) return;
	static unsigned counter;
	char client_id[40];
	snprintf(client_id, sizeof client_id, "ce%lx%x%x", (unsigned long)time(NULL), (unsigned)getpid(), ++counter);
	if (strlen(cs.item) + strlen(cs.folder) > sizeof e->cm_pre - 128) return;
	e->cm_pre_len = cm_prefix(&cs, client_id, (unsigned long)e->post_size, e->cm_pre);
	e->cm_pos = 0; e->cm_phase = 0;
	e->sending = 1;
	lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, (long)(e->cm_pre_len + (size_t)e->post_size + sizeof cm_suffix));
	lc_real_setopt(h, LC_CURLOPT_READFUNCTION, (void *)lc_read);
	if (e->their_seek) lc_real_setopt(h, LC_CURLOPT_SEEKFUNCTION, (void *)lc_seek);
	lc_apply_headers(e);
}
#endif /* CE_MAILSHIM_EAS16 */

int curl_easy_setopt(CURL *h, int option, ...)
{
	lc_init();
	va_list ap;
	va_start(ap, option);
	if (option >= LC_OFF_T_BASE && option < LC_OFF_T_BASE + 10000) {
		long long v = va_arg(ap, long long);
		va_end(ap);
		return lc_real_setopt(h, option, v);
	}
	void *v = va_arg(ap, void *);
	va_end(ap);
#if CE_MAILSHIM_EAS16
	if (option == LC_CURLOPT_READFUNCTION || option == LC_CURLOPT_READDATA || option == LC_CURLOPT_SEEKFUNCTION || option == LC_CURLOPT_SEEKDATA) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 1);
		int ours = 0;
		if (e) {
			if (option == LC_CURLOPT_READFUNCTION) e->their_read = (lc_read_fn)v;
			else if (option == LC_CURLOPT_READDATA) e->read_data = v;
			else if (option == LC_CURLOPT_SEEKFUNCTION) { e->their_seek = (lc_seek_fn)v; ours = e->sending && v; }
			else e->seek_data = v;
		}
		pthread_mutex_unlock(&lc_lock);
		if (ours) return lc_real_setopt(h, option, (void *)lc_seek);
	}
#endif
	if (option == LC_CURLOPT_POSTFIELDSIZE || option == LC_CURLOPT_POSTFIELDS) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 1);
		if (e && option == LC_CURLOPT_POSTFIELDSIZE) e->post_size = (long)v;
		if (e && option == LC_CURLOPT_POSTFIELDS) { e->post_ptr = v; e->post_fresh = v != NULL; }
#if CE_MAILSHIM_EAS16
		/* Palm sets the body before the URL: it is marked here and swapped once the server is known. */
		if (e && option == LC_CURLOPT_POSTFIELDS)
			e->initial_provision = v && e->post_size == (long)(sizeof lc_provision_head + sizeof lc_provision_rest)
				&& memcmp(v, lc_provision_head, sizeof lc_provision_head) == 0
				&& memcmp((char *)v + sizeof lc_provision_head, lc_provision_rest, sizeof lc_provision_rest) == 0;
#endif
		pthread_mutex_unlock(&lc_lock);
	}
	if (option == LC_CURLOPT_WRITEFUNCTION || option == LC_CURLOPT_WRITEDATA || option == 10002 /* URL: a new request */) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 1);
		if (e) {
			if (option == LC_CURLOPT_WRITEDATA) e->write_data = v;
			else if (option == LC_CURLOPT_WRITEFUNCTION) e->their_write = (lc_header_fn)v;
			else {
				e->body_seen = 0; e->provision = 0; e->filtering = 0; e->host[0] = 0;
				e->fetching = 0; af_free(&e->af);
				e->held = 0; bo_reset(&e->bo);
				const char *u = v, *hs = u ? strstr(u, "://") : NULL;
				snprintf(e->url, sizeof e->url, "%s", u ? u : "");
				if (hs) { hs += 3; size_t n = strcspn(hs, "/:?"); if (n < sizeof e->host) { memcpy(e->host, hs, n); e->host[n] = 0; } }
#if CE_MAILSHIM_EAS16
				char ver[16];
				if (e->initial_provision && lc_version(e->host, "12.1", ver, sizeof ver)) {
					size_t len;
					unsigned char *b = lc_with_device_info(&len);
					if (b) {
						free(e->post); e->post = b; e->post_ptr = b; e->post_size = (long)len;
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, (long)len);
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDS, (void *)b);
					}
				}
				e->initial_provision = 0;
				/* A Sync going out at 16.x: its calendar items as such a server takes them (calfilter.h). */
				if (u && strstr(u, "Cmd=Sync") && e->post_fresh && e->post_ptr && e->post_size > 0 && lc_version(e->host, "12.1", ver, sizeof ver) && atof(ver) >= 16.0 - 1e-6) {
					unsigned char *b = malloc(CALF_OUT_CAP((size_t)e->post_size));
					size_t len = b ? calf_rewrite(e->post_ptr, (size_t)e->post_size, b) : 0;
					if (len && len != (size_t)-1) {
						free(e->post); e->post = b; e->post_ptr = b; e->post_size = (long)len;
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, (long)len);
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDS, (void *)b);
						shim_log("calendar items in a Sync to %s rewritten for %s\n", e->host, ver);
					} else free(b);
					/* A series' Exceptions as Changes and Deletes of their own occurrences. */
					size_t slen = 0;
					unsigned char *sb = calf_split(e->post_ptr, (size_t)e->post_size, &slen);
					if (sb) {
						free(e->post); e->post = sb; e->post_ptr = sb; e->post_size = (long)slen;
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, (long)slen);
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDS, (void *)sb);
						shim_log("a series' exceptions in a Sync to %s sent as their own occurrences\n", e->host);
					}
				}
				/* A Sync to any other EAS server (the legacy Exchange account type): only the zones
				   Palm builds, in Windows' form (calfilter.h, calf_fix_zones); nothing else changes. */
				else
#endif
				if (u && strstr(u, "Cmd=Sync") && e->post_fresh && e->post_ptr && e->post_size > 0) {
					unsigned char *b = malloc((size_t)e->post_size);
					if (b && calf_fix_zones(e->post_ptr, (size_t)e->post_size, b)) {
						free(e->post); e->post = b; e->post_ptr = b;
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDSIZE, e->post_size);
						lc_real_setopt(h, LC_CURLOPT_POSTFIELDS, (void *)b);
						shim_log("an event's time zone in a Sync to %s written in Windows' form\n", e->host);
					} else free(b);
				}
#if CE_MAILSHIM_EAS16
				if (e->sending && e->their_read) lc_real_setopt(h, LC_CURLOPT_READFUNCTION, (void *)e->their_read);   /* the last request's */
				lc_send_setup(h, e, u);
#endif
			}
		}
		pthread_mutex_unlock(&lc_lock);
#if CE_MAILSHIM_EAS16
		if (e && option == LC_CURLOPT_WRITEFUNCTION && v) return lc_real_setopt(h, option, (void *)lc_write);
#endif
	}
	if (option == LC_CURLOPT_HEADERFUNCTION || option == LC_CURLOPT_HEADERDATA) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 1);
		if (e) {
			if (option == LC_CURLOPT_HEADERDATA) e->header_data = v;
			else e->their_header = (lc_header_fn)v;
		}
		pthread_mutex_unlock(&lc_lock);
		if (e && option == LC_CURLOPT_HEADERFUNCTION && v) return lc_real_setopt(h, option, (void *)lc_header);
	}
#if CE_MAILSHIM_OAUTH
	if (option == LC_CURLOPT_USERPWD) {
		/* Whatever this handle carried for an earlier request, this one says afresh. */
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *was = lc_find(h, 0);
		if (was && was->handle[0]) { was->handle[0] = 0; memset(was->bearer, 0, sizeof was->bearer); lc_real_setopt(h, LC_CURLOPT_HTTPHEADER, was->theirs); }
		if (was) { was->no_token = 0; was->token_final = 0; }
		pthread_mutex_unlock(&lc_lock);
	}
	if (option == LC_CURLOPT_USERPWD && v) {
		const char *up = v, *colon = strchr(up, ':');
		if (colon && ma_is_handle(colon + 1)) {
			char user[512];
			size_t ul = (size_t)(colon - up) < sizeof user - 1 ? (size_t)(colon - up) : sizeof user - 1;
			memcpy(user, up, ul); user[ul] = 0;
			pthread_mutex_lock(&lc_lock);
			struct lc_handle *e = lc_find(h, 1);
			if (e) {
				int stale = strcmp(ma_refused, colon + 1) == 0;
				int t = ma_token(NULL, user, colon + 1, stale, e->bearer, sizeof e->bearer);
				if (t < 0) {
					/* No token just now: no Basic password with the handle either. The request goes
					   nowhere when it starts (lc_hold) and the service tries again later, as IMAP's
					   connection is dropped (mailauth.h). */
					snprintf(e->handle, sizeof e->handle, "%s", colon + 1);
					memset(e->bearer, 0, sizeof e->bearer);
					e->no_token = 1;
					lc_real_setopt(h, LC_CURLOPT_USERPWD, (void *)NULL);
					lc_real_setopt(h, LC_CURLOPT_HTTPAUTH, 0L);
					int r = lc_apply_headers(e);
					pthread_mutex_unlock(&lc_lock);
					return r;
				}
				if (t > 0) {
					/* A refusal of this one is final: it is fresh (2), a retry's, or empty (the sign-in
					   is over, and Email is to ask for it again). */
					e->token_final = t == 2 || stale || !e->bearer[0];
					if (stale) ma_refused[0] = 0;
					snprintf(e->handle, sizeof e->handle, "%s", colon + 1);
					lc_real_setopt(h, LC_CURLOPT_USERPWD, (void *)NULL);
					lc_real_setopt(h, LC_CURLOPT_HTTPAUTH, 0L);
					int r = lc_apply_headers(e);
					pthread_mutex_unlock(&lc_lock);
					return r;
				}
				e->handle[0] = 0;   /* unknown handle: an ordinary password after all */
			}
			pthread_mutex_unlock(&lc_lock);
		}
	}
#endif
#if CE_MAILSHIM_EAS16 || CE_MAILSHIM_OAUTH
	if (option == LC_CURLOPT_HTTPHEADER) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 1);   /* kept even before any credentials: they may come later */
		if (e) {
			e->theirs = v;
			int change = e->handle[0] != 0;
#if CE_MAILSHIM_EAS16
			char ver[16];
			for (struct curl_slist *q = v; q && !change; q = q->next)
				if (strncasecmp(q->data, "MS-ASProtocolVersion:", 21) == 0 && lc_version(e->host, q->data + 21 + strspn(q->data + 21, " "), ver, sizeof ver)) change = 1;
#endif
			if (change) { int r = lc_apply_headers(e); pthread_mutex_unlock(&lc_lock); return r; }
		}
		pthread_mutex_unlock(&lc_lock);
	}
#endif
	return lc_real_setopt(h, option, v);
}

#if CE_MAILSHIM_EAS16 || CE_MAILSHIM_OAUTH
/* What the service is told a reply's status was: a Fetch's verdict, a provisioning status as 449,
   a refused send; and a server's 401 to a bearer request (mailauth.h's ma_refused). */
int curl_easy_getinfo(CURL *h, int info, ...)
{
	static int (*real)(CURL *, int, ...);
	if (!real) real = ma_next("curl_easy_getinfo");
	va_list ap;
	va_start(ap, info);
	void *out = va_arg(ap, void *);
	va_end(ap);
	int r = real(h, info, out);
#if CE_MAILSHIM_EAS16
	if (r == 0 && info == LC_CURLINFO_RESPONSE_CODE && out && *(long *)out == 200) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 0);
		if (e && e->fetching && !e->af_pass) {
			/* The Fetch's verdict, once there is one. The service asks for the code mid-reply too
			   (its header callback, as the file's size is told), so a reply still arriving is
			   left alone: only a plain WBXML reply, told nothing until it is judged, is judged
			   here, and a reply already refused says why. */
			if (!e->af_ended && e->af.state == 5) {
				e->af_ended = 1;
				pthread_mutex_unlock(&lc_lock);
				int bad = af_done(&e->af, e, lc_fetch_head, lc_fetch_data);
				pthread_mutex_lock(&lc_lock);
				if (bad && !e->af_refused) e->af_code = e->af.code ? e->af.code : 500;
				if (e->af_code) shim_log("%s refused an attachment Fetch: status %d/%d, told as HTTP %d\n",
					e->host, e->af.info.status, e->af.info.fetch_status, e->af_code);
				af_free(&e->af);
			}
			if (e->af_code) *(long *)out = e->af_code;
		}
		else if (e && e->provision) *(long *)out = 449;
		else if (e && e->sending && e->send_status && e->send_status != 1) *(long *)out = 500;   /* the send failed: the service retries */
		pthread_mutex_unlock(&lc_lock);
	}
#endif
#if CE_MAILSHIM_OAUTH
	if (r == 0 && info == LC_CURLINFO_RESPONSE_CODE && out && *(long *)out == 401) {
		pthread_mutex_lock(&lc_lock);
		struct lc_handle *e = lc_find(h, 0);
		if (e && e->handle[0]) {
			snprintf(ma_refused, sizeof ma_refused, "%s", e->handle);
			/* The first refusal of a token that should have worked (the provider ended it early):
			   a server error to the service, which tries again, and that try asks for a fresh
			   one. Mojomail-eas takes a 401 as a wrong password and asks for a new sign-in. */
			if (!e->token_final) *(long *)out = 500;
		}
		pthread_mutex_unlock(&lc_lock);
	}
#endif
	return r;
}
#endif

void curl_easy_cleanup(CURL *h)
{
	static void (*real)(CURL *);
	if (!real) real = ma_next("curl_easy_cleanup");
	lc_init();
	real(h);
	pthread_mutex_lock(&lc_lock);
	struct lc_handle *e = lc_find(h, 0);
	if (e) {
		if (e->ours) lc_slist_free(e->ours);
		free(e->post);
		af_free(&e->af);
		memset(e, 0, sizeof *e);
	}
	pthread_mutex_unlock(&lc_lock);
}
