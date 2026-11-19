/*
 * Calendar items in a Sync request, made acceptable to an Exchange ActiveSync 16.x server
 * (Docs/outlook-eas.md).
 *
 * Palm's mojomail-eas writes a calendar item as EAS 12.1 had it. From 16.0 a server sets some
 * of its fields itself and refuses an item that carries them: Exchange Online answers such an
 * Add with status 6 (the item couldn't be converted), and nothing is stored (measured on the
 * Fold3, 2026-11-08: Palm's Add with UID, DtStamp and MeetingStatus refused). Where the version
 * adapter sends a request at 16.x, the request's calendar elements are rewritten:
 *
 * - DtStamp goes: the server stamps the item.
 * - UID becomes ClientUid (16.1) in an Add: the server makes the UID, and is told the
 *   client's. In a Change it goes: the item is the server's by then, named by its ServerId.
 * - OrganizerName and OrganizerEmail go: the organizer is the account.
 * - MeetingStatus goes: the server decides it from the attendees.
 * - Location, a string in 12.1, becomes AirSyncBase's Location with the string as its
 *   DisplayName (16.0 moved it there; the old element is refused).
 * - A Body's EstimatedDataSize goes: it is the server's to say, and a client's is refused.
 * - A Recurrence that doesn't say its first day of the week gets FirstDayOfWeek 0 (Sunday).
 * - An Exception's ExceptionStartTime becomes AirSyncBase's InstanceId, the same compact
 *   date (16.0 names the occurrence that way).
 *
 * - The TimeZone's two changes, as Palm writes them, are this year's instants broken down in
 *   UTC: Los Angeles changes "at 09:00 and 10:00", London "on the 4th Sunday of October" (the
 *   last Sunday in 2026). Windows' form (TIME_ZONE_INFORMATION) wants the local wall-clock time
 *   and the nth weekday, 5 for the last; Exchange keeps the zone as Palm sent it ("Customized
 *   Time Zone"), so a series would move an hour early in the wrong week. Each change is put
 *   back on this year's calendar and written as Windows writes it (calf_fix_tz). Only a zone
 *   with no names is Palm's own; one Exchange made, which Palm keeps and sends back, is left.
 *
 * Then calf_split: from 16.0 a client MUST NOT send Exceptions in a Sync request (MS-ASCAL,
 * Exceptions); an occurrence is changed by a Change of its own, naming the series by ServerId
 * and the occurrence by InstanceId, or deleted by such a Delete (MS-ASCMD, Change and Delete).
 * Palm's Change of a series carries its Exceptions (refused with status 6, measured on
 * Exchange Online 2026-11-08, whatever names the occurrence), so each Exception becomes such a
 * Change or Delete after the series' own, and the series' Change goes without them. At 16.x a
 * property a Change leaves out stays as it was (MS-ASCMD, Change), so an occurrence's Change
 * carries only what Palm wrote for it. An Add can't name its occurrences yet (it has no
 * ServerId): its Exceptions go, and the next Change of the series sends them.
 *
 * Every other byte stays as it was. Requests are whole in memory (CURLOPT_POSTFIELDS), so this
 * rewrites a buffer rather than a stream. Measured against Exchange Online on 2026-11-08: Palm's
 * Add refused with status 6; with UID, DtStamp and MeetingStatus rewritten, an event without a
 * location stored; one with a location still refused until Location moved. Pure logic, tested on the build machine
 * (tests/calfilter_test.c).
 */
#ifndef LUNACY_CALFILTER_H
#define LUNACY_CALFILTER_H

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define CALF_PAGE 4                 /* the Calendar code page */
#define CALF_TIME_ZONE 0x05
#define CALF_UID 0x28
#define CALF_CLIENT_UID 0x3c
#define CALF_DTSTAMP 0x11
#define CALF_ORGANIZER_EMAIL 0x19
#define CALF_ORGANIZER_NAME 0x1a
#define CALF_MEETING_STATUS 0x18
#define CALF_LOCATION 0x17
#define CALF_BASE_PAGE 17           /* AirSyncBase */
#define CALF_BASE_LOCATION 0x20
#define CALF_BASE_DISPLAY_NAME 0x10
#define CALF_BASE_ESTIMATED_SIZE 0x0c
#define CALF_RECURRENCE 0x1b
#define CALF_FIRST_DAY_OF_WEEK 0x39
#define CALF_EXCEPTION_START 0x16       /* ExceptionStartTime (to 14.1) */
#define CALF_BASE_INSTANCE_ID 0x2d      /* AirSyncBase InstanceId (16.0): an exception's occurrence */
#define CALF_MAX_DEPTH 32
#define CALF_AIRSYNC_CHANGE 0x08    /* AirSync (page 0) Change: a UID in it goes rather than become ClientUid */
/* The room out needs: a 12.1 Location (5 bytes at least) grows by 8, and a Recurrence (at
   least 2 bytes with its END) by 7, so four times the input does. */
