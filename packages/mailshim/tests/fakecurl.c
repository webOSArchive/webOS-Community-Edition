/*
 * A stand-in for libcurl and liblunaservice, for glue_test.c: it records what reaches it, so the
 * test can see what libce-mailshim.so, loaded in front of it, passed on. Linked after the shim,
 * so the shim's dlsym(RTLD_NEXT) finds these.
 */
#include <stdarg.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#define FAKE_OPTS 64
struct fake_opt { int option; void *value; long long big; };
struct fake_opt fake_opts[FAKE_OPTS];
int fake_nopts, fake_added, fake_cleaned;
char fake_url[1024];          /* curl copies a URL; the shim relies on it */
char *fake_responded;         /* LSMessageRespond's last payload (a copy), and the pointer it came as */
const char *fake_responded_ptr;

int curl_easy_setopt(void *h, int option, ...)
{
	(void)h;
	va_list ap;
	va_start(ap, option);
	struct fake_opt o = { option, NULL, 0 };
	if (option >= 30000 && option < 40000) o.big = va_arg(ap, long long);
	else o.value = va_arg(ap, void *);
	va_end(ap);
	if (option == 10002) strncpy(fake_url, o.value ? (char *)o.value : "", sizeof fake_url - 1);
	for (int i = 0; i < fake_nopts; i++) if (fake_opts[i].option == option) { fake_opts[i] = o; return 0; }
	if (fake_nopts < FAKE_OPTS) fake_opts[fake_nopts++] = o;
	return 0;
}

void *fake_get(int option)
{
	for (int i = 0; i < fake_nopts; i++) if (fake_opts[i].option == option) return fake_opts[i].value;
	return NULL;
}

int curl_easy_getinfo(void *h, int info, ...) { (void)h; (void)info; return 0; }
int curl_multi_add_handle(void *multi, void *h) { (void)multi; (void)h; fake_added++; return 0; }
void curl_easy_cleanup(void *h) { (void)h; fake_cleaned++; }

struct curl_slist { char *data; struct curl_slist *next; };
struct curl_slist *curl_slist_append(struct curl_slist *list, const char *s)
{
	struct curl_slist *n = calloc(1, sizeof *n), *p = list;
	n->data = strdup(s);
	if (!list) return n;
	while (p->next) p = p->next;
	p->next = n;
	return list;
}
void curl_slist_free_all(struct curl_slist *l) { while (l) { struct curl_slist *n = l->next; free(l->data); free(l); l = n; } }

bool LSMessageRespond(void *m, const char *payload, void *e)
{
	(void)m; (void)e;
	free(fake_responded);
	fake_responded = strdup(payload);
	fake_responded_ptr = payload;
	return true;
}
