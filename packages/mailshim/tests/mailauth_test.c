/*
 * The mail services' OAuth translation (libpreload/mailauth.h), on the build machine.
 *
 *   cc -O2 -Wall -I../libpreload mailauth_test.c -o mailauth_test && ./mailauth_test
 *
 * Plays the service's writes and the server's replies through it, as preload.c's glib
 * wrappers do, and checks what each side gets: the XOAUTH2 logins for IMAP and SMTP, the
 * hidden error challenges, the EHLO change and the AUTH LOGIN it can make necessary, and that
 * everything else - a real password, an unknown handle, a message body - goes by unchanged
 * however the writes are cut. Exits 0 when all hold.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "mailauth.h"

static char sent[1 << 20]; static size_t sent_len;
static int failures;

#define HANDLE "oauth2:0123456789abcdef0123456789abcdef"
#define DEAD   "oauth2:ffffffffffffffffffffffffffffffff"
#define FRESH  "oauth2:11111111111111111111111111111111"   /* a token the provider has just issued */
#define LATER  "oauth2:22222222222222222222222222222222"   /* no token just now: the provider unreachable */

static int fake_send(void *ctx, const char *p, size_t n) { (void)ctx; memcpy(sent + sent_len, p, n); sent_len += n; return 0; }
static int stale_asks;
static int fake_token(void *ctx, const char *user, const char *handle, int stale, char *buf, size_t cap)
{
	(void)ctx; (void)user;
	if (stale) stale_asks++;
	if (!strcmp(handle, HANDLE)) { snprintf(buf, cap, "ya29.TOKEN-123"); return 1; }
	if (!strcmp(handle, DEAD)) { buf[0] = 0; return 1; }
	if (!strcmp(handle, FRESH)) { snprintf(buf, cap, "ya29.NEW"); return 2; }
	if (!strcmp(handle, LATER)) return -1;
	return 0;
}
static const struct mailauth_io io = { fake_send, fake_token, NULL };

static void check(int ok, const char *what) { if (!ok) { fprintf(stderr, "mailauth_test: FAIL: %s\n", what); failures++; } }

/* The service writes s in pieces of `step` bytes, as preload.c's write wrapper takes them. */
static void write_as_service(struct mailauth *m, const char *s, size_t n, size_t step)
{
	size_t at = 0;
	while (at < n) {
		size_t piece = n - at < step ? n - at : step;
		size_t done = 0;
		while (done < piece) {
			int direct;
			long r = mailauth_out(m, &io, s + at + done, piece - done, &direct);
			if (r <= 0) { check(0, "mailauth_out took nothing"); return; }
			if (direct) fake_send(NULL, s + at + done, (size_t)r);
			done += (size_t)r;
		}
		at += piece;
	}
}

/* The server's bytes arrive in pieces of `step`; returns what the service reads. */
static char got[1 << 16]; static size_t got_len;
static void read_as_service(struct mailauth *m, const char *s, size_t step)
{
	size_t n = strlen(s), at = 0;
	char buf[4096];
	while (at < n) {
		size_t piece = n - at < step ? n - at : step;
		if (!mailauth_watching(m)) { memcpy(got + got_len, s + at, piece); got_len += piece; at += piece; continue; }
		memcpy(buf, s + at, piece);
		long r = mailauth_in(m, &io, buf, piece, sizeof buf);
		if (r < 0) { check(0, "mailauth_in failed"); return; }
		memcpy(got + got_len, buf, (size_t)r); got_len += (size_t)r;
		at += piece;
		size_t more;
		while ((more = mailauth_pending(m, buf, sizeof buf))) { memcpy(got + got_len, buf, more); got_len += more; }
	}
}

/* The server's bytes in one piece: 1 when the connection is dropped (mailauth_in's -1). */
static int read_drops(struct mailauth *m, const char *s)
{
	char buf[4096]; size_t n = strlen(s);
	memcpy(buf, s, n);
	long r = mailauth_in(m, &io, buf, n, sizeof buf);
	if (r > 0) { memcpy(got + got_len, buf, (size_t)r); got_len += (size_t)r; }
	return r < 0;
}

