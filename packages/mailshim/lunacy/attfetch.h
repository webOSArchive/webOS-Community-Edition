/*
 * Palm's attachment downloads, in the form EAS 14.0 and later take them (Docs/outlook-eas.md).
 *
 * Palm's mojomail-eas fetches an attachment as EAS 12.1 does (EasAttachmentDownload):
 * Cmd=GetAttachment&AttachmentName=<file reference>, and the reply's body is the file itself, its
 * size in Content-Length (the service files it in the file cache at that size before any byte
 * arrives; with none, the cache refuses it: "size must be greater than 0"). GetAttachment is gone
 * from 14.0; Exchange Online, at 16.1 only since March 2026, answers it with HTTP 400, which Email
 * shows as "http error 400" (measured on the Pixel Tablet, 2026-11-14).
 *
 * Where the version adapter sends the request at 14.0 or later, it goes as the command that
 * replaced it, with the same file reference (MS-ASCMD 2.2.1.10):
 *
 *   ItemOperations / Fetch / Store "Mailbox", airsyncbase:FileReference
 *
 * with MS-ASAcceptMultiPart: T, so the file comes as a part of its own rather than base64 inside
 * the WBXML. The reply is taken apart as it arrives: its part table and WBXML part (the statuses,
 * the content type) are held, then the caller is told the headers GetAttachment would have
 * carried - Content-Type, Content-Length: the file's size - and given the file's bytes, never
 * held. A reply without parts (a server ignoring the multipart ask) is held whole and its Data
 * decoded. A failed Fetch is a failed download, with the HTTP code that says why.
 * Pure logic, tested on the build machine (tests/attfetch_test.c).
 */
#ifndef LUNACY_ATTFETCH_H
#define LUNACY_ATTFETCH_H

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/*
 * The file reference of a GetAttachment URL, into out, exactly as it stands; 0 when it isn't one.
 * Not %-decoded: Palm appends the reference the server gave it unescaped (EasNetworkCommand::
 * SetCommandUrl), and Exchange's references are themselves %-escaped ("5%3a3%3a1"), the form
 * ItemOperations wants back. Decoded, Exchange Online refused it (Fetch status 15, 2026-11-14).
 */
static int af_parse_url(const char *url, char *out, size_t cap)
{
	char cmd[32];
	if (!url || !cm_query(url, "Cmd", cmd, sizeof cmd) || strcmp(cmd, "GetAttachment") != 0) return 0;
	const char *q = strchr(url, '?');
	while (q) {
		q++;
		if (strncmp(q, "AttachmentName=", 15) == 0) {
			size_t n = strcspn(q + 15, "&");
			if (n == 0 || n >= cap) return 0;
			memcpy(out, q + 15, n); out[n] = 0;
			return 1;
		}
		q = strchr(q, '&');
	}
	return 0;
}

/* url with Cmd=GetAttachment as Cmd=ItemOperations and AttachmentName taken out, into out. */
static int af_url(const char *url, char *out, size_t cap)
{
	const char *q = strchr(url, '?');
	if (!q || (size_t)(q - url) + 1 >= cap) return 0;
	size_t o = (size_t)(q - url);
	memcpy(out, url, o);
	char sep = '?';
	const char *p = q + 1;
	while (*p) {
		const char *e = strchr(p, '&');
		size_t n = e ? (size_t)(e - p) : strlen(p);
		const char *put = p; size_t pn = n;
		if (n >= 4 && strncmp(p, "Cmd=", 4) == 0) { put = "Cmd=ItemOperations"; pn = 18; }
		else if (n >= 15 && strncmp(p, "AttachmentName=", 15) == 0) pn = 0;
		if (pn) {
			if (o + 1 + pn + 1 > cap) return 0;
			out[o++] = sep; sep = '&';
			memcpy(out + o, put, pn); o += pn;
		}
		p += n; if (*p == '&') p++;
	}
	out[o] = 0;
	return 1;
}

