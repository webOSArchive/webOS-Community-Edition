/*
 * Palm's sends in ComposeMail form (libpreload/composemail.h), on the build machine.
 *
 *   cc -O2 -Wall -I../libpreload composemail_test.c -o composemail_test && ./composemail_test
 *
 * The SendMail bytes are the ones Exchange Online accepted from the build machine on 2026-11-06
 * (a message it delivered); the status reply is what it sent back to Palm's raw-MIME form.
 */
#include <stdio.h>
#include <string.h>

#include "composemail.h"

static int failures;
static void check(int ok, const char *what) { if (!ok) { fprintf(stderr, "composemail_test: FAIL: %s\n", what); failures++; } }

int main(void)
{
	struct cm_send s;

	check(cm_parse_url("https://outlook.office365.com/Microsoft-Server-ActiveSync?Cmd=SendMail&SaveInSent=T&User=a%40b&DeviceId=X&DeviceType=Palm", &s) == CM_SENDMAIL && s.save, "SendMail with SaveInSent");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?Cmd=SendMail&DeviceId=X", &s) == CM_SENDMAIL && !s.save, "SendMail without SaveInSent");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?Cmd=SmartReply&ItemId=8%3A12&CollectionId=8&SaveInSent=T&DeviceId=X", &s) == CM_SMARTREPLY
		&& strcmp(s.item, "8:12") == 0 && strcmp(s.folder, "8") == 0 && s.save, "SmartReply, its source decoded");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?Cmd=SmartForward&ItemId=3&CollectionId=8", &s) == CM_SMARTFORWARD, "SmartForward");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?Cmd=SmartReply&ItemId=3", &s) == 0, "a reply without its folder is left alone");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?Cmd=Sync&DeviceId=X", &s) == 0, "Sync isn't a send");
	check(cm_parse_url("https://h/Microsoft-Server-ActiveSync?DeviceId=X&Cmd=SendMail", &s) == CM_SENDMAIL, "Cmd anywhere in the query");

	unsigned char out[1024];
	cm_parse_url("https://h/x?Cmd=SendMail&SaveInSent=T", &s);
	size_t n = cm_prefix(&s, "probe1", 677, out);
	static const unsigned char want[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x15, 0x45,
		0x51, 0x03, 'p', 'r', 'o', 'b', 'e', '1', 0x00, 0x01,
		0x08, 0x50, 0xc3, 0x85, 0x25 };   /* 677 = 5 * 128 + 37 */
	check(n == sizeof want && memcmp(out, want, n) == 0, "SendMail prefix, as Exchange Online took it");

	n = cm_prefix(&s, "c", 5, out);
	check(n == 16 && out[n - 1] == 5, "a one-byte length");
	n = cm_prefix(&s, "c", 128 * 128 * 3 + 1, out);
	check(out[n - 3] == 0x83 && out[n - 2] == 0x80 && out[n - 1] == 0x01, "a three-byte length");

	cm_parse_url("https://h/x?Cmd=SmartReply&ItemId=8%3A1&CollectionId=8", &s);
	n = cm_prefix(&s, "c", 5, out);
	static const unsigned char reply[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x15, 0x47,
		0x51, 0x03, 'c', 0x00, 0x01,
		0x4b, 0x4c, 0x03, '8', 0x00, 0x01, 0x4d, 0x03, '8', ':', '1', 0x00, 0x01, 0x01,
		0x50, 0xc3, 0x05 };
	check(n == sizeof reply && memcmp(out, reply, n) == 0, "SmartReply prefix with its source, no SaveInSentItems");

	static const unsigned char refused[] = { 0x03, 0x01, 0x6a, 0x00, 0x00, 0x15, 0x45, 0x52, 0x03, '1', '0', '1', 0x00, 0x01, 0x01 };
	check(cm_status(refused, sizeof refused) == 101, "status 101 read");
	check(cm_status((const unsigned char *)"", 0) == 0, "an empty reply has no status");
	static const unsigned char sync[] = { 0x03, 0x01, 0x6a, 0x00, 0x45, 0x4e, 0x03, '1', 0x00, 0x01, 0x01 };
	check(cm_status(sync, sizeof sync) == 0, "another command's reply isn't a send status");

	/* A meeting reply's calendar part gets method=REPLY, at the same length; nothing else changes. */
	{
		const char *hd = "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"B\"\r\n\r\n--B\r\n";
		const char *part = "Content-Type: text/calendar\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: inline\r\n\r\n";
		const char *reply = "QkVHSU46VkNBTEVOREFSDQpNRVRIT0Q6UkVQTFkNClBST0RJRDpNaWNyb3NvZnQgRXhjaGFuZ2UgU2VydmVyIDIwMDcN\r\n";   /* BEGIN:VCALENDAR, METHOD:REPLY */
		const char *request = "QkVHSU46VkNBTEVOREFSDQpNRVRIT0Q6UkVRVUVTVA0KUFJPRElEOk1pY3Jvc29mdCBFeGNoYW5nZSBTZXJ2ZXIgMjAw\r\n";   /* METHOD:REQUEST */
		char m[1024], was[1024];
		snprintf(m, sizeof m, "%s%s%s--B--\r\n", hd, part, reply);
		size_t ml = strlen(m);
		check(cm_fix_reply(m, ml) == 1 && strlen(m) == ml, "a reply is rewritten, same length");
		check(strstr(m, "Content-Type: text/calendar; method=REPLY; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\nQkVH") != NULL, "with method=REPLY, and the body where it was");
		check(strstr(m, "Content-Disposition") == NULL, "inline, the default, goes");
		snprintf(m, sizeof m, "%s%s%s--B--\r\n", hd, part, request); memcpy(was, m, strlen(m) + 1);
		check(cm_fix_reply(m, strlen(m)) == 0 && strcmp(m, was) == 0, "a request (or any other calendar) is left alone");
		snprintf(m, sizeof m, "%s%s", hd, part); memcpy(was, m, strlen(m) + 1);
		check(cm_fix_reply(m, strlen(m)) == 0 && strcmp(m, was) == 0, "a part whose body isn't in the piece is left alone");
		char lf[512];
		snprintf(lf, sizeof lf, "Content-Type: text/calendar\nContent-Transfer-Encoding: base64\nContent-Disposition: inline\n\nQkVHSU46VkNBTEVOREFSDQpNRVRIT0Q6UkVQTFkNCg==\n");
		size_t ll = strlen(lf);
		check(cm_fix_reply(lf, ll) == 1 && strlen(lf) == ll && strncmp(lf, "Content-Type: text/calendar;method=REPLY; charset=UTF-8\n", 56) == 0, "LF line ends too");
	}

	if (failures) { fprintf(stderr, "composemail_test: %d failed\n", failures); return 1; }
	printf("composemail_test: ok\n");
	return 0;
}