static void login(struct mailauth *m, const char *handle)
{
	char l[256]; snprintf(l, sizeof l, "a1 LOGIN \"u\" \"%s\"\r\n", handle);
	write_as_service(m, l, strlen(l), 4096);
}

static void reset(struct mailauth *m) { mailauth_free(m); mailauth_init(m); sent_len = 0; got_len = 0; }

static int sent_is(const char *want) { return sent_len == strlen(want) && !memcmp(sent, want, sent_len); }
static int got_is(const char *want) { return got_len == strlen(want) && !memcmp(got, want, got_len); }

static const char *xoauth2(const char *user, const char *token)
{
	static char b64[1024]; char raw[512];
	int n = snprintf(raw, sizeof raw, "user=%s\001auth=Bearer %s\001\001", user, token);
	ma_b64_encode((unsigned char *)raw, (size_t)n, b64);
	return b64;
}

static const char *plain(const char *user, const char *pass)
{
	static char b64[1024]; char raw[512];
	size_t n = 0; raw[n++] = 0;
	memcpy(raw + n, user, strlen(user)); n += strlen(user); raw[n++] = 0;
	memcpy(raw + n, pass, strlen(pass)); n += strlen(pass);
	ma_b64_encode((unsigned char *)raw, n, b64);
	return b64;
}