/* The ItemOperations Fetch body for a file reference, in a new buffer; its length in *len. */
static unsigned char *af_body(const char *ref, size_t *len)
{
	size_t rl = strlen(ref);
	unsigned char *b = malloc(rl + 32), *w = b;
	if (!b) return NULL;
	static const unsigned char head[] = { 0x03, 0x01, 0x6a, 0x00,
		0x00, 0x14, 0x45, 0x46,                              /* ItemOperations page: ItemOperations, Fetch */
		0x47, 0x03, 'M', 'a', 'i', 'l', 'b', 'o', 'x', 0x00, 0x01,   /* Store */
		0x00, 0x11, 0x51, 0x03 };                            /* AirSyncBase page: FileReference */
	memcpy(w, head, sizeof head); w += sizeof head;
	memcpy(w, ref, rl); w += rl;
	*w++ = 0x00; *w++ = 0x01;                                /* /FileReference */
	*w++ = 0x01; *w++ = 0x01;                                /* /Fetch, /ItemOperations */
	*len = (size_t)(w - b);
	return b;
}

/* What a reply's WBXML says. */
struct af_info {
	int status;             /* ItemOperations' own Status (0: none seen) */
	int fetch_status;       /* the Fetch's Status */
	char type[128];         /* airsyncbase:ContentType, if the server gave one */
	const unsigned char *data; size_t data_len;   /* an inline Data (no multipart), as sent */
	int data_b64;           /* Data came as a string: base64 */
};

static int af_mb(const unsigned char *b, size_t n, size_t *i, size_t *v)
{
	*v = 0;
	for (int k = 0; k < 5 && *i < n; k++) {
		unsigned char c = b[(*i)++];
		*v = (*v << 7) | (c & 0x7f);
		if (!(c & 0x80)) return 1;
	}
	return 0;
}

/* Reads a reply's WBXML: the statuses, the content type, an inline Data. 0 if it isn't WBXML. */
static int af_wbxml(const unsigned char *b, size_t n, struct af_info *f)
{
	memset(f, 0, sizeof *f);
	if (n < 4 || b[0] != 0x03) return 0;
	size_t i = 1, v;
	if (!af_mb(b, n, &i, &v) || !af_mb(b, n, &i, &v) || !af_mb(b, n, &i, &v)) return 0;
	i += v;                                               /* the string table: none expected */
	int page = 0, tag = 0, depth_fetch = 0, depth = 0, fetch_at = -1;
	while (i < n) {
		unsigned char t = b[i++];
		if (t == 0x00) { if (i >= n) return 0; page = b[i++]; continue; }
		if (t == 0x01) { if (depth > 0) depth--; if (fetch_at >= 0 && depth <= fetch_at) { fetch_at = -1; depth_fetch = 0; } continue; }
		if (t == 0x03 || t == 0xc3) {
			const unsigned char *s; size_t sl;
			if (t == 0x03) { s = b + i; sl = strnlen((const char *)s, n - i); i += sl + 1; }
			else { if (!af_mb(b, n, &i, &v) || v > n - i) return 0; s = b + i; sl = v; i += v; }
			if (page == 0x14 && tag == 0x0d) {             /* Status */
				char num[8]; size_t k = sl < sizeof num - 1 ? sl : sizeof num - 1;
				memcpy(num, s, k); num[k] = 0;
				if (depth_fetch) f->fetch_status = atoi(num); else if (!f->status) f->status = atoi(num);
			} else if (page == 0x11 && tag == 0x17) {      /* airsyncbase:ContentType */
				size_t k = sl < sizeof f->type - 1 ? sl : sizeof f->type - 1;
				memcpy(f->type, s, k); f->type[k] = 0;
			} else if (page == 0x14 && tag == 0x0c && depth_fetch) {   /* Data */
				f->data = s; f->data_len = sl; f->data_b64 = t == 0x03;
			}
			continue;
		}
		if (t & 0x80) return 0;                            /* attributes: not EAS */
		tag = t & 0x3f;
		if (page == 0x14 && tag == 0x06 && depth > 0) { depth_fetch = 1; if (t & 0x40) fetch_at = depth; }   /* a Fetch in the Response */
		if (t & 0x40) depth++;
	}
	return 1;
}