#define CALF_OUT_CAP(n) (4 * (n) + 16)

static int calf_mb(const unsigned char *in, size_t n, size_t *i, unsigned long *v)
{
	*v = 0;
	for (int k = 0; k < 5; k++) {
		if (*i >= n) return -1;
		unsigned char c = in[(*i)++];
		*v = (*v << 7) | (c & 0x7f);
		if (!(c & 0x80)) return 0;
	}
	return -1;
}

/* ---- the TimeZone (base64 of Windows' TIME_ZONE_INFORMATION, 172 bytes) ---- */

static const char calf_b64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static int calf_b64v(unsigned char c)
{
	const char *p = c ? strchr(calf_b64, c) : NULL;
	return p ? (int)(p - calf_b64) : -1;
}

/* Base64 of exactly 172 bytes (232 characters) into tz; 0 on success. */
static int calf_tz_decode(const unsigned char *s, size_t len, unsigned char *tz)
{
	if (len != 232 || s[230] != '=' || s[231] != '=') return -1;
	size_t o = 0;
	for (size_t i = 0; i < 232; i += 4) {
		int a = calf_b64v(s[i]), b = calf_b64v(s[i + 1]);
		int c = s[i + 2] == '=' ? 0 : calf_b64v(s[i + 2]), d = s[i + 3] == '=' ? 0 : calf_b64v(s[i + 3]);
		if (a < 0 || b < 0 || c < 0 || d < 0) return -1;
		unsigned long v = ((unsigned long)a << 18) | ((unsigned long)b << 12) | ((unsigned long)c << 6) | (unsigned long)d;
		if (o < 172) tz[o++] = (unsigned char)(v >> 16);
		if (o < 172) tz[o++] = (unsigned char)(v >> 8);
		if (o < 172) tz[o++] = (unsigned char)v;
	}
	return 0;
}

static void calf_tz_encode(const unsigned char *tz, unsigned char *s)
{
	size_t o = 0;
	for (size_t i = 0; i < 172; i += 3) {
		unsigned long v = (unsigned long)tz[i] << 16 | (i + 1 < 172 ? (unsigned long)tz[i + 1] << 8 : 0) | (i + 2 < 172 ? tz[i + 2] : 0);
		s[o++] = (unsigned char)calf_b64[(v >> 18) & 63]; s[o++] = (unsigned char)calf_b64[(v >> 12) & 63];
		s[o++] = i + 1 < 172 ? (unsigned char)calf_b64[(v >> 6) & 63] : '=';
		s[o++] = i + 2 < 172 ? (unsigned char)calf_b64[v & 63] : '=';
	}
}

static int calf_u16(const unsigned char *p) { return p[0] | p[1] << 8; }
static void calf_put16(unsigned char *p, int v) { p[0] = (unsigned char)v; p[1] = (unsigned char)(v >> 8); }
static long calf_s32(const unsigned char *p) { return (long)(int)((unsigned)p[0] | (unsigned)p[1] << 8 | (unsigned)p[2] << 16 | (unsigned)p[3] << 24); }

/* Days since the epoch of a civil date (proleptic Gregorian), and back. */
static long calf_days(long y, int m, int d)
{
	y -= m <= 2;
	long era = (y >= 0 ? y : y - 399) / 400, yoe = y - era * 400;
	long doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1, doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
	return era * 146097 + doe - 719468;
}

static void calf_civil(long z, long *y, int *m, int *d)
{
	z += 719468;
	long era = (z >= 0 ? z : z - 146096) / 146097, doe = z - era * 146097;
	long yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365, doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
	long mp = (5 * doy + 2) / 153;
	*d = (int)(doy - (153 * mp + 2) / 5 + 1); *m = (int)(mp < 10 ? mp + 3 : mp - 9); *y = yoe + era * 400 + (*m <= 2);
}

