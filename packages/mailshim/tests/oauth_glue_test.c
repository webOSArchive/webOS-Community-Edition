/*
 * CE's test of the OAuth part of mailshim.c's curl glue (CE_MAILSHIM_OAUTH): an Exchange
 * account whose password is a handle goes out with a bearer token from the token service,
 * here tests/fake-luna-send.sh. Run with CE_FAKE_DIR set to a scratch folder.
 */
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int curl_easy_setopt(void *h, int option, ...);
int curl_easy_getinfo(void *h, int info, ...);
int curl_multi_add_handle(void *multi, void *h);
void *fake_get(int option);
extern char fake_url[];
extern long fake_response;
struct curl_slist { char *data; struct curl_slist *next; };
struct curl_slist *curl_slist_append(struct curl_slist *, const char *);

enum { URL = 10002, HTTPHEADER = 10023, USERPWD = 10005, RESPONSE_CODE = 0x200002 };
#define HANDLE "oauth2:0123456789abcdef0123456789abcdef"

static int failures;
static void check(int ok, const char *what) { if (!ok) { printf("FAIL: %s\n", what); failures++; } }
static char dir[512];

static void reply(const char *json)
{
	char p[600]; snprintf(p, sizeof p, "%s/reply", dir);
	FILE *f = fopen(p, "w"); fputs(json, f); fclose(f);
}
static int calls(const char *with)
{
	char p[600], line[512]; int n = 0;
	snprintf(p, sizeof p, "%s/calls", dir);
	FILE *f = fopen(p, "r");
	if (!f) return 0;
	while (fgets(line, sizeof line, f)) if (!with || strstr(line, with)) n++;
	fclose(f);
	return n;
}
static const char *header(const char *name)
{
	for (struct curl_slist *s = fake_get(HTTPHEADER); s; s = s->next) if (strncmp(s->data, name, strlen(name)) == 0) return s->data;
	return NULL;
}
static long code(void *h) { long c = 0; curl_easy_getinfo(h, RESPONSE_CODE, &c); return c; }

int main(void)
{
	const char *d = getenv("CE_FAKE_DIR");
	if (!d) { fprintf(stderr, "CE_FAKE_DIR not set\n"); return 2; }
	snprintf(dir, sizeof dir, "%s", d);
	char p[600]; snprintf(p, sizeof p, "%s/calls", dir); remove(p);
	int a, b, c, e;
	void *h = &a;
	struct curl_slist *theirs = curl_slist_append(NULL, "MS-ASProtocolVersion: 12.1");
	const char *url = "https://outlook.test/Microsoft-Server-ActiveSync?Cmd=FolderSync";

	/* A plain password is nobody's business. */
	curl_easy_setopt(h, HTTPHEADER, theirs);
	curl_easy_setopt(h, USERPWD, "user@x.test:secret");
	check(calls(NULL) == 0 && fake_get(USERPWD) && strcmp(fake_get(USERPWD), "user@x.test:secret") == 0 && !header("Authorization:"), "a plain password passes, and nothing is asked");
	curl_easy_setopt(h, USERPWD, "user@x.test:oauth2:\"},{\"x\":\"");
	check(calls(NULL) == 0, "a password that only looks like a handle is not put in a request");

	/* A handle: the token as a bearer, no Basic password; kept for the next request. */
	reply("{\"returnValue\":true,\"accessToken\":\"tok-1\",\"fresh\":false,\"expiresIn\":3600}");
	curl_easy_setopt(h, USERPWD, "user@x.test:" HANDLE);
	check(calls(NULL) == 1 && calls(HANDLE) == 1 && calls("stale") == 0, "a handle: the token service is asked once, for that handle");
	check(fake_get(USERPWD) == NULL, "no Basic password goes with it");
	check(header("Authorization:") && strcmp(header("Authorization:"), "Authorization: Bearer tok-1") == 0 && header("MS-ASProtocolVersion:"), "the token goes as a bearer, beside the service's own headers");
	curl_easy_setopt(h, USERPWD, "user@x.test:" HANDLE);
	check(calls(NULL) == 1 && header("Authorization:"), "the next request uses the token kept");

	/* The server refuses it: a server error the first time, and the next login asks for a fresh one. */
	fake_response = 401;
	check(code(h) == 500, "a 401 to a token that should have worked is told as a server error");
	fake_response = 0;
	reply("{\"returnValue\":true,\"accessToken\":\"tok-2\",\"fresh\":true,\"expiresIn\":3600}");
	curl_easy_setopt(h, USERPWD, "user@x.test:" HANDLE);
	check(calls(NULL) == 2 && calls("\"stale\":true") == 1, "the next login says the token was refused");
	check(header("Authorization:") && strcmp(header("Authorization:"), "Authorization: Bearer tok-2") == 0, "and sends the new one");
	fake_response = 401;
	check(code(h) == 401, "a 401 to a fresh token is the server's last word");
	fake_response = 0;

	/* A handle the service doesn't know is an ordinary password after all. */
	h = &b;
	reply("{\"errorText\":\"Unknown handle\",\"errorCode\":-11,\"returnValue\":false}");
	curl_easy_setopt(h, HTTPHEADER, theirs);
	curl_easy_setopt(h, USERPWD, "user@x.test:oauth2:ffffffffffffffffffffffffffffffff");
	check(fake_get(USERPWD) && strstr(fake_get(USERPWD), "oauth2:ffff") && fake_get(HTTPHEADER) == (void *)theirs, "an unknown handle: the password passes as it came");

	/* No token just now: the request goes nowhere, to be tried again. */
	h = &c;
	reply("{\"errorText\":\"Couldn't refresh the sign-in just now\",\"errorCode\":-12,\"returnValue\":false}");
	curl_easy_setopt(h, HTTPHEADER, theirs);
	curl_easy_setopt(h, URL, url);
	curl_easy_setopt(h, USERPWD, "user@x.test:oauth2:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
	curl_multi_add_handle(NULL, h);
	check(fake_get(USERPWD) == NULL && strcmp(fake_url, "http://127.0.0.1:1/") == 0 && !header("Authorization: Bearer t"), "no token just now: no password, no token, and the request stays on the device");

	/* The sign-in is over (an empty token): sent as it is, and the server's 401 stands. */
	h = &e;
	reply("{\"returnValue\":true,\"accessToken\":\"\",\"fresh\":false,\"expiresIn\":0}");
	curl_easy_setopt(h, HTTPHEADER, theirs);
	curl_easy_setopt(h, URL, url);
	curl_easy_setopt(h, USERPWD, "user@x.test:oauth2:dddddddddddddddddddddddddddddddd");
	fake_response = 401;
	check(strcmp(fake_url, url) == 0 && code(h) == 401, "a sign-in that is over: the request goes, and its 401 reaches the service (Email asks to sign in again)");

	if (failures) { printf("oauth_glue_test: %d failed\n", failures); return 1; }
	printf("oauth_glue_test: ok\n");
	return 0;
}
