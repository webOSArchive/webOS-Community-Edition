/*
 * CE's own test of mailshim.c's glue, as an image carries it (no build switch on): the calls
 * libemail-common makes on libcurl and libmojoluna makes on LSMessageRespond, made here against
 * fakecurl.c with the shim in between. Lunacy's tests cover the headers' logic; this covers what
 * the shim does with it, and what it leaves alone.
 *
 *   glue_test <back-off file>     (the path the shim was built with, CE_BACKOFF_FILE)
 */
#define main calfilter_test_main      /* its palm_add (a Sync Palm sent) and zones, not its tests */
#include "calfilter_test.c"
#undef main
#include <stdbool.h>
#include "backoff.h"

int curl_easy_setopt(void *h, int option, ...);
int curl_multi_add_handle(void *multi, void *h);
void curl_easy_cleanup(void *h);
bool LSMessageRespond(void *m, const char *payload, void *e);
void *fake_get(int option);
extern int fake_added, fake_cleaned;
extern char fake_url[];
extern char *fake_responded;
extern const char *fake_responded_ptr;

enum { URL = 10002, POSTFIELDS = 10015, POSTFIELDSIZE = 60, HEADERFUNCTION = 20079, HEADERDATA = 10029,
	WRITEFUNCTION = 20011, WRITEDATA = 10001, HTTPHEADER = 10023, USERPWD = 10005 };
typedef size_t (*header_fn)(char *, size_t, size_t, void *);

static char seen[1024];
static size_t my_header(char *b, size_t s, size_t n, void *data)
{
	(void)data;
	if (strlen(seen) + s * n < sizeof seen) strncat(seen, b, s * n);
	return s * n;
}
static size_t my_write(char *b, size_t s, size_t n, void *data) { (void)b; (void)data; return s * n; }

static void reply(void *data, const char *const *lines)
{
	header_fn f = (header_fn)fake_get(HEADERFUNCTION);
	for (; *lines; lines++) { char l[256]; snprintf(l, sizeof l, "%s", *lines); f(l, 1, strlen(l), data); }
}

/* A request as libemail-common's CurlConnection makes one: the body before the URL. */
static void request(void *h, const char *url, const void *body, long size)
{
	static int header_data;
	curl_easy_setopt(h, HEADERFUNCTION, (void *)my_header);
	curl_easy_setopt(h, HEADERDATA, &header_data);
	curl_easy_setopt(h, WRITEFUNCTION, (void *)my_write);
	curl_easy_setopt(h, WRITEDATA, &header_data);
	curl_easy_setopt(h, POSTFIELDSIZE, size);
	curl_easy_setopt(h, POSTFIELDS, body);
	curl_easy_setopt(h, URL, url);
	curl_multi_add_handle(NULL, h);
}