static int calf_month_days(long y, int m) { return (int)(calf_days(m == 12 ? y + 1 : y, m == 12 ? 1 : m + 1, 1) - calf_days(y, m, 1)); }

static int calf_dow(long z) { return (int)(((z % 7) + 7 + 4) % 7); }   /* 1970-01-01 was a Thursday */

/*
 * One change (a SYSTEMTIME at st) as Palm wrote it, year's nth weekday at a UTC time, rewritten
 * as Windows writes it: the local wall-clock time, local_minus_utc minutes ahead of UTC, and the
 * nth weekday of its month, 5 for the last. 1 when it changed.
 */
static int calf_fix_change(unsigned char *st, long year, long local_minus_utc)
{
	int month = calf_u16(st + 2), dow = calf_u16(st + 4), week = calf_u16(st + 6), h = calf_u16(st + 8), mi = calf_u16(st + 10);
	if (calf_u16(st) != 0 || month < 1 || month > 12 || dow > 6 || week < 1 || week > 5 || h > 23 || mi > 59) return 0;
	long first = calf_days(year, month, 1);
	int day = 1 + (dow - calf_dow(first) + 7) % 7 + 7 * (week - 1);
	if (day > calf_month_days(year, month)) return 0;                 /* no such day this year: not Palm's */
	long minutes = (calf_days(year, month, day) * 1440L) + h * 60 + mi + local_minus_utc;
	long z = minutes >= 0 ? minutes / 1440 : -((-minutes + 1439) / 1440);
	long rest = minutes - z * 1440, ly; int lm, ld;
	calf_civil(z, &ly, &lm, &ld);
	int lweek = ld + 7 > calf_month_days(ly, lm) ? 5 : (ld + 6) / 7;
	unsigned char was[16]; memcpy(was, st, 16);
	calf_put16(st + 2, lm); calf_put16(st + 4, calf_dow(z)); calf_put16(st + 6, lweek);
	calf_put16(st + 8, (int)(rest / 60)); calf_put16(st + 10, (int)(rest % 60));
	calf_put16(st + 12, 0); calf_put16(st + 14, 0);
	return memcmp(was, st, 16) != 0;
}

/*
 * Whether a change (SYSTEMTIME at st) can be Palm's: read as Palm writes it (year's nth weekday,
 * which must exist, at a UTC time), it falls between midnight and 4:00 local time, as every
 * zone's changes but three (Nuuk, Scoresbysund, Easter Island, near 22:00) do. Windows' form
 * read that way lands at hours no zone changes at (Los Angeles' "2:00" on Saturday at 18:00) or
 * names a 5th weekday the year doesn't have. Measured over every IANA zone with two changes,
 * 2026 to 2030: Palm's form recognised for 146 of 149; Windows' form never taken for Palm's,
 * but for Cairo's in 2027 (midnight changes, both months with a 5th Friday).
 */
static int calf_palm_change(const unsigned char *st, long year, long local_minus_utc)
{
	int month = calf_u16(st + 2), dow = calf_u16(st + 4), week = calf_u16(st + 6), h = calf_u16(st + 8), mi = calf_u16(st + 10);
	if (calf_u16(st) != 0 || month < 1 || month > 12 || dow > 6 || week < 1 || week > 5 || h > 23 || mi > 59) return 0;
	int day = 1 + (dow - calf_dow(calf_days(year, month, 1)) + 7) % 7 + 7 * (week - 1);
	if (day > calf_month_days(year, month)) return 0;
	long local = ((long)h * 60 + mi + local_minus_utc) % 1440;
	if (local < 0) local += 1440;
	return local <= 240;
}

