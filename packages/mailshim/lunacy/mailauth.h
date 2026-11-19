/*
 * OAuth for Palm's mail services, under them (Docs/oauth.md).
 *
 * Palm's mojomail-imap logs in with `LOGIN user password` and mojomail-smtp with `AUTH LOGIN`
 * or `AUTH PLAIN`; neither knows XOAUTH2, which Google and Microsoft now require. An account
 * signed in with OAuth keeps, as its password, a handle (`oauth2:` and 32 hex digits) that
 * names its tokens in Lunacy's OAuth service. This code sits between the service and its
 * connection and turns a login that carries a handle into the XOAUTH2 one, with the current
 * access token, so the binaries stay exactly as Palm built them:
 *
 *   IMAP  `t LOGIN "user" "oauth2:…"`  ->  `t AUTHENTICATE XOAUTH2 <payload>` (SASL-IR). A
 *         refused token draws a `+ <error>` challenge first; it is answered here with an empty
 *         line and not shown, so the service sees only the tagged NO it expects of a LOGIN.
 *   SMTP  the server's EHLO is shown without LOGIN when it offers XOAUTH2 (and with PLAIN,
 *         added when missing), so the service uses `AUTH PLAIN`, the one with the password in
 *         a single line; `AUTH PLAIN <\0user\0oauth2:…>` -> `AUTH XOAUTH2 <payload>`, and a
 *         `334 <error>` challenge is answered and hidden as for IMAP. A real password on a
 *         server that offered LOGIN but not PLAIN is sent as the AUTH LOGIN exchange the
 *         service would have made itself.
 *
 * A handle the OAuth service doesn't know leaves the line as it was: it is only a password
 * that happens to look like one. Nothing else in the stream is changed or held longer than
 * it takes to see that a line isn't one of these.
 *
 * A refusal is final for the service only when the sign-in is really over. The services take
 * a refused login as a wrong password and stop trying until the credentials change, which
 * left Gmail asking to be signed in again after one bad moment. So when no token can be had
 * just now (the provider couldn't be reached to refresh it), and the first time a token that
 * should have worked is refused (a provider can end one early), the connection is dropped
 * instead: the service tries again later, as after a network failure, and that login asks for
 * a fresh token. A token that was fresh or empty (the sign-in ended), or that a retry asked
 * for, is refused to the service as it is.
 *
 * Pure logic: the caller supplies how bytes reach the server and how a handle becomes a
 * token (mailauth_io), so the host test (tests/mailauth_test.c) drives it without sockets.
 */
#ifndef LUNACY_MAILAUTH_H
#define LUNACY_MAILAUTH_H

#include <ctype.h>
#include <stdio.h>
#include <strings.h>
#include <stdlib.h>
#include <string.h>

#define MAILAUTH_HANDLE "oauth2:"
#define MAILAUTH_LINE_MAX 8192
#define MAILAUTH_TOKEN_MAX 8192

struct mailauth_io {
	/* Every byte to the server, sent in full; 0, or -1 when the connection failed. */
	int (*send)(void *ctx, const char *p, size_t n);
	/* The access token for user's handle into buf: 1 with the token (empty when the
	   account's sign-in no longer works), 2 with one the provider has only just issued, 0
	   when the handle is unknown, -1 when no token can be had just now. stale: the server
	   refused the last token given for this handle, so a fresh one is wanted. */
	int (*token)(void *ctx, const char *user, const char *handle, int stale, char *buf, size_t cap);
	void *ctx;
};

enum { MA_LINESTART, MA_HOLD, MA_PASS };

struct mailauth {
	/* client -> server */
	int out_mode;
	char line[MAILAUTH_LINE_MAX];
	size_t line_len;
	/* server -> client */
	char carry[MAILAUTH_LINE_MAX];   /* an incomplete line, while watching */
	size_t carry_len;
	char *inq;                       /* what the service is still to read */
	size_t inq_len, inq_cap;
	/* the exchange in progress */
	char imap_tag[64];
	int imap_await;                  /* AUTHENTICATE XOAUTH2 sent: hide a + challenge */
	int smtp_ehlo;                   /* EHLO sent: its reply is being read */
	int smtp_plain, smtp_login, smtp_xoauth2;   /* what the last EHLO offered */
	int smtp_await;                  /* AUTH XOAUTH2 sent: hide a 334 challenge */
	int smtp_replay;                 /* AUTH LOGIN in place of PLAIN: 1 user next, 2 password next */
	char replay_user[512], replay_pass[512];
	char sent_handle[64];            /* the handle whose token went in the XOAUTH2 just sent */
	int sent_final;                  /* a refusal of that token is the service's to see */
	int off;                         /* COMPRESS sent: the rest of the connection is deflate's, not lines */
};