int main(int argc, char **argv)
{
	if (argc < 2) { fprintf(stderr, "usage: glue_test <back-off file>\n"); return 2; }
	const char *store = argv[1];
	remove(store);
	int handle_a, handle_b;
	void *h = &handle_a, *h2 = &handle_b;
	const char *sync = "https://eas.test/Microsoft-Server-ActiveSync?Cmd=Sync&User=u&DeviceId=d&DeviceType=Palm";
	const char *ping = "https://eas.test/Microsoft-Server-ActiveSync?Cmd=Ping&User=u&DeviceId=d&DeviceType=Palm";

	/* 1. Time zones: a Sync with Palm's zone goes out with only the zone's 232 characters changed. */
	static const char tz_start[] = { 0x00, 0x04, 0x45, 0x03 };
	size_t n = sizeof palm_add, z = 0;
	for (size_t i = 0; i + 4 < n && !z; i++) if (memcmp(palm_add + i, tz_start, 4) == 0) z = i + 4;
	request(h, sync, palm_add, (long)n);
	const unsigned char *sent = fake_get(POSTFIELDS);
	check(z && sent && sent != palm_add, "a Sync with Palm's zone: another body is sent");
	check(sent && (long)fake_get(POSTFIELDSIZE) == (long)n, "its size is the same");
	check(sent && memcmp(sent, palm_add, z) == 0 && memcmp(sent + z + 232, palm_add + z + 232, n - z - 232) == 0, "every byte outside the zone is Palm's");
	unsigned char tz[172];
	check(sent && memcmp(sent + z, palm_add + z, 232) != 0 && calf_tz_decode(sent + z, 232, tz) == 0
		&& calf_u16(tz + 68 + 8) == 2 && calf_u16(tz + 152 + 8) == 2, "the zone is in Windows' form");
	check(strcmp(fake_url, sync) == 0, "the URL is the service's");
	check(fake_get(HEADERFUNCTION) != (void *)my_header, "the header callback is the shim's");
	check(fake_get(WRITEFUNCTION) == (void *)my_write, "the body callback is the service's own (no 16.1 filter in this build)");

	/* What is left alone: the same body in a Ping, a Sync already in Windows' form, a body that isn't WBXML. */
	request(h, ping, palm_add, (long)n);
	check(fake_get(POSTFIELDS) == (void *)palm_add, "the same bytes in another command: untouched");
	unsigned char *fixed = malloc(n);
	memcpy(fixed, sent ? sent : palm_add, n);
	request(h, sync, fixed, (long)n);
	check(fake_get(POSTFIELDS) == (void *)fixed, "a zone already in Windows' form: untouched");
	request(h, sync, "<xml/>", 6);
	check(fake_get(POSTFIELDS) != NULL && memcmp(fake_get(POSTFIELDS), "<xml/>", 6) == 0, "not WBXML: untouched");

	/* Options the shim has no business with pass as they came. */
	int list;
	curl_easy_setopt(h, HTTPHEADER, &list);
	curl_easy_setopt(h, USERPWD, "user:oauth2:abcdef");
	check(fake_get(HTTPHEADER) == (void *)&list, "the header list is the service's (no version or bearer in this build)");
	check(fake_get(USERPWD) && strcmp(fake_get(USERPWD), "user:oauth2:abcdef") == 0, "the password passes as it came (no OAuth in this build)");

	/* 2. Back-off: an ordinary reply holds nothing; a 503 with Retry-After holds the host. */
	const char *ok[] = { "HTTP/1.1 200 OK\r\n", "Content-Type: application/vnd.ms-sync.wbxml\r\n", "\r\n", NULL };
	const char *busy[] = { "HTTP/1.1 503 Service Unavailable\r\n", "Retry-After: 120\r\n", "X-MS-ASThrottle: RecentCommands\r\n", "\r\n", NULL };
	static int header_data_probe;
	(void)header_data_probe;
	void *hd = fake_get(HEADERDATA);
	seen[0] = 0;
	reply(hd, ok);
	check(strstr(seen, "HTTP/1.1 200 OK\r\nContent-Type: application/vnd.ms-sync.wbxml\r\n\r\n") != NULL, "the service sees every header line");
	check(bo_until(store, "eas.test") == 0, "an ordinary reply: no back-off kept");
	request(h, sync, "<xml/>", 6);
	check(strcmp(fake_url, sync) == 0, "and the next request goes to the server");

	seen[0] = 0;
	reply(hd, busy);
	long now = (long)time(NULL), until = bo_until(store, "eas.test");
	check(strstr(seen, "Retry-After: 120\r\n") != NULL, "a 503's headers reach the service too");
	check(until >= now + 118 && until <= now + 122, "a 503 with Retry-After 120: the host is kept for 120 s");
	request(h, sync, "<xml/>", 6);
	check(strcmp(fake_url, "http://127.0.0.1:1/") == 0, "the next request to it goes nowhere");
	request(h2, ping, "<xml/>", 6);
	check(strcmp(fake_url, "http://127.0.0.1:1/") == 0, "on another handle too");
	request(h2, "https://other.test/Microsoft-Server-ActiveSync?Cmd=Sync", "<xml/>", 6);
	check(strstr(fake_url, "other.test") != NULL, "another server is not held");

	/* The back-off over: the held request, started again, has its own URL back. */
	request(h, sync, "<xml/>", 6);
	check(strcmp(fake_url, "http://127.0.0.1:1/") == 0, "(held again)");
	check(bo_set(store, "eas.test", now - 1, now - 10) == 0, "(the store rewritten as past)");
	curl_multi_add_handle(NULL, h);
	check(strcmp(fake_url, sync) == 0, "once the time has passed, the same request goes to the server");

	/* 3. The validator's answer to a throttled server. */
	const char *bad = "{\"returnValue\":false,\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 503\",\"mailErrorCode\":1000}";
	const char *wrong = "{\"returnValue\":false,\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 401\",\"mailErrorCode\":1000}";
	LSMessageRespond(NULL, bad, NULL);
	check(fake_responded && strstr(fake_responded, "\"errorCode\":\"503_SERVICE_UNAVAILABLE\"") && strstr(fake_responded, "\"mailErrorCode\":1110")
		&& !strstr(fake_responded, "401_UNAUTHORIZED"), "a throttled sign-in is answered as unavailable");
	LSMessageRespond(NULL, wrong, NULL);
	check(fake_responded_ptr == wrong, "a wrong password's answer passes as it was");
	LSMessageRespond(NULL, "{\"returnValue\":true}", NULL);
	check(fake_responded && strcmp(fake_responded, "{\"returnValue\":true}") == 0, "and so does any other reply");

	/* 4. A handle's end reaches curl, and its slot is free for the next one at that address. */
	curl_easy_cleanup(h);
	curl_easy_cleanup(h2);
	check(fake_cleaned == 2, "cleanup reaches curl");
	request(h, ping, palm_add, (long)n);
	check(fake_get(POSTFIELDS) == (void *)palm_add && strcmp(fake_url, ping) == 0, "a new handle at the old address starts clean");

	free(fixed);
	remove(store);
	if (failures) { printf("glue_test: %d failed\n", failures); return 1; }
	printf("glue_test: ok\n");
	return 0;
}