/*
 * [CE] How far ahead of UTC, in minutes, the clock is that Palm broke a change's instant down
 * on. Lunacy measured Palm's form where the service's own zone is UTC; on a TouchPad the service
 * runs in the device's zone and breaks each instant down there. Measured on a TouchPad set to
 * Detroit (2026-11-19, webOS CE 600102): London's changes came out as "the 4th Saturday of
 * October and of March, at 21:00", which is 01:00 UTC on the Sunday read on a clock four hours
 * behind. So the change is read on this process's local clock (mktime), as Palm read it; 0 in
 * UTC, where everything is as Lunacy has it.
 *
 * Two hours of the year need care, and both come up for an event in the device's own zone:
 * - A time the device's clock shows twice (the hour after it goes back) is read as the second,
 *   the one after the change: a zone's change to standard time, read on a clock that changes at
 *   the same instant, is that. (A zone that changes within the hour before the device's own
 *   zone does, such as Halifax seen from New York, is then read an hour late.)
 * - A time the device's clock never shows (the hour it skips going forward) can't be Palm's:
 *   CALF_NOT_PALM. Windows' form of the device's own zone names exactly that hour.
 */
#define CALF_NOT_PALM (-100000L)
static long calf_palm_offset(const unsigned char *st, long year)
{
	int month = calf_u16(st + 2), dow = calf_u16(st + 4), week = calf_u16(st + 6), h = calf_u16(st + 8), mi = calf_u16(st + 10);
	if (calf_u16(st) != 0 || month < 1 || month > 12 || dow > 6 || week < 1 || week > 5 || h > 23 || mi > 59) return 0;
	int day = 1 + (dow - calf_dow(calf_days(year, month, 1)) + 7) % 7 + 7 * (week - 1);
	if (day > calf_month_days(year, month)) return 0;
	struct tm tm;
	memset(&tm, 0, sizeof tm);
	tm.tm_year = (int)(year - 1900); tm.tm_mon = month - 1; tm.tm_mday = day; tm.tm_hour = h; tm.tm_min = mi; tm.tm_isdst = -1;
	time_t t = mktime(&tm);
	if (t == (time_t)-1) return 0;
	struct tm back;
	if (!localtime_r(&t, &back) || back.tm_mday != day || back.tm_hour != h || back.tm_min != mi) return CALF_NOT_PALM;
	for (int k = 0; k < 2; k++) {
		time_t later = t + (k ? 1800 : 3600);
		if (localtime_r(&later, &back) && back.tm_mday == day && back.tm_hour == h && back.tm_min == mi) { t = later; break; }
	}
	return calf_days(year, month, day) * 1440L + h * 60 + mi - (long)(t / 60);
}

/* A TimeZone's base64 (232 characters at s) rewritten in place for year; 1 when it changed. */
static int calf_fix_tz(unsigned char *s, size_t len, long year)
{
	unsigned char tz[172], back[232];
	if (calf_tz_decode(s, len, tz)) return 0;
	long bias = calf_s32(tz), daylight_bias = calf_s32(tz + 168);
	if (calf_u16(tz + 152 + 2) == 0 || calf_u16(tz + 68 + 2) == 0) return 0;   /* no daylight saving */
	/* Only Palm's own: it names neither part. A zone Exchange made (named, "Pacific Standard
	   Time" or "Customized Time Zone") is in Windows' form already, and Palm sends it back. */
	for (int k = 4; k < 68; k++) if (tz[k]) return 0;
	for (int k = 88; k < 152; k++) if (tz[k]) return 0;
	/* And only what reads as Palm's form: a server's unnamed zone (Z-Push writes none) is
	   already in Windows' form, and Palm sends it back as it got it. */
	long off_standard = calf_palm_offset(tz + 68, year), off_daylight = calf_palm_offset(tz + 152, year);
	if (off_standard == CALF_NOT_PALM || off_daylight == CALF_NOT_PALM) return 0;
	long to_standard = -(bias + daylight_bias) - off_standard;              /* [CE] from Palm's clock, not from UTC */
	long to_daylight = -bias - off_daylight;
	if (!calf_palm_change(tz + 68, year, to_standard) || !calf_palm_change(tz + 152, year, to_daylight)) return 0;
	int changed = calf_fix_change(tz + 68, year, to_standard)               /* back to standard: read in daylight time */
		| calf_fix_change(tz + 152, year, to_daylight);                   /* into daylight: read in standard time */
	if (!changed) return 0;
	calf_tz_encode(tz, back);
	memcpy(s, back, 232);
	return 1;
}

static long calf_this_year(void)
{
	time_t t = time(NULL); struct tm tm;
	return gmtime_r(&t, &tm) ? tm.tm_year + 1900L : 2026;
}

static long calf_year;                  /* the year Palm's changes are in; 0: this one (tests set it) */