/* Base64 into out (at least n * 3 / 4 bytes); the decoded length. */
static size_t af_unbase64(const unsigned char *s, size_t n, unsigned char *out)
{
	unsigned acc = 0; int bits = 0; size_t o = 0;
	for (size_t i = 0; i < n; i++) {
		unsigned char c = s[i]; int v;
		if (c >= 'A' && c <= 'Z') v = c - 'A';
		else if (c >= 'a' && c <= 'z') v = c - 'a' + 26;
		else if (c >= '0' && c <= '9') v = c - '0' + 52;
		else if (c == '+') v = 62; else if (c == '/') v = 63;
		else continue;                                     /* '=', line breaks */
		acc = (acc << 6) | (unsigned)v; bits += 6;
		if (bits >= 8) { bits -= 8; out[o++] = (unsigned char)(acc >> bits); }
	}
	return o;
}

/* The HTTP code a failed Fetch is told as: what the service makes of a failed GetAttachment. */
static int af_http_code(const struct af_info *f)
{
	int s = f->status != 1 ? f->status : f->fetch_status;
	if (s >= 142 && s <= 144) return 449;                  /* provision first, as 12.1 said it */
	if (s == 5 || s == 16 || s == 18) return 403;          /* access denied, credentials */
	if (s == 6 || s == 15 || s == 4) return 404;           /* no such attachment */
	return 500;
}

/*
 * A reply taken apart as it arrives. af_feed is given the body's bytes in order; it calls
 * head(type, size) once, before the first byte of the file, then data() for the file's bytes.
 * A callback returning nonzero stops it (the caller refused). af_done after the last byte: it
 * judges a plain WBXML reply; a multipart one is whole at state 4 (one cut short, curl reports).
 */
#define AF_HOLD_MAX (64u * 1024 * 1024)
struct af_reply {
	int state;              /* 0 the first bytes, 1 the part table, 2 to the file, 3 the file, 4 past it, 5 WBXML whole, 9 stopped */
	unsigned char *held; size_t held_len, held_cap;
	size_t pos;             /* body bytes seen */
	unsigned nparts;
	size_t off0, len0, off1, len1;
	struct af_info info;
	int told;               /* head() called */
	size_t skip;            /* bytes at the start of the next feed already taken: a paused piece given again */
	int code;               /* a failure's HTTP code (0: none) */
};

typedef int (*af_head_fn)(void *ctx, const char *type, size_t size);
typedef int (*af_data_fn)(void *ctx, const unsigned char *b, size_t n);

static void af_init(struct af_reply *r) { memset(r, 0, sizeof *r); }
static void af_free(struct af_reply *r) { free(r->held); r->held = NULL; r->held_len = r->held_cap = 0; }

static int af_hold(struct af_reply *r, const unsigned char *b, size_t n)
{
	if (r->held_len + n > AF_HOLD_MAX) return -1;
	if (r->held_len + n > r->held_cap) {
		size_t cap = r->held_cap ? r->held_cap : 4096;
		while (cap < r->held_len + n) cap *= 2;
		unsigned char *p = realloc(r->held, cap);
		if (!p) return -1;
		r->held = p; r->held_cap = cap;
	}
	memcpy(r->held + r->held_len, b, n); r->held_len += n;
	return 0;
}

static unsigned af_le32(const unsigned char *b) { return b[0] | b[1] << 8 | b[2] << 16 | (unsigned)b[3] << 24; }

/* The WBXML part is in: whether the file follows (1), or the Fetch failed (0, code set). */
static int af_judge(struct af_reply *r, const unsigned char *w, size_t n)
{
	if (!af_wbxml(w, n, &r->info)) { r->code = 500; return 0; }
	if (r->info.status != 1 || r->info.fetch_status != 1) { r->code = af_http_code(&r->info); return 0; }
	return 1;
}

/*
 * 0 to go on; -1 when stopped (a callback refused, or the reply can't be read: r->code); -2 when
 * data() asked to pause (returned AF_PAUSE): the same bytes are to be fed again from the start of
 * this piece - as curl does once the transfer is unpaused - and what was already taken is skipped.
 */
