/*
 * Palm's Exchange validator's answer to a server that asks to be left alone, as webOS's own
 * screens word such an answer (Docs/outlook-eas.md, "Sign-in messages").
 *
 * mojomail-eas's validateAccount turns almost every HTTP error into a bad login: measured on the
 * Fold3 (2026-11-08) against a stand-in server, 400, 403, 429, 451, 500, 503 and 507 all came
 * back {"errorCode":"401_UNAUTHORIZED","errorText":"http error: <status>","mailErrorCode":1000}
 * (only 404 differed). A 503 or 429 is a server asking to be left alone for a while - Exchange
 * Online throttling a device - never a wrong password, yet every screen said to check the
 * login. webOS has the words for it: Accounts' library maps "503_SERVICE_UNAVAILABLE" to
 * "Server unavailable", and Email's mailErrorCode 1110 (ACCOUNT_UNAVAILABLE) is "The account is
 * temporarily unavailable. Please try again in a few minutes." So a reply that says
 * 401_UNAUTHORIZED for "http error: 503" or "http error: 429" says those instead; any other
 * reply passes as it was. Pure logic, tested on the build machine (tests/easerr_test.c).
 */
#ifndef LUNACY_EASERR_H
#define LUNACY_EASERR_H

#include <stdlib.h>
#include <string.h>

/* A new payload (free it) for a validator reply to rewrite, or NULL to send it as it was. */
static char *ee_reply(const char *p)
{
	static const char code[] = "\"errorCode\":\"401_UNAUTHORIZED\"", mail[] = "\"mailErrorCode\":";
	if (!p || !strstr(p, code)) return NULL;
	if (!strstr(p, "\"errorText\":\"http error: 503\"") && !strstr(p, "\"errorText\":\"http error: 429\"")) return NULL;
	const char *c = strstr(p, code), *m = strstr(p, mail);
	size_t n = strlen(p);
	char *out = malloc(n + 32);
	if (!out) return NULL;
	size_t o = 0;
	/* Up to the error code, the new code, then on to the mailErrorCode's number. */
	memcpy(out, p, (size_t)(c - p)); o = (size_t)(c - p);
	o += (size_t)sprintf(out + o, "\"errorCode\":\"503_SERVICE_UNAVAILABLE\"");
	const char *rest = c + sizeof code - 1;
	if (m && m > c) {
		memcpy(out + o, rest, (size_t)(m - rest)); o += (size_t)(m - rest);
		o += (size_t)sprintf(out + o, "%s1110", mail);
		rest = m + sizeof mail - 1;
		while (*rest == '-' || (*rest >= '0' && *rest <= '9')) rest++;
	}
	strcpy(out + o, rest);
	return out;
}

#endif