/*
 * For a server below 16.0 (the legacy Exchange account type): only the TimeZone strings of a
 * request, every other byte as it was (none of the 16.x rewrites, which an older server would
 * refuse). out has room for n bytes; 1 when a zone was rewritten (out is then the request to
 * send), 0 when nothing changed or the request isn't WBXML this reads.
 */
static int calf_fix_zones(const unsigned char *in, size_t n, unsigned char *out)
{
	size_t i = 1; unsigned long v;
	int page = 0, tz_open = 0, changed = 0;
	if (n < 4 || in[0] != 0x03) return 0;
	if (calf_mb(in, n, &i, &v) || calf_mb(in, n, &i, &v)) return 0;
	if (calf_mb(in, n, &i, &v) || v > n - i) return 0;
	i += v;
	memcpy(out, in, n);
	while (i < n) {
		unsigned char c = in[i++];
		if (c == 0x00) { if (i >= n) return 0; page = in[i++]; tz_open = 0; continue; }
		if (c == 0x01) { tz_open = 0; continue; }
		if (c == 0x03) {
			const unsigned char *z = memchr(in + i, 0, n - i);
			if (!z) return 0;
			size_t len = (size_t)(z - (in + i));
			if (tz_open && calf_fix_tz(out + i, len, calf_year ? calf_year : calf_this_year())) changed = 1;
			i += len + 1; tz_open = 0;
			continue;
		}
		if (c == 0xc3) {
			if (calf_mb(in, n, &i, &v) || v > n - i) return 0;
			i += v; tz_open = 0;
			continue;
		}
		if ((c & 0x3f) < 5 || (c & 0x80)) return 0;                      /* nothing EAS sends */
		tz_open = page == CALF_PAGE && (c & 0x3f) == CALF_TIME_ZONE && (c & 0x40);
	}
	return changed;
}

static int calf_dropped(int page, int tag)
{
	return (page == CALF_PAGE && (tag == CALF_DTSTAMP || tag == CALF_ORGANIZER_EMAIL || tag == CALF_ORGANIZER_NAME || tag == CALF_MEETING_STATUS))
		|| (page == CALF_BASE_PAGE && tag == CALF_BASE_ESTIMATED_SIZE);
}

/*
 * Rewrites a WBXML request of n bytes into out, which has room for CALF_OUT_CAP(n) bytes.
 * Returns the bytes written, 0 when the request has no calendar element to change (out is then
 * not to be used), or (size_t)-1 when it isn't WBXML this understands (send it as it was).
 */