/* The handle whose token a server last refused, in this process: its next login asks for a
   fresh one (the provider can end a token before its time, after a password change). */
static char ma_refused[64];

/* 1 with a token in buf, 0 for a handle the service doesn't know, -1 when none can be had now. */
static int ma_get_token(struct mailauth *m, const struct mailauth_io *io, const char *user, const char *handle, char *buf, size_t cap)
{
	int stale = strcmp(ma_refused, handle) == 0;
	int r = io->token(io->ctx, user, handle, stale, buf, cap);
	if (r <= 0) return r;
	if (stale) ma_refused[0] = 0;
	snprintf(m->sent_handle, sizeof m->sent_handle, "%s", handle);
	m->sent_final = stale || r == 2 || !buf[0];
	return 1;
}

/* The server refused the token just sent: the next login for its handle asks for a fresh one
   (the provider can end a token before its time, after a password change). 1 when the
   refusal is hidden from the service as a dropped connection, so it tries again. */
static int ma_was_refused(struct mailauth *m)
{
	if (!m->sent_handle[0]) return 0;
	snprintf(ma_refused, sizeof ma_refused, "%s", m->sent_handle);
	return !m->sent_final;
}

static void mailauth_init(struct mailauth *m) { memset(m, 0, sizeof *m); }

/* Whether the server's bytes need looking at (otherwise they pass untouched). */
static int mailauth_watching(const struct mailauth *m)
{
	if (m->off) return 0;
	return m->imap_await || m->smtp_ehlo || m->smtp_await || m->smtp_replay || m->carry_len;
}

/* ---- base64 ---- */

static const char MA_B64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static size_t ma_b64_encode(const unsigned char *in, size_t n, char *out)
{
	size_t o = 0;
	for (size_t i = 0; i < n; i += 3) {
		unsigned v = in[i] << 16 | (i + 1 < n ? in[i + 1] << 8 : 0) | (i + 2 < n ? in[i + 2] : 0);
		out[o++] = MA_B64[v >> 18 & 63]; out[o++] = MA_B64[v >> 12 & 63];
		out[o++] = i + 1 < n ? MA_B64[v >> 6 & 63] : '=';
		out[o++] = i + 2 < n ? MA_B64[v & 63] : '=';
	}
	out[o] = 0;
	return o;
}

/* -1 on anything that isn't base64. */
static long ma_b64_decode(const char *in, size_t n, unsigned char *out, size_t cap)
{
	unsigned v = 0; int bits = 0; size_t o = 0;
	for (size_t i = 0; i < n; i++) {
		char c = in[i];
		if (c == '=') break;
		const char *at = strchr(MA_B64, c);
		if (!c || !at) return -1;
		v = v << 6 | (unsigned)(at - MA_B64); bits += 6;
		if (bits >= 8) { bits -= 8; if (o >= cap) return -1; out[o++] = (unsigned char)(v >> bits & 0xff); }
	}
	return (long)o;
}

static int ma_is_handle(const char *s)
{
	size_t n = strlen(MAILAUTH_HANDLE);
	if (strncmp(s, MAILAUTH_HANDLE, n) != 0 || strlen(s + n) != 32) return 0;
	for (const char *c = s + n; *c; c++) if (!isxdigit((unsigned char)*c)) return 0;
	return 1;
}

/* The XOAUTH2 initial response, base64: user=U^Aauth=Bearer T^A^A. Malloc'd. */
static char *ma_xoauth2(const char *user, const char *token)
{
	size_t n = strlen(user) + strlen(token) + 32;
	char *raw = malloc(n), *b64 = malloc(n * 4 / 3 + 8);
	if (!raw || !b64) { free(raw); free(b64); return NULL; }
	int len = snprintf(raw, n, "user=%s\001auth=Bearer %s\001\001", user, token);
	ma_b64_encode((unsigned char *)raw, (size_t)len, b64);
	free(raw);
	return b64;
}

/* ---- client -> server ---- */

static int ma_starts_ci(const char *s, size_t n, const char *word)
{
	size_t w = strlen(word);
	return n >= w && strncasecmp(s, word, w) == 0;
}

