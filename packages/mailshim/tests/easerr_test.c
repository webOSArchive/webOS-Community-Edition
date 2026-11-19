/*
 * The Exchange validator's throttle answer (libpreload/easerr.h), on the build machine.
 *   cc -O2 -Wall -I../libpreload easerr_test.c -o easerr_test && ./easerr_test
 */
#include <stdio.h>
#include "easerr.h"

static int failures;
static void check(int ok, const char *what) { if (!ok) { printf("FAIL: %s\n", what); failures++; } }

int main(void)
{
	/* As mojomail-eas answered a 503 (measured 2026-11-08). */
	char *r = ee_reply("{\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 503\",\"mailErrorCode\":1000,\"returnValue\":false}");
	check(r && strcmp(r, "{\"errorCode\":\"503_SERVICE_UNAVAILABLE\",\"errorText\":\"http error: 503\",\"mailErrorCode\":1110,\"returnValue\":false}") == 0, "a 503: server unavailable, try again later");
	free(r);
	r = ee_reply("{\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 429\",\"mailErrorCode\":1000,\"returnValue\":false}");
	check(r && strstr(r, "503_SERVICE_UNAVAILABLE") && strstr(r, "\"mailErrorCode\":1110,"), "a 429 the same");
	free(r);
	check(ee_reply("{\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 401\",\"mailErrorCode\":1000,\"returnValue\":false}") == NULL, "a real 401 stays a bad login");
	check(ee_reply("{\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 500\",\"mailErrorCode\":1000,\"returnValue\":false}") == NULL, "a 500 is left as Palm says it");
	check(ee_reply("{\"errorCode\":\"CONNECTION_FAILED\",\"errorText\":\"http connection error: 7\",\"mailErrorCode\":3099,\"returnValue\":false}") == NULL, "a connection failure is left alone");
	check(ee_reply("{\"returnValue\":true}") == NULL && ee_reply(NULL) == NULL, "success, and nothing, are left alone");
	r = ee_reply("{\"errorCode\":\"401_UNAUTHORIZED\",\"errorText\":\"http error: 503\",\"returnValue\":false}");
	check(r && strcmp(r, "{\"errorCode\":\"503_SERVICE_UNAVAILABLE\",\"errorText\":\"http error: 503\",\"returnValue\":false}") == 0, "without a mailErrorCode: the code alone");
	free(r);
	if (failures) { printf("easerr: %d failed\n", failures); return 1; }
	printf("easerr: all passed\n");
	return 0;
}