static size_t calf_rewrite(const unsigned char *in, size_t n, unsigned char *out)
{
	size_t i = 0, o = 0;
	unsigned long v;
	int page = 0, out_page = 0, skip = 0, changed = 0, depth = 0, fdow = 0;
	unsigned char recurrence[CALF_MAX_DEPTH] = { 0 };   /* the element open at each depth is a Recurrence */
	int change_depth = 0;                               /* > 0: inside a Change, opened at that depth */
	int in_tz = 0;                                      /* the last tag written is an open TimeZone */
	if (n < 4 || in[0] != 0x03) return (size_t)-1;
	i = 1;
	if (calf_mb(in, n, &i, &v) || calf_mb(in, n, &i, &v)) return (size_t)-1;   /* public id, charset */
	size_t table_at = i;
	if (calf_mb(in, n, &i, &v) || v > n - i) return (size_t)-1;              /* string table */
	i += v;
	memcpy(out, in, i); o = i;
	(void)table_at;
	while (i < n) {
		unsigned char c = in[i++];
		switch (c) {
		case 0x00:                                         /* SWITCH_PAGE: written before the next kept tag */
			if (i >= n) return (size_t)-1;
			page = in[i++];
			continue;
		case 0x01:                                         /* END */
			if (skip) { skip--; continue; }
			if (depth > 0 && depth <= CALF_MAX_DEPTH && recurrence[depth - 1]) {
				/* The end of a Recurrence: the first day of the week, if it didn't say. */
				recurrence[depth - 1] = 0;
				if (!fdow) {
					if (out_page != CALF_PAGE) { out[o++] = 0x00; out[o++] = CALF_PAGE; out_page = CALF_PAGE; }
					out[o++] = 0x40 | CALF_FIRST_DAY_OF_WEEK; out[o++] = 0x03; out[o++] = '0'; out[o++] = 0x00; out[o++] = 0x01;
					changed = 1;
				}
			}
			if (depth > 0) depth--;
			in_tz = 0;
			if (change_depth && depth < change_depth) change_depth = 0;
			out[o++] = c; continue;
		case 0x03: {                                       /* STR_I */
			const unsigned char *z = memchr(in + i, 0, n - i);
			if (!z) return (size_t)-1;
			size_t len = (size_t)(z - (in + i)) + 1;
			if (!skip) {
				out[o++] = c; memcpy(out + o, in + i, len);
				if (in_tz && calf_fix_tz(out + o, len - 1, calf_year ? calf_year : calf_this_year())) changed = 1;
				o += len;
			}
			i += len;
			continue;
		}
		case 0xc3: {                                       /* OPAQUE */
			size_t at = i;
			if (calf_mb(in, n, &i, &v) || v > n - i) return (size_t)-1;
			if (!skip) { out[o++] = c; memcpy(out + o, in + at, i - at + v); o += i - at + v; }
			i += v;
			continue;
		}
		case 0x02: case 0x04: case 0x40: case 0x41: case 0x42: case 0x43: case 0x44:
		case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0xc0: case 0xc1: case 0xc2: case 0xc4:
			return (size_t)-1;                             /* nothing EAS sends */
		default: {
			int tag = c & 0x3f, content = (c & 0x40) != 0;
			if (skip) { if (content) skip++; continue; }
			if (calf_dropped(page, tag) || (change_depth && page == CALF_PAGE && tag == CALF_UID)) { changed = 1; if (content) skip = 1; continue; }
			if (page == CALF_PAGE && tag == CALF_LOCATION) {
				changed = 1;
				/* <Location>STR_I "..."</Location> becomes base:Location/base:DisplayName; anything
				   else (empty, or not a plain string) goes, as the server would refuse it. */
				const unsigned char *z = content && i < n && in[i] == 0x03 ? memchr(in + i + 1, 0, n - i - 1) : NULL;
				if (z && (size_t)(z - in) + 1 < n && z[1] == 0x01) {
					size_t len = (size_t)(z - (in + i + 1)) + 1;   /* the string and its NUL */
					out[o++] = 0x00; out[o++] = CALF_BASE_PAGE; out_page = CALF_BASE_PAGE;
					out[o++] = 0x40 | CALF_BASE_LOCATION; out[o++] = 0x40 | CALF_BASE_DISPLAY_NAME;
					out[o++] = 0x03; memcpy(out + o, in + i + 1, len); o += len;
					out[o++] = 0x01; out[o++] = 0x01;
					i += 1 + len + 1;                               /* STR_I, the string, END */
				} else if (content) skip = 1;
				continue;
			}
			if (page == CALF_PAGE && tag == CALF_EXCEPTION_START) {
				if (out_page != CALF_BASE_PAGE) { out[o++] = 0x00; out[o++] = CALF_BASE_PAGE; out_page = CALF_BASE_PAGE; }
				out[o++] = (unsigned char)((c & 0xc0) | CALF_BASE_INSTANCE_ID);
				changed = 1;
				if (content) {
					if (depth < CALF_MAX_DEPTH) recurrence[depth] = 0;
					depth++;
				}
				continue;
			}
			if (out_page != page) { out[o++] = 0x00; out[o++] = (unsigned char)page; out_page = page; }
			if (page == CALF_PAGE && tag == CALF_UID) { c = (unsigned char)((c & 0xc0) | CALF_CLIENT_UID); changed = 1; }
			if (page == CALF_PAGE && tag == CALF_FIRST_DAY_OF_WEEK) fdow = 1;
			if (content) {
				if (depth < CALF_MAX_DEPTH) recurrence[depth] = page == CALF_PAGE && tag == CALF_RECURRENCE;
				if (page == CALF_PAGE && tag == CALF_RECURRENCE) fdow = 0;
				depth++;
				if (page == 0 && tag == CALF_AIRSYNC_CHANGE) change_depth = depth;
			}
			in_tz = content && page == CALF_PAGE && tag == CALF_TIME_ZONE;
			out[o++] = c;
		}
		}
	}
	return changed ? o : 0;
}

/* ---- calf_split: Exceptions out of a Change, as Changes and Deletes of their own ---- */

