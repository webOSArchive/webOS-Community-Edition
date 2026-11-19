/*
 * CE's test of calfilter.h's [CE] part: Palm's zone as a TouchPad writes it, each change's
 * instant broken down on the device's own clock (calf_palm_offset), for devices set to several
 * zones. Lunacy's calfilter_test.c covers a device in UTC, and must run with TZ=UTC.
 */
#include <stdio.h>
#include "calfilter.h"

static int failures;
static void check(int ok, const char *device, const char *what) { if (!ok) { printf("FAIL: device in %s: %s\n", device, what); failures++; } }

/* A zone as Palm writes it on this process's clock: no names, each change this year's nth weekday there. */
static void palm_zone(long bias, long dbias, time_t to_std, time_t to_dst, unsigned char *b64)
{
	unsigned char tz[172];
	memset(tz, 0, sizeof tz);
	tz[0] = (unsigned char)bias; tz[1] = (unsigned char)(bias >> 8); tz[2] = (unsigned char)(bias >> 16); tz[3] = (unsigned char)(bias >> 24);
	tz[168] = (unsigned char)dbias; tz[169] = (unsigned char)(dbias >> 8); tz[170] = (unsigned char)(dbias >> 16); tz[171] = (unsigned char)(dbias >> 24);
	time_t when[2] = { to_std, to_dst };
	for (int k = 0; k < 2; k++) {
		struct tm tm; localtime_r(&when[k], &tm);
		unsigned char *st = tz + (k ? 152 : 68);
		calf_put16(st + 2, tm.tm_mon + 1); calf_put16(st + 4, tm.tm_wday); calf_put16(st + 6, (tm.tm_mday + 6) / 7);
		calf_put16(st + 8, tm.tm_hour); calf_put16(st + 10, tm.tm_min);
	}
	calf_tz_encode(tz, b64);
}

static int is(const unsigned char *b64, const int *std, const int *dst)
{
	unsigned char tz[172];
	if (calf_tz_decode(b64, 232, tz)) return 0;
	const int *w[2] = { std, dst };
	for (int k = 0; k < 2; k++) {
		const unsigned char *st = tz + (k ? 152 : 68);
		if (calf_u16(st) || calf_u16(st + 2) != w[k][0] || calf_u16(st + 4) != w[k][1] || calf_u16(st + 6) != w[k][2] || calf_u16(st + 8) != w[k][3] || calf_u16(st + 10)) return 0;
	}
	return 1;
}

int main(void)
{
	/* 2026's changes, as instants. */
	static const struct { const char *name; long bias, dbias; time_t to_std, to_dst; int std[4], dst[4]; } zones[] = {
		{ "Los Angeles", 480, -60, 1793523600 /* 1 Nov 09:00Z */, 1772964000 /* 8 Mar 10:00Z */, { 11, 0, 1, 2 }, { 3, 0, 2, 2 } },
		{ "London", 0, -60, 1792890000 /* 25 Oct 01:00Z */, 1774746000 /* 29 Mar 01:00Z */, { 10, 0, 5, 2 }, { 3, 0, 5, 1 } },
		{ "Berlin", -60, -60, 1792890000, 1774746000, { 10, 0, 5, 3 }, { 3, 0, 5, 2 } },
		{ "Sydney", -600, -60, 1775318400 /* 4 Apr 16:00Z */, 1791043200 /* 3 Oct 16:00Z */, { 4, 0, 1, 3 }, { 10, 0, 1, 2 } },
	};
	static const char *const devices[] = { "UTC", "America/Detroit", "America/Los_Angeles", "Europe/London", "Europe/Berlin",
		"Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "Pacific/Honolulu" };
	/* Zones already in Windows' form, unnamed (as Z-Push sends them): never taken for Palm's. */
	static const char *const win[] = {
		"4AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAABAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACAAIAAAAAAAAAxP///w==",
		"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAFAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAFAAEAAAAAAAAAxP///w==",
	};
	for (size_t d = 0; d < sizeof devices / sizeof devices[0]; d++) {
		setenv("TZ", devices[d], 1); tzset();
		for (size_t z = 0; z < sizeof zones / sizeof zones[0]; z++) {
			unsigned char b[233]; char what[96];
			palm_zone(zones[z].bias, zones[z].dbias, zones[z].to_std, zones[z].to_dst, b); b[232] = 0;
			int changed = calf_fix_tz(b, 232, 2026);
			snprintf(what, sizeof what, "Palm's %s in Windows' form", zones[z].name);
			check(is(b, zones[z].std, zones[z].dst), devices[d], what);
			if (changed) {   /* (a device in the zone itself may write Windows' form already) */
				snprintf(what, sizeof what, "%s, once fixed, is left alone", zones[z].name);
				check(calf_fix_tz(b, 232, 2026) == 0, devices[d], what);
			}
		}
		for (int k = 0; k < 2; k++) {
			unsigned char b[233]; memcpy(b, win[k], 233);
			check(calf_fix_tz(b, 232, 2026) == 0 && memcmp(b, win[k], 232) == 0, devices[d], k ? "London in Windows' form is left alone" : "Los Angeles in Windows' form is left alone");
		}
	}
	/* What the TouchPad sent (Detroit, 2026-11-19, a London event). */
	setenv("TZ", "America/Detroit", 1); tzset();
	unsigned char b[233];
	memcpy(b, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoABgAEABUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMABgAEABUAAAAAAAAAxP///w==", 233);
	check(calf_fix_tz(b, 232, 2026) == 1 && is(b, zones[1].std, zones[1].dst), "America/Detroit", "the TouchPad's own London zone, as captured");
	if (failures) { printf("devicezone_test: %d failed\n", failures); return 1; }
	printf("devicezone_test: ok\n");
	return 0;
}