int main(void)
{
	struct mailauth m; mailauth_init(&m);
	char want[4096], line[4096];

	/* IMAP: a handle becomes XOAUTH2, however the line is cut. */
	size_t steps[] = { 1, 3, 7, 4096 };
	for (int i = 0; i < 4; i++) {
		reset(&m);
		const char *login = "~A3 LOGIN \"ada@example.org\" \"" HANDLE "\"\r\n";
		write_as_service(&m, login, strlen(login), steps[i]);
		snprintf(want, sizeof want, "~A3 AUTHENTICATE XOAUTH2 %s\r\n", xoauth2("ada@example.org", "ya29.TOKEN-123"));
		check(sent_is(want), "IMAP LOGIN with a handle becomes AUTHENTICATE XOAUTH2");
	}

	/* A refused token's challenge is answered and hidden; the tagged NO arrives (for a token
	   a retry asked for: see below for the first refusal). */
	for (int i = 0; i < 4; i++) {
		reset(&m);
		snprintf(ma_refused, sizeof ma_refused, "%s", HANDLE);
		const char *login = "~A3 LOGIN \"ada@example.org\" \"" HANDLE "\"\r\n";
		write_as_service(&m, login, strlen(login), 4096);
		sent_len = 0;
		read_as_service(&m, "+ eyJzdGF0dXMiOiI0MDAifQ==\r\n~A3 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n* OK later\r\n", steps[i]);
		check(sent_is("\r\n"), "the IMAP challenge is answered with an empty line");
		check(got_is("~A3 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n* OK later\r\n"), "the IMAP challenge is hidden, the NO shown");
		check(!mailauth_watching(&m), "IMAP: watching ends with the tagged reply");
	}

	/* The first refusal of a token that should have worked drops the connection, so the
	   service tries again instead of taking a wrong password; the retry asks for a fresh
	   token, and its refusal is the service's to see. */
	ma_refused[0] = 0;   /* the challenge cases above left one */
	reset(&m);
	login(&m, HANDLE);
	read_as_service(&m, "a1 OK done\r\n", 4096);
	stale_asks = 0;
	reset(&m);
	login(&m, HANDLE);
	check(!read_drops(&m, "+ eyJzdGF0dXMiOiI0MDAifQ==\r\n"), "the challenge alone doesn't drop");
	check(read_drops(&m, "a1 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n"), "a first refusal drops the connection");
	check(got_len == 0, "a dropped refusal shows the service nothing");
	reset(&m);
	login(&m, HANDLE);
	check(stale_asks == 1, "a refused token makes the next login ask for a fresh one");
	check(!read_drops(&m, "a1 NO AUTHENTICATE failed.\r\n"), "a retry's refusal isn't dropped");
	check(got_is("a1 NO AUTHENTICATE failed.\r\n"), "a retry's refusal reaches the service");
	reset(&m);
	login(&m, HANDLE);
	check(stale_asks == 2, "after a final refusal the next login asks afresh again");
	read_as_service(&m, "a1 OK done\r\n", 4096);
	reset(&m);
	login(&m, HANDLE);
	check(stale_asks == 2, "a login after a success doesn't ask for a fresh token");
	reset(&m);
	login(&m, HANDLE);
	check(read_drops(&m, "a1 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n"), "a Microsoft-style NO without a challenge drops too");
	ma_refused[0] = 0;

	/* A token just issued, or an empty one (the sign-in ended): refused to the service at once. */
	const char *final_handles[] = { FRESH, DEAD };
	for (int i = 0; i < 2; i++) {
		reset(&m);
		login(&m, final_handles[i]);
		check(!read_drops(&m, "a1 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n"), "a fresh or empty token's refusal isn't dropped");
		check(got_is("a1 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n"), "a fresh or empty token's refusal reaches the service");
		ma_refused[0] = 0;
	}

	/* No token just now: the login's write fails (a connection failure, tried again), and
	   nothing reaches the server. */
	for (int k = 0; k < 4; k++) {
		reset(&m);
		char l[256]; snprintf(l, sizeof l, "a1 LOGIN \"u\" \"%s\"\r\n", LATER);
		size_t at = 0; long r = 0; int direct;
		while (at < strlen(l) && (r = mailauth_out(&m, &io, l + at, (size_t)(k == 3 ? strlen(l) - at : 1 + (size_t)k), &direct)) > 0) at += (size_t)r;
		check(r < 0, "IMAP: no token just now fails the write");
		check(sent_len == 0, "IMAP: no token just now sends nothing");
	}
	reset(&m);
	write_as_service(&m, "EHLO x\r\n", 8, 4096);
	read_as_service(&m, "250-x\r\n250 AUTH LOGIN PLAIN XOAUTH2\r\n", 4096);
	sent_len = 0;
	{
		int direct;
		snprintf(line, sizeof line, "AUTH PLAIN %s\r\n", plain("u", LATER));
		check(mailauth_out(&m, &io, line, strlen(line), &direct) < 0, "SMTP: no token just now fails the write");
		check(sent_len == 0, "SMTP: no token just now sends nothing");
	}

	/* Success: capabilities and OK pass. */
	reset(&m);
	{ const char *l = "a1 LOGIN \"u\" \"" HANDLE "\"\r\n"; write_as_service(&m, l, strlen(l), 5); }
	read_as_service(&m, "* CAPABILITY IMAP4rev1 IDLE\r\na1 OK u authenticated (Success)\r\n", 9);
	check(got_is("* CAPABILITY IMAP4rev1 IDLE\r\na1 OK u authenticated (Success)\r\n"), "IMAP success passes");

	/* A real password, an unknown handle, a quoted quote: unchanged. */
	const char *same[] = {
		"a1 LOGIN \"ada@example.org\" \"hunter2\"\r\n",
		"a1 LOGIN \"ada@example.org\" \"oauth2:00000000000000000000000000000000\"\r\n",
		"a1 LOGIN \"a\\\"b\" \"oauth2:short\"\r\n",
		"a2 SELECT \"INBOX\"\r\n",
		"AUTH PLAIN AGFkYQBodW50ZXIy\r\n",
		"a3 UID FETCH 1:* (FLAGS)\r\n",
	};
	for (int i = 0; i < 6; i++) for (int k = 0; k < 4; k++) {
		reset(&m);
		write_as_service(&m, same[i], strlen(same[i]), steps[k]);
		check(sent_is(same[i]), "a line without a known handle is sent unchanged");
	}

	/* A handle whose sign-in no longer works: XOAUTH2 with an empty token, so the server refuses it. */
	reset(&m);
	{ const char *l = "a1 LOGIN \"u\" \"" DEAD "\"\r\n"; write_as_service(&m, l, strlen(l), 4096); }
	snprintf(want, sizeof want, "a1 AUTHENTICATE XOAUTH2 %s\r\n", xoauth2("u", ""));
	check(sent_is(want), "a dead handle still becomes XOAUTH2");

	/* SMTP: EHLO's AUTH line without LOGIN when XOAUTH2 is offered. */
	const char *ehlo[][2] = {
		{ "250-smtp.gmail.com at your service\r\n250-AUTH LOGIN PLAIN XOAUTH2 PLAIN-CLIENTTOKEN OAUTHBEARER XOAUTH\r\n250 SMTPUTF8\r\n",
		  "250-smtp.gmail.com at your service\r\n250-AUTH PLAIN XOAUTH2 PLAIN-CLIENTTOKEN OAUTHBEARER XOAUTH\r\n250 SMTPUTF8\r\n" },
		{ "250-outlook.office365.com Hello\r\n250-SIZE 157286400\r\n250-AUTH LOGIN XOAUTH2\r\n250 CHUNKING\r\n",
		  "250-outlook.office365.com Hello\r\n250-SIZE 157286400\r\n250-AUTH PLAIN XOAUTH2\r\n250 CHUNKING\r\n" },
		{ "250-mail.example.org\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n",
		  "250-mail.example.org\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n" },
		{ "250-x\r\n250 AUTH XOAUTH2\r\n", "250-x\r\n250 AUTH PLAIN XOAUTH2\r\n" },
	};
	for (int i = 0; i < 4; i++) for (int k = 0; k < 4; k++) {
		reset(&m);
		write_as_service(&m, "EHLO [127.0.0.1]\r\n", 18, steps[k]);
		check(sent_is("EHLO [127.0.0.1]\r\n"), "EHLO is sent unchanged");
		read_as_service(&m, ehlo[i][0], steps[k]);
		check(got_is(ehlo[i][1]), "the EHLO reply's AUTH line");
		check(!mailauth_watching(&m), "SMTP: watching ends with the EHLO reply's last line");
	}

	/* SMTP AUTH PLAIN with a handle: XOAUTH2, and the 334 challenge hidden. */
	for (int k = 0; k < 4; k++) {
		reset(&m);
		write_as_service(&m, "EHLO x\r\n", 8, 4096);
		read_as_service(&m, ehlo[1][0], 4096);
		sent_len = 0; got_len = 0;
		snprintf(ma_refused, sizeof ma_refused, "%s", HANDLE);   /* a retry's token: its refusal is shown */
		snprintf(line, sizeof line, "AUTH PLAIN %s\r\n", plain("ada@example.org", HANDLE));
		write_as_service(&m, line, strlen(line), steps[k]);
		snprintf(want, sizeof want, "AUTH XOAUTH2 %s\r\n", xoauth2("ada@example.org", "ya29.TOKEN-123"));
		check(sent_is(want), "SMTP AUTH PLAIN with a handle becomes AUTH XOAUTH2");
		sent_len = 0;
		read_as_service(&m, "334 eyJzdGF0dXMiOiI0MDAifQ==\r\n535 5.7.8 Username and Password not accepted\r\n", steps[k]);
		check(sent_is("\r\n"), "the SMTP challenge is answered");
		check(got_is("535 5.7.8 Username and Password not accepted\r\n"), "the SMTP challenge is hidden");
		check(!mailauth_watching(&m), "SMTP: watching ends with the reply");
	}
	/* ...and the first refusal of one that should have worked drops the connection. */
	ma_refused[0] = 0;
	reset(&m);
	write_as_service(&m, "EHLO x\r\n", 8, 4096);
	read_as_service(&m, ehlo[1][0], 4096);
	sent_len = 0; got_len = 0;
	snprintf(line, sizeof line, "AUTH PLAIN %s\r\n", plain("ada@example.org", HANDLE));
	write_as_service(&m, line, strlen(line), 4096);
	check(!read_drops(&m, "334 eyJzdGF0dXMiOiI0MDAifQ==\r\n"), "SMTP: the challenge alone doesn't drop");
	check(read_drops(&m, "535 5.7.8 Username and Password not accepted\r\n"), "SMTP: a first refusal drops the connection");
	check(got_len == 0, "SMTP: a dropped refusal shows the service nothing");
	ma_refused[0] = 0;

	/* A real password where PLAIN was only shown because of the change: AUTH LOGIN for it. */
	for (int k = 0; k < 4; k++) {
		reset(&m);
		write_as_service(&m, "EHLO x\r\n", 8, 4096);
		read_as_service(&m, ehlo[1][0], 4096);
		sent_len = 0; got_len = 0;
		snprintf(line, sizeof line, "AUTH PLAIN %s\r\n", plain("ada@example.org", "hunter2"));
		write_as_service(&m, line, strlen(line), steps[k]);
		check(sent_is("AUTH LOGIN\r\n"), "a real password where PLAIN wasn't offered goes as AUTH LOGIN");
		sent_len = 0;
		read_as_service(&m, "334 VXNlcm5hbWU6\r\n334 UGFzc3dvcmQ6\r\n235 2.7.0 Authentication successful\r\n", steps[k]);
		check(sent_is("YWRhQGV4YW1wbGUub3Jn\r\naHVudGVyMg==\r\n"), "AUTH LOGIN sends the user and password");
		check(got_is("235 2.7.0 Authentication successful\r\n"), "the service sees only the result");
	}
	/* ...and where the server offered PLAIN itself, PLAIN is sent as it was. */
	reset(&m);
	write_as_service(&m, "EHLO x\r\n", 8, 4096);
	read_as_service(&m, ehlo[0][0], 4096);
	sent_len = 0;
	snprintf(line, sizeof line, "AUTH PLAIN %s\r\n", plain("ada@example.org", "hunter2"));
	write_as_service(&m, line, strlen(line), 4096);
	check(sent_is(line), "PLAIN offered by the server: sent unchanged");

	/* COMPRESS: after it the stream is deflate's. Nothing may be held, newline or not (a
	   compressed command has none: holding one hung every sync with Gmail). */
	for (int k = 0; k < 4; k++) {
		reset(&m);
		const char *c = "a5 COMPRESS DEFLATE\r\n";
		write_as_service(&m, c, strlen(c), steps[k]);
		check(sent_is(c), "COMPRESS is sent unchanged");
		sent_len = 0;
		static const char packed[] = "x LOGIN \x01\x9c\x4b";   /* no newline, starts like a login */
		write_as_service(&m, packed, sizeof packed - 1, steps[k]);
		check(sent_len == sizeof packed - 1 && !memcmp(sent, packed, sent_len), "after COMPRESS every byte goes at once");
		check(!mailauth_watching(&m), "after COMPRESS nothing is watched");
	}
	/* Bytes that aren't text are never held, even with no COMPRESS seen. */
	reset(&m);
	{ static const char bin[] = "\x78\x9c\x03\x00"; write_as_service(&m, bin, 4, 4096); check(sent_len == 4, "binary bytes go at once"); }

	/* A message body, cut every which way, goes through byte for byte. */
	static char body[200000];
	unsigned seed = 7;
	size_t bn = 0;
	const char *words[] = { "LOGIN ", "AUTH ", "PLAIN ", "\r\n", "EHLO ", "a1 ", "\"", "x", "oauth2:", " ", "\n" };
	while (bn < sizeof body - 32) { seed = seed * 1103515245 + 12345; const char *w = words[(seed >> 16) % 11]; memcpy(body + bn, w, strlen(w)); bn += strlen(w); }
	/* A command always ends its line; a line still open is held until it does. */
	memcpy(body + bn, "\r\n", 2); bn += 2;
	size_t cuts[] = { 1, 2, 13, 512, 65536 };
	for (int k = 0; k < 5; k++) {
		reset(&m);
		write_as_service(&m, body, bn, cuts[k]);
		check(sent_len == bn && !memcmp(sent, body, bn), "a body goes through unchanged");
	}

	mailauth_free(&m);
	if (failures) { fprintf(stderr, "mailauth_test: %d failed\n", failures); return 1; }
	printf("mailauth_test: ok\n");
	return 0;
}