#define CALF_AS_ADD 0x07
#define CALF_AS_DELETE 0x09
#define CALF_AS_SERVER_ID 0x0d
#define CALF_AS_APPLICATION_DATA 0x1d
#define CALF_EXCEPTIONS 0x14
#define CALF_EXCEPTION 0x13
#define CALF_DELETED 0x15

struct calf_node {
	int page, tag, content;            /* page -1: text (STR_I or OPAQUE), its token and bytes in [at, at + len) */
	size_t at, len;
	int child, next, last;             /* indexes, -1 for none */
	int cut;                           /* left out when written */
};

struct calf_buf { unsigned char *b; size_t n, cap; int page; int failed; };

static void calf_put(struct calf_buf *w, const unsigned char *p, size_t k)
{
	if (w->failed) return;
	if (w->n + k > w->cap) {
		size_t cap = (w->cap + k) * 2;
		unsigned char *nb = realloc(w->b, cap);
		if (!nb) { w->failed = 1; return; }
		w->b = nb; w->cap = cap;
	}
	memcpy(w->b + w->n, p, k); w->n += k;
}

static void calf_open(struct calf_buf *w, int page, int tag, int content)
{
	unsigned char t[3]; size_t k = 0;
	if (page != w->page) { t[k++] = 0x00; t[k++] = (unsigned char)page; w->page = page; }
	t[k++] = (unsigned char)(tag | (content ? 0x40 : 0));
	calf_put(w, t, k);
}

static void calf_end(struct calf_buf *w) { unsigned char e = 0x01; calf_put(w, &e, 1); }

/* Node i and what it holds; children marked cut are left out. */
static void calf_emit(struct calf_buf *w, const struct calf_node *t, const unsigned char *in, int i)
{
	if (t[i].page < 0) { calf_put(w, in + t[i].at, t[i].len); return; }
	calf_open(w, t[i].page, t[i].tag, t[i].content);
	if (!t[i].content) return;
	for (int c = t[i].child; c >= 0; c = t[c].next) if (!t[c].cut) calf_emit(w, t, in, c);
	calf_end(w);
}

static int calf_find(const struct calf_node *t, int parent, int page, int tag)
{
	for (int c = parent >= 0 ? t[parent].child : -1; c >= 0; c = t[c].next)
		if (t[c].page == page && t[c].tag == tag) return c;
	return -1;
}

/* The text a node holds, if it is one STR_I ("1" for Deleted). */
static int calf_text_is(const struct calf_node *t, const unsigned char *in, int i, const char *s)
{
	int c = i >= 0 ? t[i].child : -1;
	size_t k = strlen(s);
	return c >= 0 && t[c].page < 0 && t[c].len == k + 2 && in[t[c].at] == 0x03 && memcmp(in + t[c].at + 1, s, k) == 0;
}

/* After a Change (node ch) that carried them, its Exceptions (node ex) as their own commands. */
static void calf_emit_occurrences(struct calf_buf *w, const struct calf_node *t, const unsigned char *in, int ch, int ex)
{
	int sid = calf_find(t, ch, 0, CALF_AS_SERVER_ID);
	if (sid < 0) return;
	for (int e = t[ex].child; e >= 0; e = t[e].next) {
		if (t[e].page != CALF_PAGE || t[e].tag != CALF_EXCEPTION) continue;
		int iid = calf_find(t, e, CALF_BASE_PAGE, CALF_BASE_INSTANCE_ID);
		if (iid < 0) continue;                                   /* no occurrence named: nothing to send */
		int del = calf_find(t, e, CALF_PAGE, CALF_DELETED);
		if (calf_text_is(t, in, del, "1")) {
			calf_open(w, 0, CALF_AS_DELETE, 1);
			calf_emit(w, t, in, sid); calf_emit(w, t, in, iid);
			calf_end(w);
			continue;
		}
		calf_open(w, 0, CALF_AIRSYNC_CHANGE, 1);
		calf_emit(w, t, in, sid); calf_emit(w, t, in, iid);
		calf_open(w, 0, CALF_AS_APPLICATION_DATA, 1);
		for (int c = t[e].child; c >= 0; c = t[c].next)
			if (c != iid && c != del) calf_emit(w, t, in, c);
		calf_end(w);
		calf_end(w);
	}
}