#define AF_PAUSE 2
static int af_feed(struct af_reply *r, const unsigned char *b, size_t n, void *ctx, af_head_fn head, af_data_fn data)
{
	const unsigned char *start = b;
	if (r->skip) {
		size_t k = r->skip < n ? r->skip : n;
		b += k; n -= k; r->skip -= k;
		if (r->skip) return 0;   /* given again in smaller pieces */
	}
	while (n > 0) {
		if (r->state == 9) return -1;
		if (r->state == 4) { r->pos += n; return 0; }      /* later parts: nothing the caller wants */
		if (r->state == 0 || r->state == 1) {
			size_t want = r->state == 0 ? 4 : 4 + 8 * (size_t)r->nparts;
			size_t k = want - r->held_len < n ? want - r->held_len : n;
			if (af_hold(r, b, k)) { r->code = 500; r->state = 9; return -1; }
			b += k; n -= k; r->pos += k;
			if (r->held_len < want) return 0;
			if (r->state == 0) {
				if (r->held[0] == 0x03) { r->state = 5; continue; }   /* plain WBXML: held whole */
				r->nparts = af_le32(r->held);
				if (r->nparts == 0 || r->nparts > 64) { r->code = 500; r->state = 9; return -1; }
				r->state = 1;
				continue;
			}
			r->off0 = af_le32(r->held + 4); r->len0 = af_le32(r->held + 8);
			if (r->nparts >= 2) { r->off1 = af_le32(r->held + 12); r->len1 = af_le32(r->held + 16); }
			if (r->off0 < r->held_len || (r->nparts >= 2 && r->off1 < r->off0 + r->len0)) { r->code = 500; r->state = 9; return -1; }
			r->held_len = 0;
			r->state = 2;
			continue;
		}
		if (r->state == 2) {
			/* Held up to the end of the WBXML part, then skipped to the file. */
			size_t end = r->off0 + r->len0;
			if (r->pos < end) {
				size_t k = end - r->pos < n ? end - r->pos : n;
				if (r->pos + k > r->off0) {
					size_t from = r->pos >= r->off0 ? 0 : r->off0 - r->pos;
					if (af_hold(r, b + from, k - from)) { r->code = 500; r->state = 9; return -1; }
				}
				b += k; n -= k; r->pos += k;
				if (r->pos < end) return 0;
			}
			if (r->held_len < r->len0) return 0;
			if (!af_judge(r, r->held, r->held_len) || r->nparts < 2) {
				if (!r->code) r->code = 500;               /* a success without the file */
				r->state = 9; return -1;
			}
			if (head(ctx, r->info.type, r->len1)) { r->state = 9; return -1; }
			r->told = 1;
			r->state = 3;
			continue;
		}
		if (r->state == 3) {
			if (r->pos < r->off1) {
				size_t k = r->off1 - r->pos < n ? r->off1 - r->pos : n;
				b += k; n -= k; r->pos += k;
				continue;
			}
			size_t end = r->off1 + r->len1;
			size_t k = end - r->pos < n ? end - r->pos : n;
			int d = k ? data(ctx, b, k) : 0;
			if (d == AF_PAUSE) { r->skip = (size_t)(b - start); return -2; }
			if (d) { r->state = 9; return -1; }
			b += k; n -= k; r->pos += k;
			if (r->pos >= end) r->state = 4;
			continue;
		}
		if (r->state == 5) {
			if (af_hold(r, b, n)) { r->code = 500; r->state = 9; return -1; }
			r->pos += n;
			return 0;
		}
	}
	return 0;
}

/* The reply has ended: a WBXML-only one is judged and its Data given now. 0 when all is well. */
static int af_done(struct af_reply *r, void *ctx, af_head_fn head, af_data_fn data)
{
	if (r->state == 9) return -1;
	if (r->state == 5) {
		r->state = 9;
		if (!af_judge(r, r->held, r->held_len)) return -1;
		if (!r->info.data) { r->code = 500; return -1; }
		unsigned char *out = r->info.data_b64 ? malloc(r->info.data_len * 3 / 4 + 4) : NULL;
		const unsigned char *file = r->info.data; size_t len = r->info.data_len;
		if (r->info.data_b64) { if (!out) { r->code = 500; return -1; } len = af_unbase64(r->info.data, r->info.data_len, out); file = out; }
		int bad = head(ctx, r->info.type, len) || (len && data(ctx, file, len));
		r->told = !bad;
		free(out);
		return bad ? -1 : 0;
	}
	if (r->state != 4) { if (!r->code) r->code = 500; r->state = 9; return -1; }   /* cut short */
	return 0;
}

#endif