/* Could the line so far still become one this code changes or watches? */
static int ma_viable(const char *s, size_t n)
{
	/* Commands are text: a byte that isn't (compressed or binary data) is never held. */
	for (size_t i = 0; i < n; i++) {
		unsigned char c = (unsigned char)s[i];
		if ((c < 0x20 && c != '\r' && c != '\n') || c > 0x7e) return 0;
	}
	static const char *const smtp[] = { "AUTH PLAIN ", "EHLO " };
	for (int i = 0; i < 2; i++) {
		size_t w = strlen(smtp[i]);
		if (strncasecmp(s, smtp[i], n < w ? n : w) == 0) return 1;
	}
	/* IMAP: a tag, then LOGIN */
	size_t t = 0;
	while (t < n && t < 63 && s[t] != ' ' && s[t] != '\r' && s[t] != '\n') t++;
	if (t == n) return t < 63;
	if (t == 0 || s[t] != ' ') return 0;
	const char *rest = s + t + 1; size_t r = n - t - 1;
	return strncasecmp(rest, "LOGIN ", r < 6 ? r : 6) == 0 || strncasecmp(rest, "COMPRESS ", r < 9 ? r : 9) == 0;
}

/* An IMAP quoted string at *p (as mojomail writes them: always quoted, \ before " and \). */
static int ma_quoted(const char **p, const char *end, char *out, size_t cap)
{
	const char *s = *p; size_t o = 0;
	if (s >= end || *s != '"') return 0;
	for (s++; s < end && *s != '"'; s++) {
		if (*s == '\\' && s + 1 < end) s++;
		if (o + 1 >= cap) return 0;
		out[o++] = *s;
	}
	if (s >= end) return 0;
	out[o] = 0; *p = s + 1;
	return 1;
}

static int ma_send_str(const struct mailauth_io *io, const char *s) { return io->send(io->ctx, s, strlen(s)); }

/* A whole line the service wrote: sent as it is, or as its XOAUTH2 form. */
static int ma_line(struct mailauth *m, const struct mailauth_io *io, const char *s, size_t n)
{
	char user[512], pass[512];
	static char token[MAILAUTH_TOKEN_MAX];
	if (ma_starts_ci(s, n, "EHLO ")) {
		m->smtp_ehlo = 1; m->smtp_plain = m->smtp_login = m->smtp_xoauth2 = 0;
		return io->send(io->ctx, s, n);
	}
	if (ma_starts_ci(s, n, "AUTH PLAIN ")) {
		unsigned char raw[1100];
		const char *b = s + 11; size_t bn = n - 11;
		while (bn && (b[bn - 1] == '\n' || b[bn - 1] == '\r')) bn--;
		long rn = ma_b64_decode(b, bn, raw, sizeof raw - 1);
		const unsigned char *z1 = rn > 0 ? memchr(raw, 0, (size_t)rn) : NULL;
		const unsigned char *z2 = z1 ? memchr(z1 + 1, 0, (size_t)(raw + rn - z1 - 1)) : NULL;
		if (!z2 || z2 - z1 - 1 >= (long)sizeof user || raw + rn - z2 - 1 >= (long)sizeof pass)
			return io->send(io->ctx, s, n);
		memcpy(user, z1 + 1, (size_t)(z2 - z1 - 1)); user[z2 - z1 - 1] = 0;
		memcpy(pass, z2 + 1, (size_t)(raw + rn - z2 - 1)); pass[raw + rn - z2 - 1] = 0;
		int t = ma_is_handle(pass) ? ma_get_token(m, io, user, pass, token, sizeof token) : 0;
		if (t < 0) return -1;   /* no token just now: the connection fails, and is tried again */
		if (t) {
			char *x = ma_xoauth2(user, token);
			memset(token, 0, sizeof token);
			if (!x) return -1;
			int r = ma_send_str(io, "AUTH XOAUTH2 ");
			if (!r) r = ma_send_str(io, x);
			if (!r) r = ma_send_str(io, "\r\n");
			free(x);
			m->smtp_await = 1;
			return r;
		}
		if (m->smtp_xoauth2 && m->smtp_login && !m->smtp_plain) {
			/* PLAIN was only shown because of the EHLO change: log in as the service would have. */
			strcpy(m->replay_user, user); strcpy(m->replay_pass, pass);
			m->smtp_replay = 1;
			return ma_send_str(io, "AUTH LOGIN\r\n");
		}
		return io->send(io->ctx, s, n);
	}
	/* IMAP: tag LOGIN "user" "password" */
	const char *sp = memchr(s, ' ', n), *end = s + n;
	if (sp && sp - s < 63 && ma_starts_ci(sp + 1, (size_t)(end - sp - 1), "COMPRESS ")) {
		/* RFC 4978: after its OK both directions are deflate streams. Logins are over by then. */
		m->off = 1;
		return io->send(io->ctx, s, n);
	}
	if (sp && sp - s < 63 && ma_starts_ci(sp + 1, (size_t)(end - sp - 1), "LOGIN ")) {
		const char *p = sp + 7;
		int t = ma_quoted(&p, end, user, sizeof user) && p < end && *p == ' ' && (p++, ma_quoted(&p, end, pass, sizeof pass))
			&& ma_is_handle(pass) ? ma_get_token(m, io, user, pass, token, sizeof token) : 0;
		if (t < 0) return -1;
		if (t) {
			char *x = ma_xoauth2(user, token);
			memset(token, 0, sizeof token);
			if (!x) return -1;
			memcpy(m->imap_tag, s, (size_t)(sp - s)); m->imap_tag[sp - s] = 0;
			int r = io->send(io->ctx, s, (size_t)(sp - s + 1));
			if (!r) r = ma_send_str(io, "AUTHENTICATE XOAUTH2 ");
			if (!r) r = ma_send_str(io, x);
			if (!r) r = ma_send_str(io, "\r\n");
			free(x);
			m->imap_await = 1;
			return r;
		}
	}
	return io->send(io->ctx, s, n);
}

