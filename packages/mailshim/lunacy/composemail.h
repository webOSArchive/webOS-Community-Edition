/*
 * Palm's sends, in the form EAS 14.0 and later take them (Docs/oauth.md).
 *
 * Palm's mojomail-eas sends mail as EAS 12.1 does: Cmd=SendMail (or SmartReply, SmartForward
 * with &ItemId= and &CollectionId=) with &SaveInSent=T in the URL and the raw message as the body,
 * Content-Type: message/rfc822. From 14.0 a server wants a WBXML ComposeMail request with the
 * message in its Mime element; Exchange Online, at 16.1 only since March 2026, answers the old
 * form with HTTP 200 and ComposeMail status 101 (invalid content), which the service took for
 * sent - and the mail went nowhere. Where the version adapter sends a request at 14.0 or later,
 * the body is streamed as
 *
 *   SendMail/SmartReply/SmartForward
 *     ClientId, Source (FolderId, ItemId: replies and forwards), SaveInSentItems, Mime (opaque)
 *
 * with the caller's message passed through unread in the middle, so a message of any size is
 * never held. A reply whose ComposeMail status isn't 1 is a failed send. Pure logic, tested on
 * the build machine (tests/composemail_test.c).
 */
#ifndef LUNACY_COMPOSEMAIL_H
#define LUNACY_COMPOSEMAIL_H

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#define CM_SENDMAIL 0x45
#define CM_SMARTFORWARD 0x46
#define CM_SMARTREPLY 0x47

struct cm_send {
	int kind;            /* CM_SENDMAIL, CM_SMARTFORWARD, CM_SMARTREPLY; 0: not a send */
	int save;            /* SaveInSent=T */
	char item[256];      /* ItemId, decoded */
	char folder[128];    /* CollectionId, decoded */
};

/* The query value of name in url, %-decoded, into out; 0 when it isn't there. */
static int cm_query(const char *url, const char *name, char *out, size_t cap)
{
	const char *q = strchr(url, '?');
	size_t nl = strlen(name);
	while (q) {
		q++;
		if (strncmp(q, name, nl) == 0 && q[nl] == '=') {
			const char *v = q + nl + 1;
			size_t o = 0;
			while (*v && *v != '&' && o + 1 < cap) {
				if (*v == '%' && v[1] && v[2]) {
					char hex[3] = { v[1], v[2], 0 };
					out[o++] = (char)strtol(hex, NULL, 16); v += 3;
				} else if (*v == '+') { out[o++] = ' '; v++; }
				else out[o++] = *v++;
			}
			out[o] = 0;
			return 1;
		}
		q = strchr(q, '&');
	}
	return 0;
}

/* What the request at url sends, if it is a send. */
static int cm_parse_url(const char *url, struct cm_send *s)
{
	char cmd[32], save[8];
	memset(s, 0, sizeof *s);
	if (!url || !cm_query(url, "Cmd", cmd, sizeof cmd)) return 0;
	if (strcmp(cmd, "SendMail") == 0) s->kind = CM_SENDMAIL;
	else if (strcmp(cmd, "SmartReply") == 0) s->kind = CM_SMARTREPLY;
	else if (strcmp(cmd, "SmartForward") == 0) s->kind = CM_SMARTFORWARD;
	else return 0;
	s->save = cm_query(url, "SaveInSent", save, sizeof save) && (save[0] == 'T' || save[0] == 't');
	if (s->kind != CM_SENDMAIL) {
		/* A reply or forward without its source can't be said in ComposeMail: left alone. */
		if (!cm_query(url, "ItemId", s->item, sizeof s->item) || !cm_query(url, "CollectionId", s->folder, sizeof s->folder)) { s->kind = 0; return 0; }
	}
	return s->kind;
}

static size_t cm_str(unsigned char *w, unsigned char tag, const char *v)
{
	size_t n = strlen(v), o = 0;
	w[o++] = tag; w[o++] = 0x03;
	memcpy(w + o, v, n); o += n;
	w[o++] = 0x00; w[o++] = 0x01;
	return o;
}

