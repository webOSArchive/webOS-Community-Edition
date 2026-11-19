/*
 * Palm's attachment downloads as ItemOperations Fetch (libpreload/attfetch.h), on the build machine.
 *
 *   cc -O2 -Wall -I../libpreload attfetch_test.c -o attfetch_test && ./attfetch_test
 *
 * The replies are built here in the form MS-ASCMD gives (2.2.2.9, multipart: a part count, then
 * an offset and length for each part, then the parts; part 0 the WBXML, part 1 the file).
 */
#include <stdio.h>
#include <string.h>

#include "composemail.h"
#include "attfetch.h"

static int failures;
static void check(int ok, const char *what) { if (!ok) { fprintf(stderr, "attfetch_test: FAIL: %s\n", what); failures++; } }

struct sink { char type[128]; size_t size; int heads; unsigned char got[4096]; size_t got_len; int refuse; int pauses; };
static int on_head(void *c, const char *type, size_t size) { struct sink *s = c; snprintf(s->type, sizeof s->type, "%s", type); s->size = size; s->heads++; return 0; }
static int on_data(void *c, const unsigned char *b, size_t n) { struct sink *s = c; if (s->refuse) return 1; if (s->pauses > 0) { s->pauses--; return AF_PAUSE; } memcpy(s->got + s->got_len, b, n); s->got_len += n; return 0; }

/* ItemOperations reply WBXML with the given statuses; a ContentType and inline Data if given. */
static size_t reply_wbxml(unsigned char *w, const char *status, const char *fetch_status, const char *type, const char *b64)
{
	unsigned char *o = w;
	static const unsigned char head[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x14, 0x45 };
	memcpy(o, head, sizeof head); o += sizeof head;
	*o++ = 0x4d; *o++ = 0x03; o += sprintf((char *)o, "%s", status); *o++ = 0; *o++ = 0x01;   /* Status */
	if (fetch_status) {
		*o++ = 0x4e; *o++ = 0x46;                                                         /* Response, Fetch */
		*o++ = 0x4d; *o++ = 0x03; o += sprintf((char *)o, "%s", fetch_status); *o++ = 0; *o++ = 0x01;
		*o++ = 0x00; *o++ = 0x11; *o++ = 0x51; *o++ = 0x03; o += sprintf((char *)o, "AAMk%%3D/1"); *o++ = 0; *o++ = 0x01;
		if (type) { *o++ = 0x57; *o++ = 0x03; o += sprintf((char *)o, "%s", type); *o++ = 0; *o++ = 0x01; }
		*o++ = 0x00; *o++ = 0x14; *o++ = 0x4b;                                            /* Properties */
		if (b64) { *o++ = 0x4c; *o++ = 0x03; o += sprintf((char *)o, "%s", b64); *o++ = 0; *o++ = 0x01; }
		else { *o++ = 0x51; *o++ = 0x03; *o++ = '1'; *o++ = 0; *o++ = 0x01; }             /* Part 1 */
		*o++ = 0x01; *o++ = 0x01; *o++ = 0x01;                                            /* /Properties /Fetch /Response */
	}
	*o++ = 0x01;
	return (size_t)(o - w);
}

static void le32(unsigned char *b, unsigned v) { b[0] = v; b[1] = v >> 8; b[2] = v >> 16; b[3] = v >> 24; }

static size_t multipart(unsigned char *out, const unsigned char *w, size_t wl, const unsigned char *file, size_t fl)
{
	unsigned n = file ? 2 : 1, head = 4 + 8 * n;
	le32(out, n);
	le32(out + 4, head); le32(out + 8, (unsigned)wl);
	if (file) { le32(out + 12, head + (unsigned)wl); le32(out + 16, (unsigned)fl); }
	memcpy(out + head, w, wl);
	if (file) memcpy(out + head + wl, file, fl);
	return head + wl + (file ? fl : 0);
}

static void run(const unsigned char *body, size_t n, size_t chunk, struct sink *s, struct af_reply *r, int *fed, int *done)
{
	memset(s, 0, sizeof *s);
	af_init(r);
	*fed = 0;
	for (size_t i = 0; i < n && *fed == 0; i += chunk) *fed = af_feed(r, body + i, n - i < chunk ? n - i : chunk, s, on_head, on_data);
	*done = *fed ? -1 : af_done(r, s, on_head, on_data);
	af_free(r);
}