/*
 * The service writes n bytes. Returns how many were taken (at least 1 when n > 0), or -1
 * when sending failed. *direct set means: none were taken here, the caller writes those
 * bytes itself, straight to the server (the middle of a line nothing needs, where a short
 * write must stay the service's to retry).
 */
static long mailauth_out(struct mailauth *m, const struct mailauth_io *io, const char *p, size_t n, int *direct)
{
	*direct = 0;
	if (!n) return 0;
	if (m->off) { *direct = 1; return (long)n; }
	if (m->out_mode == MA_PASS) {
		const char *nl = memchr(p, '\n', n);
		*direct = 1;
		if (nl) m->out_mode = MA_LINESTART;   /* the caller's write reaches the newline or is retried */
		return nl ? nl - p + 1 : (long)n;
	}
	size_t i = 0;
	while (i < n) {
		if (m->line_len >= sizeof m->line) goto flush;
		char c = p[i++];
		m->line[m->line_len++] = c;
		if (c == '\n') {
			int r = ma_line(m, io, m->line, m->line_len);
			m->line_len = 0; m->out_mode = MA_LINESTART;
			return r ? -1 : (long)i;
		}
		if (!ma_viable(m->line, m->line_len)) goto flush;
	}
	m->out_mode = MA_HOLD;
	return (long)i;
flush:
	{
		int r = io->send(io->ctx, m->line, m->line_len);
		m->line_len = 0; m->out_mode = MA_PASS;
		if (r) return -1;
		return i ? (long)i : mailauth_out(m, io, p, n, direct);
	}
}

/* ---- server -> client ---- */

static int ma_queue(struct mailauth *m, const char *p, size_t n)
{
	if (m->inq_len + n > m->inq_cap) {
		size_t cap = (m->inq_len + n) * 2 + 256;
		char *q = realloc(m->inq, cap);
		if (!q) return -1;
		m->inq = q; m->inq_cap = cap;
	}
	if (n) { memcpy(m->inq + m->inq_len, p, n); m->inq_len += n; }
	return 0;
}

/* An EHLO reply line: AUTH without LOGIN, with PLAIN, when the server offers XOAUTH2. */
static int ma_ehlo_line(struct mailauth *m, const char *s, size_t n)
{
	if (n < 4 || strncmp(s, "250", 3) != 0) { m->smtp_ehlo = 0; return ma_queue(m, s, n); }
	if (s[3] == ' ') m->smtp_ehlo = 0;
	if (!ma_starts_ci(s + 4, n - 4, "AUTH ")) return ma_queue(m, s, n);
	char mech[MAILAUTH_LINE_MAX]; size_t e = n;
	while (e > 9 && (s[e - 1] == '\n' || s[e - 1] == '\r')) e--;
	size_t ml = e - 9 < sizeof mech - 1 ? e - 9 : sizeof mech - 1;
	memcpy(mech, s + 9, ml); mech[ml] = 0;
	char out[MAILAUTH_LINE_MAX + 16]; size_t o = 0;
	memcpy(out, s, 9); o = 9;
	int plain = 0, login = 0, x = 0;
	char *save;
	for (char *w = strtok_r(mech, " ", &save); w; w = strtok_r(NULL, " ", &save)) {
		if (!strcasecmp(w, "PLAIN")) plain = 1;
		else if (!strcasecmp(w, "LOGIN")) login = 1;
		else if (!strcasecmp(w, "XOAUTH2")) x = 1;
	}
	m->smtp_plain = plain; m->smtp_login = login; m->smtp_xoauth2 = x;
	if (!x) return ma_queue(m, s, n);
	memcpy(mech, s + 9, ml); mech[ml] = 0;
	if (!plain) { memcpy(out + o, "PLAIN", 5); o += 5; }
	for (char *w = strtok_r(mech, " ", &save); w; w = strtok_r(NULL, " ", &save)) {
		if (!strcasecmp(w, "LOGIN")) continue;
		size_t wl = strlen(w);
		if (o + wl + 4 >= sizeof out) break;
		if (o > 9) out[o++] = ' ';
		memcpy(out + o, w, wl); o += wl;
	}
	memcpy(out + o, "\r\n", 2); o += 2;
	return ma_queue(m, out, o);
}