static void calf_emit_tree(struct calf_buf *w, struct calf_node *t, const unsigned char *in, int i)
{
	if (t[i].page < 0 || !t[i].content) { calf_emit(w, t, in, i); return; }
	calf_open(w, t[i].page, t[i].tag, 1);
	for (int c = t[i].child; c >= 0; c = t[c].next) {
		if (t[c].cut) continue;
		calf_emit_tree(w, t, in, c);
		/* A Change of a series: its Exceptions follow it as commands of their own. */
		if (t[c].page == 0 && t[c].tag == CALF_AIRSYNC_CHANGE) {
			int ad = calf_find(t, c, 0, CALF_AS_APPLICATION_DATA);
			int ex = calf_find(t, ad, CALF_PAGE, CALF_EXCEPTIONS);
			if (ex >= 0) calf_emit_occurrences(w, t, in, c, ex);
		}
	}
	calf_end(w);
}

/*
 * Rewrites a request (after calf_rewrite) whose Change or Add of a calendar item carries
 * Exceptions. Returns a new buffer (free it) and its length in *len, or NULL when there is
 * nothing to change or the request isn't WBXML this reads.
 */
static unsigned char *calf_split(const unsigned char *in, size_t n, size_t *len)
{
	size_t i = 1, body; unsigned long v;
	if (n < 4 || in[0] != 0x03) return NULL;
	if (calf_mb(in, n, &i, &v) || calf_mb(in, n, &i, &v)) return NULL;
	if (calf_mb(in, n, &i, &v) || v > n - i) return NULL;
	body = i + v;
	struct calf_node *t = malloc((n + 1) * sizeof *t);
	if (!t) return NULL;
	int count = 0, stack[CALF_MAX_DEPTH], depth = 0, page = 0, root = -1, found = 0;
	for (i = body; i < n; ) {
		unsigned char c = in[i];
		int k;
		if (c == 0x00) { if (i + 1 >= n) goto bad; page = in[i + 1]; i += 2; continue; }
		if (c == 0x01) { if (!depth) goto bad; depth--; i++; continue; }
		k = count++;
		t[k].child = t[k].next = t[k].last = -1; t[k].cut = 0; t[k].at = i;
		if (c == 0x03) {
			const unsigned char *z = memchr(in + i + 1, 0, n - i - 1);
			if (!z) goto bad;
			t[k].page = -1; t[k].len = (size_t)(z - (in + i)) + 1; t[k].content = 0;
		} else if (c == 0xc3) {
			size_t j = i + 1;
			if (calf_mb(in, n, &j, &v) || v > n - j) goto bad;
			t[k].page = -1; t[k].len = j - i + v; t[k].content = 0;
		} else if ((c & 0x3f) < 5 || (c & 0x80)) {
			goto bad;                                            /* nothing EAS sends */
		} else {
			t[k].page = page; t[k].tag = c & 0x3f; t[k].content = (c & 0x40) != 0; t[k].len = 1;
		}
		if (depth) {
			int p = stack[depth - 1];
			if (t[p].last >= 0) t[t[p].last].next = k; else t[p].child = k;
			t[p].last = k;
		} else if (root < 0) root = k;
		else goto bad;
		i += t[k].len;
		if (t[k].page >= 0 && t[k].content) { if (depth >= CALF_MAX_DEPTH) goto bad; stack[depth++] = k; }
	}
	if (depth || root < 0) goto bad;
	/* Exceptions in a Change or an Add: out of it (a Change's come after it as commands). */
	for (int k = 0; k < count; k++) {
		if (t[k].page != 0 || (t[k].tag != CALF_AIRSYNC_CHANGE && t[k].tag != CALF_AS_ADD)) continue;
		int ex = calf_find(t, calf_find(t, k, 0, CALF_AS_APPLICATION_DATA), CALF_PAGE, CALF_EXCEPTIONS);
		if (ex >= 0) { t[ex].cut = 1; found = 1; }
	}
	if (!found) { free(t); return NULL; }
	struct calf_buf w = { NULL, 0, 0, 0, 0 };
	calf_put(&w, in, body);
	calf_emit_tree(&w, t, in, root);
	free(t);
	if (w.failed) { free(w.b); return NULL; }
	*len = w.n;
	return w.b;
bad:
	free(t);
	return NULL;
}

#endif