/* The bytes before the message, into out (at least 512 + item + folder); returns their count. */
static size_t cm_prefix(const struct cm_send *s, const char *client_id, unsigned long mime_len, unsigned char *out)
{
	size_t o = 0;
	static const unsigned char head[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x15 };   /* WBXML 1.3, the ComposeMail page */
	memcpy(out, head, sizeof head); o += sizeof head;
	out[o++] = (unsigned char)s->kind;
	o += cm_str(out + o, 0x51, client_id);                     /* ClientId */
	if (s->kind != CM_SENDMAIL) {
		out[o++] = 0x4b;                                       /* Source */
		o += cm_str(out + o, 0x4c, s->folder);                 /* FolderId */
		o += cm_str(out + o, 0x4d, s->item);                   /* ItemId */
		out[o++] = 0x01;
	}
	if (s->save) out[o++] = 0x08;                              /* SaveInSentItems, empty */
	out[o++] = 0x50; out[o++] = 0xc3;                          /* Mime, OPAQUE */
	unsigned char mb[5]; int k = 0;
	do { mb[k++] = (unsigned char)(mime_len & 0x7f); mime_len >>= 7; } while (mime_len && k < 5);
	while (k--) out[o++] = (unsigned char)(mb[k] | (k ? 0x80 : 0));
	return o;
}

/* The bytes after it: /Mime, /SendMail. */
static const unsigned char cm_suffix[] = { 0x01, 0x01 };

/* A ComposeMail reply's status (0: none; an empty body is a successful send). */
static int cm_status(const unsigned char *b, size_t n)
{
	if (n < 11 || b[0] != 0x03 || b[2] != 0x6a || b[3] != 0x00 || b[4] != 0x00 || b[5] != 0x15) return 0;
	if (b[6] != CM_SENDMAIL && b[6] != CM_SMARTFORWARD && b[6] != CM_SMARTREPLY) return 0;
	if (b[7] != 0x52 || b[8] != 0x03) return 0;
	int v = 0;
	for (size_t i = 9; i < n && b[i]; i++) { if (b[i] < '0' || b[i] > '9') return 0; v = v * 10 + (b[i] - '0'); }
	return v;
}

/*
 * A meeting reply's calendar part, said as one (Docs/outlook-eas.md, "Meeting invitations").
 * Palm answers an invitation with a message whose one part is its vCalendar (METHOD:REPLY):
 *
 *   Content-Type: text/calendar / Content-Transfer-Encoding: base64 / Content-Disposition: inline
 *
 * with no `method` parameter, which RFC 6047 requires and Outlook goes by: the organizer saw the
 * reply as text and the attendee's answer was never recorded (2026-11-14, Exchange Online). The
 * three lines are rewritten in place, to the same length - the ComposeMail around the message has
 * already said how long it is - as `Content-Type: text/calendar; method=REPLY; charset=UTF-8`
 * and the encoding line (inline is the default). Only where the part's body decodes to a
 * vCalendar with METHOD:REPLY, and only where the whole of it is in the piece given; anything else
 * is left as it is. Returns whether it rewrote.
 */
static int cm_fix_reply(char *b, size_t n)
{
	static const char *const olds[2] = {
		"Content-Type: text/calendar\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: inline\r\n\r\n",
		"Content-Type: text/calendar\nContent-Transfer-Encoding: base64\nContent-Disposition: inline\n\n" };
	static const char *const news[2] = {
		"Content-Type: text/calendar; method=REPLY; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n",
		"Content-Type: text/calendar;method=REPLY; charset=UTF-8\nContent-Transfer-Encoding: base64\n\n" };
	static const char b64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	int done = 0;
	for (int v = 0; v < 2; v++) {
		size_t ol = strlen(olds[v]);
		if (strlen(news[v]) != ol) continue;          /* can't happen: the two are the same length */
		for (size_t i = 0; i + ol <= n; i++) {
			if (memcmp(b + i, olds[v], ol) != 0) continue;
			/* The body: its first 80 base64 characters, decoded. */
			char dec[64]; size_t dl = 0; unsigned acc = 0; int bits = 0;
			for (size_t k = i + ol; k < n && k < i + ol + 120 && dl < sizeof dec - 1; k++) {
				const char *q = b[k] ? strchr(b64, b[k]) : NULL;
				if (!q) { if (b[k] == '\r' || b[k] == '\n') continue; break; }
				acc = acc << 6 | (unsigned)(q - b64); bits += 6;
				if (bits >= 8) { bits -= 8; dec[dl++] = (char)(acc >> bits); }
			}
			dec[dl] = 0;
			if (strncmp(dec, "BEGIN:VCALENDAR", 15) != 0 || !strstr(dec, "METHOD:REPLY")) continue;
			memcpy(b + i, news[v], ol);
			done = 1;
		}
	}
	return done;
}

#endif
