/*
 * The EAS reply filter (libpreload/wbxmlfilter.h), on the build machine.
 *
 *   cc -O2 -Wall -I../libpreload wbxmlfilter_test.c -o wbxmlfilter_test && ./wbxmlfilter_test
 *
 * Replies built the way Exchange Online writes them at 16.1 must come out as a 12.1 server's
 * would: elements in code pages above 20 gone with everything inside them, the page switches
 * right for what follows, and every other byte as it was - however the reply is cut into pieces.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "wbxmlfilter.h"

static int failures;

static unsigned char out[1 << 16];
static size_t run(const unsigned char *in, size_t n, size_t step)
{
	struct wbxf f; wbxf_init(&f);
	size_t o = 0;
	for (size_t i = 0; i < n; i += step) {
		size_t k = n - i < step ? n - i : step;
		o += wbxf_feed(&f, in + i, k, out + o);
	}
	return o;
}

static void same_every_way(const unsigned char *in, size_t n, const unsigned char *want, size_t wn, const char *what)
{
	size_t steps[] = { 1, 2, 3, 7, 64, 100000 };
	for (int s = 0; s < 6; s++) {
		size_t o = run(in, n, steps[s]);
		if (o != wn || memcmp(out, want, wn) != 0) {
			fprintf(stderr, "wbxmlfilter_test: FAIL: %s (pieces of %zu): got %zu bytes, wanted %zu\n", what, steps[s], o, wn);
			failures++;
			return;
		}
	}
}

#define HDR 0x03, 0x01, 0x6a, 0x00

int main(void)
{
	/* A Sync reply with an email that carries Email2's ConversationId (opaque) and
	   ConversationIndex, then Email's Read, then the item ends. */
	static const unsigned char sync16[] = { HDR,
		0x45, 0x5c, 0x4f,                               /* Sync, Collections, Collection (page 0) */
		0x4b, 0x03, '1', 0x00, 0x01,                     /* SyncKey "1" */
		0x50, 0x47, 0x4d, 0x03, 'a', 0x00, 0x01,         /* Commands, Add, ServerId "a" */
		0x5d,                                            /* ApplicationData */
		0x00, 0x02, 0x54, 0x03, 'h', 'i', 0x00, 0x01,    /* page 2 (Email): Subject "hi" */
		0x00, 0x16, 0x49, 0xc3, 0x03, 'x', 'y', 'z', 0x01, /* page 22 (Email2): ConversationId, opaque "xyz" */
		0x4a, 0xc3, 0x02, 0x01, 0x02, 0x01,              /* ConversationIndex, opaque 01 02 */
		0x00, 0x02, 0x55, 0x03, '1', 0x00, 0x01,         /* page 2: Read "1" */
		0x01, 0x01, 0x01, 0x01, 0x01, 0x01 };            /* /ApplicationData /Add /Commands /Collection /Collections /Sync */
	static const unsigned char sync12[] = { HDR,
		0x45, 0x5c, 0x4f,
		0x4b, 0x03, '1', 0x00, 0x01,
		0x50, 0x47, 0x4d, 0x03, 'a', 0x00, 0x01,
		0x5d,
		0x00, 0x02, 0x54, 0x03, 'h', 'i', 0x00, 0x01,
		0x55, 0x03, '1', 0x00, 0x01,                     /* still in page 2: no switch needed */
		0x01, 0x01, 0x01, 0x01, 0x01, 0x01 };
	same_every_way(sync16, sizeof sync16, sync12, sizeof sync12, "Email2 elements dropped from a Sync reply");

	/* A dropped element that is last before an END, with no switch back: the next tag after the
	   END is page 0 again, and the service must be told. */
	static const unsigned char tail16[] = { HDR,
		0x45, 0x00, 0x18, 0x47, 0x03, 'q', 0x00, 0x01,  /* Sync, page 24 (RightsManagement): an element */
		0x00, 0x00, 0x4e, 0x03, '1', 0x00, 0x01, 0x01 };/* page 0: Status "1", /Sync */
	static const unsigned char tail12[] = { HDR,
		0x45, 0x4e, 0x03, '1', 0x00, 0x01, 0x01 };     /* the switch to page 0 isn't needed: it never left */
	same_every_way(tail16, sizeof tail16, tail12, sizeof tail12, "a dropped element before a switch back");

	/* Nested elements in a dropped page, including a switch to a known page inside it, then a
	   tag in that known page after it: the switch has to be written before the tag. */
	static const unsigned char nest16[] = { HDR,
		0x45, 0x00, 0x19, 0x45, 0x46, 0x00, 0x11, 0x48, 0x03, 'b', 0x00, 0x01, 0x01, 0x01, /* Find (25) with AirSyncBase (17) inside */
		0x4a, 0x03, 'k', 0x00, 0x01, 0x01 };            /* page 17 still: a tag, then /Sync */
	static const unsigned char nest12[] = { HDR,
		0x45, 0x00, 0x11, 0x4a, 0x03, 'k', 0x00, 0x01, 0x01 };
	same_every_way(nest16, sizeof nest16, nest12, sizeof nest12, "a nested dropped element, then its last page");

	/* Nothing to drop: byte for byte, a large opaque payload included. */
	static unsigned char big[4 + 3 + 2 + 2 + 3000 + 2];
	size_t bn = 0;
	big[bn++] = 0x03; big[bn++] = 0x01; big[bn++] = 0x6a; big[bn++] = 0x00;
	big[bn++] = 0x45; big[bn++] = 0x00; big[bn++] = 0x11;   /* Sync, page 17 */
	big[bn++] = 0x4b; big[bn++] = 0xc3;                      /* Data, OPAQUE */
	big[bn++] = 0x97; big[bn++] = 0x38;                      /* 3000 as mb_u_int32 */
	for (int i = 0; i < 3000; i++) big[bn++] = (unsigned char)(i * 7);
	big[bn++] = 0x01; big[bn++] = 0x01;
	/* the switch to 17 is written lazily, in the same place */
	same_every_way(big, bn, big, bn, "a reply with nothing to drop passes byte for byte");

	/* Something that isn't WBXML 1.3 passes untouched. */
	static const unsigned char html[] = "<html>not wbxml</html>";
	same_every_way(html, sizeof html - 1, html, sizeof html - 1, "a non-WBXML body passes untouched");

	/* An opaque payload inside a dropped element, large and cut anywhere. */
	static unsigned char bigdrop[4 + 1 + 2 + 2 + 2 + 3000 + 1 + 3 + 1];
	size_t dn = 0;
	memcpy(bigdrop, (unsigned char[]){ 0x03, 0x01, 0x6a, 0x00, 0x45, 0x00, 0x16, 0x49, 0xc3, 0x97, 0x38 }, 11); dn = 11;
	for (int i = 0; i < 3000; i++) bigdrop[dn++] = 0x01;     /* bytes that look like ENDs */
	bigdrop[dn++] = 0x01;                                   /* /ConversationId */
	bigdrop[dn++] = 0x00; bigdrop[dn++] = 0x00; bigdrop[dn++] = 0x4e;   /* page 0: Status, empty-ish */
	bigdrop[dn++] = 0x01;
	/* Status (0x4e) has content; its END is the last byte, and /Sync is missing on purpose: the
	   filter has nothing to do with document structure beyond the dropped elements. */
	static const unsigned char want_bd[] = { 0x03, 0x01, 0x6a, 0x00, 0x45, 0x4e, 0x01 };
	same_every_way(bigdrop, dn, want_bd, sizeof want_bd, "opaque data inside a dropped element goes, END-like bytes and all");

	/* 16.x calendar exceptions (2026-11-08): an Exception's InstanceId reaches Palm as
	   ExceptionStartTime, and a page-17 tag after it gets its page switch back. */
	static const unsigned char exc16[] = { HDR, 0x45, 0x00, 0x04, 0x54, 0x53, 0x55, 0x03, '1', 0x00, 0x01,
		0x00, 0x11, 0x6d, 0x03, 'D', 0x00, 0x01, 0x01, 0x01, 0x56, 0x03, '1', 0x00, 0x01, 0x01 };
	static const unsigned char exc12[] = { HDR, 0x45, 0x00, 0x04, 0x54, 0x53, 0x55, 0x03, '1', 0x00, 0x01,
		0x56, 0x03, 'D', 0x00, 0x01, 0x01, 0x01, 0x00, 0x11, 0x56, 0x03, '1', 0x00, 0x01, 0x01 };
	same_every_way(exc16, sizeof exc16, exc12, sizeof exc12, "an Exception's InstanceId as ExceptionStartTime");
	/* Outside an Exception, InstanceId stays as it is. */
	static const unsigned char iid[] = { HDR, 0x45, 0x00, 0x11, 0x6d, 0x03, 'D', 0x00, 0x01, 0x01 };
	same_every_way(iid, sizeof iid, iid, sizeof iid, "InstanceId elsewhere left alone");
	/* Responses: a Delete naming an occurrence (status 5, a repeated delete) goes; a Change
	   Palm sent stays. */
	static const unsigned char resp16[] = { HDR, 0x45, 0x46,
		0x49, 0x4d, 0x03, 'S', 0x00, 0x01, 0x00, 0x11, 0x6d, 0x03, 'I', 0x00, 0x01, 0x00, 0x00, 0x4e, 0x03, '5', 0x00, 0x01, 0x01,
		0x48, 0x4d, 0x03, 'T', 0x00, 0x01, 0x4e, 0x03, '6', 0x00, 0x01, 0x01,
		0x01, 0x01 };
	static const unsigned char resp12[] = { HDR, 0x45, 0x46,
		0x48, 0x4d, 0x03, 'T', 0x00, 0x01, 0x4e, 0x03, '6', 0x00, 0x01, 0x01,
		0x01, 0x01 };
	same_every_way(resp16, sizeof resp16, resp12, sizeof resp12, "a Responses entry naming an occurrence goes");
	/* A Responses entry too long to hold passes as it is. */
	static unsigned char longresp[4 + 3 + 3 + 6000 + 2 + 1 + 3];
	size_t ln = 0;
	memcpy(longresp, (unsigned char[]){ HDR, 0x45, 0x46, 0x47, 0x4d, 0x03 }, 9); ln = 9;
	memset(longresp + ln, 'x', 6000); ln += 6000;
	longresp[ln++] = 0x00; longresp[ln++] = 0x01; longresp[ln++] = 0x01; longresp[ln++] = 0x01; longresp[ln++] = 0x01;
	same_every_way(longresp, ln, longresp, ln, "a long Responses entry passes whole");

	/* An email's MeetingRequest names its meeting with Calendar's UID at 16.x: Palm is given the
	   GlobalObjId a 12.1 server sent, from which it gets the same UID back (expected values built
	   independently, with Python's base64). */
	{
		static const char *uids[] = {
			"040000008200E00074C5B7101A82E00800000000C00EAD614071DD0100000000000000001000000020AC5C6A6E28CA4B97445C55FC3A9663",
			"abc-123@example.com" };
		static const char *goids[] = {
			"BAAAAIIA4AB0xbcQGoLgCAAAAADADq1hQHHdAQAAAAAAAAAAEAAAACCsXGpuKMpLl0RcVfw6lmM=",
			"BAAAAIIA4AB0xbcQGoLgCAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAHZDYWwtVWlkAQAAAGFiYy0xMjNAZXhhbXBsZS5jb20A" };
		for (int u = 0; u < 2; u++) {
			unsigned char in[512], want[512]; size_t ni = 0, nw = 0;
			const unsigned char head[] = { HDR, 0x00, 0x02, 0x62, 0x5e, 0x03, 'x', 0x00, 0x01 };   /* MeetingRequest, EndTime */
			memcpy(in, head, sizeof head); ni = sizeof head; memcpy(want, head, sizeof head); nw = sizeof head;
			in[ni++] = 0x00; in[ni++] = 0x04; in[ni++] = 0x68; in[ni++] = 0x03;                   /* Calendar UID */
			memcpy(in + ni, uids[u], strlen(uids[u]) + 1); ni += strlen(uids[u]) + 1; in[ni++] = 0x01;
			want[nw++] = 0x74; want[nw++] = 0x03;                                                  /* Email GlobalObjId */
			memcpy(want + nw, goids[u], strlen(goids[u]) + 1); nw += strlen(goids[u]) + 1; want[nw++] = 0x01;
			const unsigned char tail[] = { 0x00, 0x02, 0x63, 0x03, 'o', 0x00, 0x01, 0x01 };         /* Organizer, /MeetingRequest */
			memcpy(in + ni, tail, sizeof tail); ni += sizeof tail;
			memcpy(want + nw, tail + 2, sizeof tail - 2); nw += sizeof tail - 2;                 /* already on page 2 */
			same_every_way(in, ni, want, nw, u ? "an iCal UID in a MeetingRequest becomes a vCal-Uid GlobalObjId" : "an Outlook UID in a MeetingRequest becomes its GlobalObjId");
		}
		/* A calendar item's own UID (not in a MeetingRequest) passes as it was. */
		const unsigned char item[] = { HDR, 0x00, 0x04, 0x68, 0x03, 'u', 'i', 'd', 0x00, 0x01, 0x66, 0x03, 's', 0x00, 0x01 };
		same_every_way(item, sizeof item, item, sizeof item, "a calendar item's UID is left alone");
	}

	if (failures) { fprintf(stderr, "wbxmlfilter_test: %d failed\n", failures); return 1; }
	printf("wbxmlfilter_test: ok\n");
	return 0;
}