/* One whole line from the server. */
static int ma_in_line(struct mailauth *m, const struct mailauth_io *io, const char *s, size_t n)
{
	char b64[700];
	if (m->imap_await) {
		/* A challenge is the server's refusal; the tagged NO follows the empty answer. */
		if (n >= 1 && s[0] == '+') return io->send(io->ctx, "\r\n", 2) < 0 ? -1 : 0;
		size_t t = strlen(m->imap_tag);
		if (n > t && strncmp(s, m->imap_tag, t) == 0 && s[t] == ' ') {
			m->imap_await = 0;
			if (n > t + 3 && strncasecmp(s + t + 1, "OK", 2) != 0 && ma_was_refused(m)) return -1;
		}
		return ma_queue(m, s, n);
	}
	if (m->smtp_await) {
		if (n >= 4 && strncmp(s, "334", 3) == 0) { ma_was_refused(m); return io->send(io->ctx, "\r\n", 2) < 0 ? -1 : 0; }
		m->smtp_await = 0;
		if (n >= 1 && s[0] == '5' && ma_was_refused(m)) return -1;
		return ma_queue(m, s, n);
	}
	if (m->smtp_replay) {
		if (n >= 4 && strncmp(s, "334", 3) == 0) {
			const char *v = m->smtp_replay == 1 ? m->replay_user : m->replay_pass;
			ma_b64_encode((const unsigned char *)v, strlen(v), b64);
			if (m->smtp_replay++ == 2) { m->smtp_replay = 0; memset(m->replay_pass, 0, sizeof m->replay_pass); }
			return ma_send_str(io, b64) || ma_send_str(io, "\r\n") ? -1 : 0;
		}
		m->smtp_replay = 0; memset(m->replay_pass, 0, sizeof m->replay_pass);
		return ma_queue(m, s, n);
	}
	if (m->smtp_ehlo) return ma_ehlo_line(m, s, n);
	return ma_queue(m, s, n);
}

/* What the service is still to read, without reading the server: into buf, up to cap. */
static size_t mailauth_pending(struct mailauth *m, char *buf, size_t cap)
{
	size_t n = m->inq_len < cap ? m->inq_len : cap;
	if (!n) return 0;
	memcpy(buf, m->inq, n);
	memmove(m->inq, m->inq + n, m->inq_len - n);
	m->inq_len -= n;
	return n;
}

/*
 * got bytes arrived from the server in buf (which holds cap). They are taken in, and buf is
 * filled with what the service should read now; returns that length (0: nothing yet - the
 * rest of a line, or a challenge answered here). -1 when answering a challenge failed, or
 * when a refusal is to reach the service as a dropped connection (see the top).
 */
static long mailauth_in(struct mailauth *m, const struct mailauth_io *io, char *buf, size_t got, size_t cap)
{
	size_t i = 0;
	while (i < got) {
		if (!mailauth_watching(m)) {
			if (ma_queue(m, buf + i, got - i)) return -1;
			break;
		}
		char c = buf[i++];
		if (m->carry_len < sizeof m->carry) m->carry[m->carry_len++] = c;
		if (c == '\n') {
			size_t n = m->carry_len; m->carry_len = 0;
			if (ma_in_line(m, io, m->carry, n)) return -1;
		}
	}
	return (long)mailauth_pending(m, buf, cap);
}

static void mailauth_free(struct mailauth *m) { free(m->inq); memset(m, 0, sizeof *m); }

#endif