int main(void)
{
	(void)cm_parse_url; (void)cm_prefix; (void)cm_status;   /* composemail.h is here for cm_query */
	char ref[256], url[1024];
	check(af_parse_url("https://outlook.office365.com/Microsoft-Server-ActiveSync?Cmd=GetAttachment&AttachmentName=5%3a3%3a1&User=a@b&DeviceId=X&DeviceType=Palm", ref, sizeof ref)
		&& strcmp(ref, "5%3a3%3a1") == 0, "the file reference as Palm put it, still escaped as Exchange gave it");
	check(!af_parse_url("https://h/x?Cmd=Sync&DeviceId=X", ref, sizeof ref), "Sync isn't a download");
	check(!af_parse_url("https://h/x?Cmd=GetAttachment&DeviceId=X", ref, sizeof ref), "a download without its reference is left alone");
	check(af_url("https://h/Microsoft-Server-ActiveSync?Cmd=GetAttachment&AttachmentName=AAMk%3D&User=a%40b&DeviceId=X&DeviceType=Palm", url, sizeof url)
		&& strcmp(url, "https://h/Microsoft-Server-ActiveSync?Cmd=ItemOperations&User=a%40b&DeviceId=X&DeviceType=Palm") == 0, "the URL as ItemOperations");
	check(af_url("https://h/x?AttachmentName=A&Cmd=GetAttachment", url, sizeof url) && strcmp(url, "https://h/x?Cmd=ItemOperations") == 0, "any order");

	size_t bl;
	unsigned char *body = af_body("AAMk=/1", &bl);
	static const unsigned char want[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x14, 0x45, 0x46,
		0x47, 0x03, 'M', 'a', 'i', 'l', 'b', 'o', 'x', 0x00, 0x01,
		0x00, 0x11, 0x51, 0x03, 'A', 'A', 'M', 'k', '=', '/', '1', 0x00, 0x01, 0x01, 0x01 };
	check(body && bl == sizeof want && memcmp(body, want, bl) == 0, "the Fetch body");
	free(body);

	unsigned char w[1024], reply[8192], file[3000];
	for (size_t i = 0; i < sizeof file; i++) file[i] = (unsigned char)(i * 7 + 3);
	struct sink s; struct af_reply r; int fed, done;

	size_t wl = reply_wbxml(w, "1", "1", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", NULL);
	size_t n = multipart(reply, w, wl, file, sizeof file);
	size_t chunks[] = { 1, 3, 16, 17, 1000, sizeof reply };
	for (size_t c = 0; c < sizeof chunks / sizeof chunks[0]; c++) {
		run(reply, n, chunks[c], &s, &r, &fed, &done);
		char what[64]; snprintf(what, sizeof what, "multipart in %zu-byte pieces", chunks[c]);
		check(fed == 0 && done == 0 && s.heads == 1 && s.size == sizeof file && s.got_len == sizeof file && memcmp(s.got, file, sizeof file) == 0
			&& strcmp(s.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") == 0, what);
	}

	wl = reply_wbxml(w, "1", "1", NULL, NULL);
	n = multipart(reply, w, wl, file, 10);
	run(reply, n, 5, &s, &r, &fed, &done);
	check(done == 0 && s.size == 10 && s.type[0] == 0 && s.got_len == 10, "no content type: none told");

	wl = reply_wbxml(w, "1", "6", NULL, NULL);
	n = multipart(reply, w, wl, NULL, 0);
	run(reply, n, 7, &s, &r, &fed, &done);
	check(fed == -1 && r.code == 404 && s.heads == 0, "object not found: 404, no file");

	wl = reply_wbxml(w, "1", "6", NULL, NULL);
	run(w, wl, 7, &s, &r, &fed, &done);
	check(fed == 0 && done == -1 && r.code == 404 && s.heads == 0, "a failure as plain WBXML");

	wl = reply_wbxml(w, "142", NULL, NULL, NULL);
	run(w, wl, 64, &s, &r, &fed, &done);
	check(done == -1 && r.code == 449, "not provisioned: 449");

	wl = reply_wbxml(w, "1", "1", "text/plain", "aGVsbG8sIHdvcmxk");
	run(w, wl, 4, &s, &r, &fed, &done);
	check(done == 0 && s.size == 12 && s.got_len == 12 && memcmp(s.got, "hello, world", 12) == 0 && strcmp(s.type, "text/plain") == 0, "inline base64 Data");

	wl = reply_wbxml(w, "1", "1", NULL, NULL);
	n = multipart(reply, w, wl, file, sizeof file);
	run(reply, n - 100, 64, &s, &r, &fed, &done);
	check(done == -1 && r.code == 500, "a reply cut short fails");

	n = multipart(reply, w, wl, file, sizeof file);
	memset(&s, 0, sizeof s); s.refuse = 1;
	af_init(&r);
	fed = af_feed(&r, reply, n, &s, on_head, on_data);
	check(fed == -1 && s.heads == 1, "the caller refusing stops it");
	af_free(&r);

	/* The service pausing (its file not open yet): curl gives the same piece again. */
	wl = reply_wbxml(w, "1", "1", NULL, NULL);
	n = multipart(reply, w, wl, file, sizeof file);
	size_t pchunks[] = { 1, 7, 100, 1000, sizeof reply };
	for (size_t c = 0; c < sizeof pchunks / sizeof pchunks[0]; c++) {
		size_t chunk = pchunks[c];
		memset(&s, 0, sizeof s); s.pauses = 3;
		af_init(&r);
		int ok = 1, rounds = 0;
		for (size_t i = 0; i < n && ok; ) {
			size_t k = n - i < chunk ? n - i : chunk;
			int f = af_feed(&r, reply + i, k, &s, on_head, on_data);
			if (f == -2) { rounds++; continue; }   /* the same piece again */
			if (f) ok = 0;
			i += k;
		}
		char what[80]; snprintf(what, sizeof what, "paused and given again, %zu-byte pieces", chunk);
		check(ok && rounds == 3 && s.heads == 1 && s.got_len == sizeof file && memcmp(s.got, file, sizeof file) == 0 && r.state == 4, what);
		af_free(&r);
	}

	if (failures) { fprintf(stderr, "attfetch_test: %d failed\n", failures); return 1; }
	printf("attfetch_test: ok\n");
	return 0;
}
