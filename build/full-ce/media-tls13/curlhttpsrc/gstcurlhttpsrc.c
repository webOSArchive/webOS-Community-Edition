/* gstcurlhttpsrc — HTTP/HTTPS source element for GStreamer 0.10 on webOS CE,
 * built on libcurl (the OpenSSL 1.1 build the CE browser-tls13 tier installs in
 * /usr/lib/ssl11). It exists because the stock souphttpsrc goes through
 * libsoup 2.4.1 + GnuTLS 2.10 -- no TLS 1.2, no SNI -- so any stream that lands
 * on an https:// host (directly or via redirect) fails to preroll.
 *
 * webOS's media-pipeline does not pick its source by rank: it creates
 * "souphttpsrc" by name (the literal is in the binary). So this element IS
 * "souphttpsrc" -- same element name, same properties -- and the stock
 * libgstsouphttpsrc.so is moved out of the plugin directory on install. Every
 * GStreamer user on the device (Videos, Music streaming, Browser media) then
 * fetches http and https through libcurl; http:// chains that redirect to
 * https:// work too. The properties are souphttpsrc's, names and types:
 * location, user-agent, automatic-redirect,
 * proxy, cookies, iradio-mode (+ icy tags/caps), timeout, extra-headers,
 * is-live. Seeking is Range-based like souphttpsrc; a server that answers a
 * Range request with 200 is skipped forward once and then marked unseekable.
 *
 * Model: a worker thread runs curl_easy_perform for the current byte offset and
 * pushes chunks into a bounded queue; create() pops them on the streaming
 * thread. A seek aborts the transfer (progress callback), joins the worker, and
 * starts a new one at the new offset.
 *
 * Copyright 2026 webOS Archive contributors. LGPL-2.1-or-later, like the
 * souphttpsrc element it replaces.
 */

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <string.h>
#include <stdlib.h>
#include <syslog.h>
#include <dlfcn.h>
#define CURL_DISABLE_TYPECHECK   /* calls go through function pointers, not the macros */
#include <curl/curl.h>
#include <gst/gst.h>
#include <gst/base/gstpushsrc.h>

#define PACKAGE "media-tls13"
#define VERSION "1.0.0"

GST_DEBUG_CATEGORY_STATIC (curlhttpsrc_debug);
/* media-pipeline runs with --gst-debug=1, so GST_DEBUG output is invisible on
 * the device; transfer milestones go to syslog (/var/log/messages) instead. */
#define TRACE(...) syslog (LOG_WARNING, "curlhttpsrc: " __VA_ARGS__)
#define GST_CAT_DEFAULT curlhttpsrc_debug

#define GST_TYPE_CURL_HTTP_SRC (gst_curl_http_src_get_type ())
#define GST_CURL_HTTP_SRC(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), GST_TYPE_CURL_HTTP_SRC, GstCurlHttpSrc))
#define GST_CURL_HTTP_SRC_CLASS(klass) (G_TYPE_CHECK_CLASS_CAST ((klass), GST_TYPE_CURL_HTTP_SRC, GstCurlHttpSrcClass))
#define GST_IS_CURL_HTTP_SRC(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), GST_TYPE_CURL_HTTP_SRC))

#define DEFAULT_USER_AGENT "GStreamer curlhttpsrc (webOS CE)"
#define DEFAULT_CA_FILE "/etc/ssl/certs/ca-certificates.crt"
#define QUEUE_MAX_BYTES (2 * 1024 * 1024)    /* worker blocks above this */
#define CURL_BUFFER_SIZE (64 * 1024)
#define CONNECT_TIMEOUT_SECS 20
#define MAX_REDIRECTS 10

typedef enum
{
  WORKER_IDLE,                  /* no transfer; create() starts one */
  WORKER_RUNNING,
  WORKER_DONE,                  /* transfer finished cleanly: EOS after the queue drains */
  WORKER_ERROR                  /* transfer failed: error after the queue drains */
} WorkerState;

typedef struct _GstCurlHttpSrc GstCurlHttpSrc;
typedef struct _GstCurlHttpSrcClass GstCurlHttpSrcClass;

struct _GstCurlHttpSrc
{
  GstPushSrc element;

  /* properties */
  gchar *location;
  gchar *user_agent;
  gboolean automatic_redirect;
  gchar *proxy;
  gchar **cookies;
  gboolean iradio_mode;
  gchar *iradio_name, *iradio_genre, *iradio_url, *iradio_title;
  guint timeout;
  GstStructure *extra_headers;
  gboolean is_live;
  gboolean ssl_strict;
  gchar *ca_file;

  /* transfer state, protected by lock */
  GMutex *lock;
  GCond *cond;
  GThread *thread;
  WorkerState state;
  gboolean abort;               /* tell the worker to stop */
  gboolean flushing;            /* create() must return WRONG_STATE */
  GQueue *queue;                /* GstBuffer* */
  guint64 queued_bytes;
  gchar *error_msg;

  guint64 request_position;     /* byte offset the next transfer starts at */
  guint64 read_position;        /* bytes delivered so far (absolute) */
  guint64 skip;                 /* bytes to discard when the server ignored Range */
  gboolean have_size;
  guint64 content_size;
  gboolean seekable;

  /* per-transfer header parsing (worker thread only) */
  glong response_code;
  gboolean headers_done;
  gboolean got_content_range;
  guint64 content_length;
  gboolean accept_ranges;
  gint icy_metaint;
  gchar *content_type;
  GstCaps *src_caps;
  GstTagList *tags;             /* pending tags to post from the streaming thread */
};

struct _GstCurlHttpSrcClass
{
  GstPushSrcClass parent_class;
};

enum
{
  PROP_0,
  PROP_LOCATION,
  PROP_USER_AGENT,
  PROP_AUTOMATIC_REDIRECT,
  PROP_PROXY,
  PROP_COOKIES,
  PROP_IRADIO_MODE,
  PROP_IRADIO_NAME,
  PROP_IRADIO_GENRE,
  PROP_IRADIO_URL,
  PROP_IRADIO_TITLE,
  PROP_TIMEOUT,
  PROP_EXTRA_HEADERS,
  PROP_IS_LIVE,
  PROP_SSL_STRICT,
  PROP_CA_FILE
};

static GstStaticPadTemplate srctemplate = GST_STATIC_PAD_TEMPLATE ("src",
    GST_PAD_SRC, GST_PAD_ALWAYS, GST_STATIC_CAPS_ANY);

static void gst_curl_http_src_uri_handler_init (gpointer g_iface, gpointer iface_data);
static void gst_curl_http_src_finalize (GObject * gobject);
static void gst_curl_http_src_set_property (GObject * object, guint prop_id, const GValue * value, GParamSpec * pspec);
static void gst_curl_http_src_get_property (GObject * object, guint prop_id, GValue * value, GParamSpec * pspec);
static GstFlowReturn gst_curl_http_src_create (GstPushSrc * psrc, GstBuffer ** outbuf);
static gboolean gst_curl_http_src_start (GstBaseSrc * bsrc);
static gboolean gst_curl_http_src_stop (GstBaseSrc * bsrc);
static gboolean gst_curl_http_src_get_size (GstBaseSrc * bsrc, guint64 * size);
static gboolean gst_curl_http_src_is_seekable (GstBaseSrc * bsrc);
static gboolean gst_curl_http_src_do_seek (GstBaseSrc * bsrc, GstSegment * segment);
static gboolean gst_curl_http_src_unlock (GstBaseSrc * bsrc);
static gboolean gst_curl_http_src_unlock_stop (GstBaseSrc * bsrc);
static gboolean gst_curl_http_src_set_location (GstCurlHttpSrc * src, const gchar * uri);
static void gst_curl_http_src_stop_worker (GstCurlHttpSrc * src);

/* ---- libcurl, loaded privately ------------------------------------------
 *
 * The plugin does NOT link libcurl. Other libraries in media-pipeline can
 * already have the STOCK /usr/lib/libcurl.so.4 (7.21.7, OpenSSL 0.9.8) loaded,
 * and a NEEDED "libcurl.so.4" would then bind to it, ignoring our RPATH -- seen
 * on hardware: plugin_init reported libcurl/7.21.7 and TLS to a modern host
 * failed with an SSLv3 alert. The reverse order is just as bad: other
 * libraries' libcurl.so.4 would bind to ours. So the CE OpenSSL 1.1 and CE
 * libcurl are dlopen'ed by full path with RTLD_LOCAL and called only through
 * this table. */

#define CE_SSL_DIR "/usr/lib/ssl11"

static struct
{
  CURLcode (*global_init) (long flags);
  char *(*version) (void);
  CURL *(*easy_init) (void);
  CURLcode (*easy_setopt) (CURL * curl, CURLoption option, ...);
  CURLcode (*easy_perform) (CURL * curl);
  CURLcode (*easy_getinfo) (CURL * curl, CURLINFO info, ...);
  void (*easy_cleanup) (CURL * curl);
  const char *(*easy_strerror) (CURLcode code);
  struct curl_slist *(*slist_append) (struct curl_slist * list, const char *string);
  void (*slist_free_all) (struct curl_slist * list);
} CURLF;

static gboolean
load_private_curl (void)
{
  static const char *pre[] = { CE_SSL_DIR "/libcrypto.so.1.1", CE_SSL_DIR "/libssl.so.1.1", NULL };
  void *h;
  int i;

  for (i = 0; pre[i]; i++) {
    if (!dlopen (pre[i], RTLD_NOW | RTLD_LOCAL)) {
      TRACE ("cannot load %s: %s", pre[i], dlerror ());
      return FALSE;
    }
  }
  /* RTLD_LOCAL by full path is enough: the stock libcurl and OpenSSL 0.9.8 only
   * ever enter media-pipeline through RTLD_LOCAL plugins (pdksink -> libpdl),
   * never the global scope, so curl's lookups fall through to its own
   * OpenSSL 1.1 (whose symbols are versioned anyway). NOT RTLD_DEEPBIND: it
   * makes curl bind glibc's malloc ahead of the preloaded libptmalloc3, two
   * allocators share one heap, and media-pipeline crashes. */
  h = dlopen (CE_SSL_DIR "/libcurl.so.4.8.0", RTLD_NOW | RTLD_LOCAL);
  if (!h) {
    TRACE ("cannot load CE libcurl: %s", dlerror ());
    return FALSE;
  }
#define LOAD(field, sym) \
  if (!(*(void **) (&CURLF.field) = dlsym (h, sym))) { TRACE ("libcurl lacks %s", sym); return FALSE; }
  LOAD (global_init, "curl_global_init");
  LOAD (version, "curl_version");
  LOAD (easy_init, "curl_easy_init");
  LOAD (easy_setopt, "curl_easy_setopt");
  LOAD (easy_perform, "curl_easy_perform");
  LOAD (easy_getinfo, "curl_easy_getinfo");
  LOAD (easy_cleanup, "curl_easy_cleanup");
  LOAD (easy_strerror, "curl_easy_strerror");
  LOAD (slist_append, "curl_slist_append");
  LOAD (slist_free_all, "curl_slist_free_all");
#undef LOAD
  return TRUE;
}

static void
_do_init (GType type)
{
  static const GInterfaceInfo urihandler_info = {
    gst_curl_http_src_uri_handler_init, NULL, NULL
  };
  g_type_add_interface_static (type, GST_TYPE_URI_HANDLER, &urihandler_info);
  GST_DEBUG_CATEGORY_INIT (curlhttpsrc_debug, "souphttpsrc", 0, "libcurl HTTP src (souphttpsrc replacement)");
}

GST_BOILERPLATE_FULL (GstCurlHttpSrc, gst_curl_http_src, GstPushSrc, GST_TYPE_PUSH_SRC, _do_init);

static void
gst_curl_http_src_base_init (gpointer g_class)
{
  GstElementClass *element_class = GST_ELEMENT_CLASS (g_class);
  gst_element_class_add_pad_template (element_class, gst_static_pad_template_get (&srctemplate));
  gst_element_class_set_details_simple (element_class, "HTTP/HTTPS client source (libcurl)",
      "Source/Network",
      "Receive data as a client over the network via HTTP and HTTPS using libcurl (TLS 1.3, SNI)",
      "webOS Archive");
}

static void
gst_curl_http_src_class_init (GstCurlHttpSrcClass * klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  GstBaseSrcClass *gstbasesrc_class = GST_BASE_SRC_CLASS (klass);
  GstPushSrcClass *gstpushsrc_class = GST_PUSH_SRC_CLASS (klass);

  gobject_class->set_property = gst_curl_http_src_set_property;
  gobject_class->get_property = gst_curl_http_src_get_property;
  gobject_class->finalize = gst_curl_http_src_finalize;

  g_object_class_install_property (gobject_class, PROP_LOCATION,
      g_param_spec_string ("location", "Location", "Location to read from", "",
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_USER_AGENT,
      g_param_spec_string ("user-agent", "User-Agent",
          "Value of the User-Agent HTTP request header field", DEFAULT_USER_AGENT,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_AUTOMATIC_REDIRECT,
      g_param_spec_boolean ("automatic-redirect", "automatic-redirect",
          "Automatically follow HTTP redirects (HTTP Status Code 3xx)", TRUE,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_PROXY,
      g_param_spec_string ("proxy", "Proxy", "HTTP proxy server URI", "",
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_COOKIES,
      g_param_spec_boxed ("cookies", "Cookies", "HTTP request cookies", G_TYPE_STRV,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IS_LIVE,
      g_param_spec_boolean ("is-live", "is-live", "Act like a live source", FALSE,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IRADIO_MODE,
      g_param_spec_boolean ("iradio-mode", "iradio-mode",
          "Enable internet radio mode (extraction of shoutcast/icecast metadata)", FALSE,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IRADIO_NAME,
      g_param_spec_string ("iradio-name", "iradio-name", "Name of the stream", NULL,
          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IRADIO_GENRE,
      g_param_spec_string ("iradio-genre", "iradio-genre", "Genre of the stream", NULL,
          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IRADIO_URL,
      g_param_spec_string ("iradio-url", "iradio-url", "Homepage URL for radio stream", NULL,
          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_IRADIO_TITLE,
      g_param_spec_string ("iradio-title", "iradio-title", "Name of currently playing song", NULL,
          G_PARAM_READABLE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_TIMEOUT,
      g_param_spec_uint ("timeout", "timeout",
          "Value in seconds to timeout a blocking I/O (0 = No timeout).", 0, 3600, 0,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_EXTRA_HEADERS,
      g_param_spec_boxed ("extra-headers", "Extra Headers",
          "Extra headers to append to the HTTP request", GST_TYPE_STRUCTURE,
          G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_SSL_STRICT,
      g_param_spec_boolean ("ssl-strict", "SSL Strict",
          "Verify the server certificate against ca-file (the stock souphttpsrc never verified)",
          FALSE, G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));
  g_object_class_install_property (gobject_class, PROP_CA_FILE,
      g_param_spec_string ("ca-file", "CA file", "CA bundle used when ssl-strict is set",
          DEFAULT_CA_FILE, G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS));

  gstbasesrc_class->start = GST_DEBUG_FUNCPTR (gst_curl_http_src_start);
  gstbasesrc_class->stop = GST_DEBUG_FUNCPTR (gst_curl_http_src_stop);
  gstbasesrc_class->unlock = GST_DEBUG_FUNCPTR (gst_curl_http_src_unlock);
  gstbasesrc_class->unlock_stop = GST_DEBUG_FUNCPTR (gst_curl_http_src_unlock_stop);
  gstbasesrc_class->get_size = GST_DEBUG_FUNCPTR (gst_curl_http_src_get_size);
  gstbasesrc_class->is_seekable = GST_DEBUG_FUNCPTR (gst_curl_http_src_is_seekable);
  gstbasesrc_class->do_seek = GST_DEBUG_FUNCPTR (gst_curl_http_src_do_seek);
  gstpushsrc_class->create = GST_DEBUG_FUNCPTR (gst_curl_http_src_create);
}

static void
gst_curl_http_src_reset_transfer_info (GstCurlHttpSrc * src)
{
  src->response_code = 0;
  src->headers_done = FALSE;
  src->got_content_range = FALSE;
  src->content_length = 0;
  src->accept_ranges = FALSE;
  src->icy_metaint = 0;
  g_free (src->content_type);
  src->content_type = NULL;
}

static void
gst_curl_http_src_init (GstCurlHttpSrc * src, GstCurlHttpSrcClass * g_class)
{
  src->location = NULL;
  src->user_agent = g_strdup (DEFAULT_USER_AGENT);
  src->automatic_redirect = TRUE;
  src->proxy = NULL;
  src->cookies = NULL;
  src->iradio_mode = FALSE;
  src->timeout = 0;
  src->extra_headers = NULL;
  src->is_live = FALSE;
  src->ssl_strict = FALSE;
  src->ca_file = g_strdup (DEFAULT_CA_FILE);

  src->lock = g_mutex_new ();
  src->cond = g_cond_new ();
  src->queue = g_queue_new ();
  src->state = WORKER_IDLE;
  src->seekable = TRUE;
  src->request_position = 0;
  src->read_position = 0;
  gst_curl_http_src_reset_transfer_info (src);

  gst_base_src_set_format (GST_BASE_SRC (src), GST_FORMAT_BYTES);
  gst_base_src_set_blocksize (GST_BASE_SRC (src), CURL_BUFFER_SIZE);
}

static void
gst_curl_http_src_clear_queue (GstCurlHttpSrc * src)
{
  GstBuffer *b;
  while ((b = g_queue_pop_head (src->queue)))
    gst_buffer_unref (b);
  src->queued_bytes = 0;
}

static void
gst_curl_http_src_finalize (GObject * gobject)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (gobject);

  gst_curl_http_src_stop_worker (src);
  gst_curl_http_src_clear_queue (src);
  g_queue_free (src->queue);
  g_mutex_free (src->lock);
  g_cond_free (src->cond);
  g_free (src->location);
  g_free (src->user_agent);
  g_free (src->proxy);
  g_strfreev (src->cookies);
  g_free (src->iradio_name);
  g_free (src->iradio_genre);
  g_free (src->iradio_url);
  g_free (src->iradio_title);
  g_free (src->ca_file);
  g_free (src->content_type);
  g_free (src->error_msg);
  if (src->extra_headers)
    gst_structure_free (src->extra_headers);
  if (src->src_caps)
    gst_caps_unref (src->src_caps);
  if (src->tags)
    gst_tag_list_free (src->tags);

  G_OBJECT_CLASS (parent_class)->finalize (gobject);
}

static void
gst_curl_http_src_set_property (GObject * object, guint prop_id, const GValue * value, GParamSpec * pspec)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (object);

  switch (prop_id) {
    case PROP_LOCATION:{
      const gchar *location = g_value_get_string (value);
      if (location == NULL) {
        GST_WARNING ("location property cannot be NULL");
        break;
      }
      if (!gst_curl_http_src_set_location (src, location))
        GST_WARNING ("badly formatted location");
      break;
    }
    case PROP_USER_AGENT:
      g_free (src->user_agent);
      src->user_agent = g_value_dup_string (value);
      break;
    case PROP_AUTOMATIC_REDIRECT:
      src->automatic_redirect = g_value_get_boolean (value);
      break;
    case PROP_PROXY:
      g_free (src->proxy);
      src->proxy = g_value_dup_string (value);
      break;
    case PROP_COOKIES:
      g_strfreev (src->cookies);
      src->cookies = g_strdupv (g_value_get_boxed (value));
      break;
    case PROP_IS_LIVE:
      src->is_live = g_value_get_boolean (value);
      gst_base_src_set_live (GST_BASE_SRC (src), src->is_live);
      break;
    case PROP_IRADIO_MODE:
      src->iradio_mode = g_value_get_boolean (value);
      break;
    case PROP_TIMEOUT:
      src->timeout = g_value_get_uint (value);
      break;
    case PROP_EXTRA_HEADERS:{
      const GstStructure *s = gst_value_get_structure (value);
      if (src->extra_headers)
        gst_structure_free (src->extra_headers);
      src->extra_headers = s ? gst_structure_copy (s) : NULL;
      break;
    }
    case PROP_SSL_STRICT:
      src->ssl_strict = g_value_get_boolean (value);
      break;
    case PROP_CA_FILE:
      g_free (src->ca_file);
      src->ca_file = g_value_dup_string (value);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
  }
}

static void
gst_curl_http_src_get_property (GObject * object, guint prop_id, GValue * value, GParamSpec * pspec)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (object);

  switch (prop_id) {
    case PROP_LOCATION:
      g_value_set_string (value, src->location);
      break;
    case PROP_USER_AGENT:
      g_value_set_string (value, src->user_agent);
      break;
    case PROP_AUTOMATIC_REDIRECT:
      g_value_set_boolean (value, src->automatic_redirect);
      break;
    case PROP_PROXY:
      g_value_set_string (value, src->proxy ? src->proxy : "");
      break;
    case PROP_COOKIES:
      g_value_set_boxed (value, g_strdupv (src->cookies));
      break;
    case PROP_IS_LIVE:
      g_value_set_boolean (value, src->is_live);
      break;
    case PROP_IRADIO_MODE:
      g_value_set_boolean (value, src->iradio_mode);
      break;
    case PROP_IRADIO_NAME:
      g_value_set_string (value, src->iradio_name);
      break;
    case PROP_IRADIO_GENRE:
      g_value_set_string (value, src->iradio_genre);
      break;
    case PROP_IRADIO_URL:
      g_value_set_string (value, src->iradio_url);
      break;
    case PROP_IRADIO_TITLE:
      g_value_set_string (value, src->iradio_title);
      break;
    case PROP_TIMEOUT:
      g_value_set_uint (value, src->timeout);
      break;
    case PROP_EXTRA_HEADERS:
      gst_value_set_structure (value, src->extra_headers);
      break;
    case PROP_SSL_STRICT:
      g_value_set_boolean (value, src->ssl_strict);
      break;
    case PROP_CA_FILE:
      g_value_set_string (value, src->ca_file);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
      break;
  }
}

static gboolean
gst_curl_http_src_set_location (GstCurlHttpSrc * src, const gchar * uri)
{
  if (!g_str_has_prefix (uri, "http://") && !g_str_has_prefix (uri, "https://"))
    return FALSE;
  g_free (src->location);
  src->location = g_strdup (uri);
  return TRUE;
}

/* ---- worker thread ---------------------------------------------------- */

/* Header lines arrive one per call, for every hop when redirects are followed.
 * A status line resets the per-response fields, so only the final response
 * counts. Runs on the worker thread; touches nothing the streaming thread reads
 * without the lock except at headers_done, which is set under the lock. */
static size_t
header_cb (char *buffer, size_t size, size_t nitems, void *userdata)
{
  GstCurlHttpSrc *src = userdata;
  size_t len = size * nitems;
  gchar *line, *colon, *name, *value;

  line = g_strndup (buffer, len);
  g_strchomp (line);

  if (g_str_has_prefix (line, "HTTP/")) {
    /* new response (initial or after a redirect) */
    src->response_code = 0;
    src->got_content_range = FALSE;
    src->content_length = 0;
    src->accept_ranges = FALSE;
    src->icy_metaint = 0;
    g_free (src->content_type);
    src->content_type = NULL;
    if (sscanf (line, "HTTP/%*s %ld", &src->response_code) != 1)
      src->response_code = 0;
    GST_DEBUG_OBJECT (src, "status: %s", line);
    TRACE ("status: %s", line);
    g_free (line);
    return len;
  }
  if (g_str_has_prefix (line, "ICY ")) {   /* shoutcast servers */
    src->response_code = 200;
    g_free (line);
    return len;
  }

  colon = strchr (line, ':');
  if (colon == NULL) {
    g_free (line);
    return len;
  }
  *colon = '\0';
  name = g_strstrip (line);
  value = g_strstrip (colon + 1);

  if (g_ascii_strcasecmp (name, "Content-Length") == 0) {
    src->content_length = g_ascii_strtoull (value, NULL, 10);
  } else if (g_ascii_strcasecmp (name, "Content-Range") == 0) {
    guint64 first = 0, last = 0, total = 0;
    if (sscanf (value, "bytes %" G_GUINT64_FORMAT "-%" G_GUINT64_FORMAT "/%" G_GUINT64_FORMAT,
            &first, &last, &total) == 3) {
      src->got_content_range = TRUE;
      src->content_length = total - first;      /* remaining from first */
      GST_DEBUG_OBJECT (src, "Content-Range %" G_GUINT64_FORMAT "-%" G_GUINT64_FORMAT
          "/%" G_GUINT64_FORMAT, first, last, total);
    }
  } else if (g_ascii_strcasecmp (name, "Accept-Ranges") == 0) {
    src->accept_ranges = (g_ascii_strncasecmp (value, "bytes", 5) == 0);
  } else if (g_ascii_strcasecmp (name, "Content-Type") == 0) {
    g_free (src->content_type);
    src->content_type = g_strdup (value);
  } else if (g_ascii_strcasecmp (name, "icy-metaint") == 0) {
    src->icy_metaint = atoi (value);
  } else if (g_ascii_strcasecmp (name, "icy-name") == 0) {
    g_free (src->iradio_name);
    src->iradio_name = g_strdup (value);
  } else if (g_ascii_strcasecmp (name, "icy-genre") == 0) {
    g_free (src->iradio_genre);
    src->iradio_genre = g_strdup (value);
  } else if (g_ascii_strcasecmp (name, "icy-url") == 0) {
    g_free (src->iradio_url);
    src->iradio_url = g_strdup (value);
  }

  g_free (line);
  return len;
}

/* First body byte of the final response: settle size, seekability, caps. */
static gboolean
headers_done (GstCurlHttpSrc * src)
{
  GstTagList *tags;
  guint64 newsize;

  g_mutex_lock (src->lock);
  src->headers_done = TRUE;

  if (src->response_code >= 400) {
    g_free (src->error_msg);
    src->error_msg = g_strdup_printf ("Server returned HTTP %ld", src->response_code);
    g_mutex_unlock (src->lock);
    return FALSE;
  }

  if (src->request_position > 0 && src->response_code == 200) {
    /* asked for a Range, got the whole file: skip to where we wanted to be and
     * stop pretending this server can seek */
    GST_WARNING_OBJECT (src, "server ignored Range, skipping %" G_GUINT64_FORMAT " bytes",
        src->request_position);
    src->skip = src->request_position;
    src->seekable = FALSE;
    src->read_position = 0;
  } else {
    src->skip = 0;
    src->read_position = src->request_position;
  }

  if (src->content_length > 0) {
    newsize = (src->response_code == 206 || src->got_content_range)
        ? src->request_position + src->content_length : src->content_length;
    if (!src->have_size || src->content_size != newsize) {
      src->content_size = newsize;
      src->have_size = TRUE;
      GST_DEBUG_OBJECT (src, "size = %" G_GUINT64_FORMAT, src->content_size);
      gst_segment_set_duration (&GST_BASE_SRC (src)->segment, GST_FORMAT_BYTES, src->content_size);
      gst_element_post_message (GST_ELEMENT (src),
          gst_message_new_duration (GST_OBJECT (src), GST_FORMAT_BYTES, src->content_size));
    }
  }

  /* caps: application/x-icy when the server interleaves metadata, else nothing
   * (typefind decides), with the content-type as a hint like souphttpsrc */
  if (src->src_caps) {
    gst_caps_unref (src->src_caps);
    src->src_caps = NULL;
  }
  if (src->icy_metaint > 0)
    src->src_caps = gst_caps_new_simple ("application/x-icy",
        "metadata-interval", G_TYPE_INT, src->icy_metaint, NULL);
  if (src->src_caps && src->content_type)
    gst_caps_set_simple (src->src_caps, "content-type", G_TYPE_STRING, src->content_type, NULL);

  tags = gst_tag_list_new ();
  if (src->iradio_name)
    gst_tag_list_add (tags, GST_TAG_MERGE_REPLACE, GST_TAG_ORGANIZATION, src->iradio_name, NULL);
  if (src->iradio_genre)
    gst_tag_list_add (tags, GST_TAG_MERGE_REPLACE, GST_TAG_GENRE, src->iradio_genre, NULL);
  if (src->iradio_url)
    gst_tag_list_add (tags, GST_TAG_MERGE_REPLACE, GST_TAG_LOCATION, src->iradio_url, NULL);
  if (!gst_tag_list_is_empty (tags)) {
    if (src->tags)
      gst_tag_list_free (src->tags);
    src->tags = tags;
  } else {
    gst_tag_list_free (tags);
  }

  g_mutex_unlock (src->lock);
  return TRUE;
}

static size_t
write_cb (char *ptr, size_t size, size_t nmemb, void *userdata)
{
  GstCurlHttpSrc *src = userdata;
  size_t len = size * nmemb;
  GstBuffer *buf;

  if (!src->headers_done) {
    if (!headers_done (src))
      return 0;                 /* -> CURLE_WRITE_ERROR; error_msg already set */
  }

  g_mutex_lock (src->lock);
  if (src->skip > 0) {
    if (len <= src->skip) {
      src->skip -= len;
      g_mutex_unlock (src->lock);
      return len;
    }
    ptr += src->skip;
    len -= src->skip;
    src->skip = 0;
  }
  /* bounded queue: block the transfer while the pipeline is not consuming */
  while (src->queued_bytes >= QUEUE_MAX_BYTES && !src->abort)
    g_cond_wait (src->cond, src->lock);
  if (src->abort) {
    g_mutex_unlock (src->lock);
    return 0;
  }
  buf = gst_buffer_new_and_alloc (len);
  memcpy (GST_BUFFER_DATA (buf), ptr, len);
  GST_BUFFER_OFFSET (buf) = src->read_position;
  src->read_position += len;
  GST_BUFFER_OFFSET_END (buf) = src->read_position;
  g_queue_push_tail (src->queue, buf);
  src->queued_bytes += len;
  g_cond_broadcast (src->cond);
  g_mutex_unlock (src->lock);
  return len;
}

static int
progress_cb (void *clientp, curl_off_t dltotal, curl_off_t dlnow, curl_off_t ultotal, curl_off_t ulnow)
{
  GstCurlHttpSrc *src = clientp;
  return src->abort ? 1 : 0;    /* non-zero aborts with CURLE_ABORTED_BY_CALLBACK */
}

static gboolean
add_header_field (GQuark field_id, const GValue * value, gpointer user_data)
{
  struct curl_slist **headers = user_data;
  const gchar *name = g_quark_to_string (field_id);
  gchar *line = NULL;

  if (G_VALUE_HOLDS_STRING (value))
    line = g_strdup_printf ("%s: %s", name, g_value_get_string (value));
  else if (G_VALUE_HOLDS_INT (value))
    line = g_strdup_printf ("%s: %d", name, g_value_get_int (value));
  else if (G_VALUE_HOLDS_BOOLEAN (value))
    line = g_strdup_printf ("%s: %s", name, g_value_get_boolean (value) ? "true" : "false");
  if (line) {
    *headers = CURLF.slist_append (*headers, line);
    g_free (line);
  }
  return TRUE;
}

static gpointer
worker_func (gpointer data)
{
  GstCurlHttpSrc *src = data;
  CURL *curl;
  CURLcode res;
  struct curl_slist *headers = NULL;
  gchar *range = NULL, *cookie = NULL;
  char errbuf[CURL_ERROR_SIZE] = "";
  guint64 start;

  g_mutex_lock (src->lock);
  start = src->request_position;
  g_mutex_unlock (src->lock);
  gst_curl_http_src_reset_transfer_info (src);

  curl = CURLF.easy_init ();
  if (!curl) {
    g_mutex_lock (src->lock);
    src->error_msg = g_strdup ("curl_easy_init failed");
    src->state = WORKER_ERROR;
    g_cond_broadcast (src->cond);
    g_mutex_unlock (src->lock);
    return NULL;
  }

  CURLF.easy_setopt (curl, CURLOPT_URL, src->location);
  CURLF.easy_setopt (curl, CURLOPT_USERAGENT, src->user_agent ? src->user_agent : DEFAULT_USER_AGENT);
  CURLF.easy_setopt (curl, CURLOPT_FOLLOWLOCATION, src->automatic_redirect ? 1L : 0L);
  CURLF.easy_setopt (curl, CURLOPT_MAXREDIRS, (long) MAX_REDIRECTS);
  CURLF.easy_setopt (curl, CURLOPT_NOSIGNAL, 1L);
  CURLF.easy_setopt (curl, CURLOPT_CONNECTTIMEOUT, (long) CONNECT_TIMEOUT_SECS);
  CURLF.easy_setopt (curl, CURLOPT_BUFFERSIZE, (long) CURL_BUFFER_SIZE);
  CURLF.easy_setopt (curl, CURLOPT_HTTP_VERSION, (long) CURL_HTTP_VERSION_1_1);
  CURLF.easy_setopt (curl, CURLOPT_ACCEPT_ENCODING, "identity");   /* never compress media */
  CURLF.easy_setopt (curl, CURLOPT_HEADERFUNCTION, header_cb);
  CURLF.easy_setopt (curl, CURLOPT_HEADERDATA, src);
  CURLF.easy_setopt (curl, CURLOPT_WRITEFUNCTION, write_cb);
  CURLF.easy_setopt (curl, CURLOPT_WRITEDATA, src);
  CURLF.easy_setopt (curl, CURLOPT_XFERINFOFUNCTION, progress_cb);
  CURLF.easy_setopt (curl, CURLOPT_XFERINFODATA, src);
  CURLF.easy_setopt (curl, CURLOPT_NOPROGRESS, 0L);
  CURLF.easy_setopt (curl, CURLOPT_ERRORBUFFER, errbuf);
  if (src->timeout > 0) {
    CURLF.easy_setopt (curl, CURLOPT_LOW_SPEED_LIMIT, 1L);
    CURLF.easy_setopt (curl, CURLOPT_LOW_SPEED_TIME, (long) src->timeout);
  }
  if (src->proxy && *src->proxy)
    CURLF.easy_setopt (curl, CURLOPT_PROXY, src->proxy);     /* else libcurl honours http_proxy */
  if (src->ssl_strict) {
    CURLF.easy_setopt (curl, CURLOPT_SSL_VERIFYPEER, 1L);
    CURLF.easy_setopt (curl, CURLOPT_SSL_VERIFYHOST, 2L);
    if (src->ca_file && *src->ca_file)
      CURLF.easy_setopt (curl, CURLOPT_CAINFO, src->ca_file);
  } else {
    CURLF.easy_setopt (curl, CURLOPT_SSL_VERIFYPEER, 0L);
    CURLF.easy_setopt (curl, CURLOPT_SSL_VERIFYHOST, 0L);
  }
  if (start > 0) {
    range = g_strdup_printf ("%" G_GUINT64_FORMAT "-", start);
    CURLF.easy_setopt (curl, CURLOPT_RANGE, range);
  }
  if (src->cookies && src->cookies[0]) {
    /* souphttpsrc takes full Set-Cookie strings; libcurl wants "a=b; c=d" */
    GString *s = g_string_new (NULL);
    gchar **c;
    for (c = src->cookies; *c; c++) {
      gchar *semi = strchr (*c, ';');
      if (s->len)
        g_string_append (s, "; ");
      g_string_append_len (s, *c, semi ? (gssize) (semi - *c) : (gssize) strlen (*c));
    }
    cookie = g_string_free (s, FALSE);
    CURLF.easy_setopt (curl, CURLOPT_COOKIE, cookie);
  }
  if (src->iradio_mode)
    headers = CURLF.slist_append (headers, "icy-metadata: 1");
  if (src->extra_headers)
    gst_structure_foreach (src->extra_headers, add_header_field, &headers);
  if (headers)
    CURLF.easy_setopt (curl, CURLOPT_HTTPHEADER, headers);

  GST_DEBUG_OBJECT (src, "GET %s from %" G_GUINT64_FORMAT, src->location, start);
  TRACE ("GET from %" G_GUINT64_FORMAT, start);
  res = CURLF.easy_perform (curl);
  {
    double dns = 0, conn = 0, tls = 0, first = 0, total = 0;
    char *ip = NULL;
    long port = 0;
    CURLF.easy_getinfo (curl, CURLINFO_NAMELOOKUP_TIME, &dns);
    CURLF.easy_getinfo (curl, CURLINFO_CONNECT_TIME, &conn);
    CURLF.easy_getinfo (curl, CURLINFO_APPCONNECT_TIME, &tls);
    CURLF.easy_getinfo (curl, CURLINFO_STARTTRANSFER_TIME, &first);
    CURLF.easy_getinfo (curl, CURLINFO_TOTAL_TIME, &total);
    CURLF.easy_getinfo (curl, CURLINFO_PRIMARY_IP, &ip);
    CURLF.easy_getinfo (curl, CURLINFO_PRIMARY_PORT, &port);
    TRACE ("GET from %" G_GUINT64_FORMAT " done: curl %d (%s%s%s) http %ld ip %s:%ld dns %.2f conn %.2f tls %.2f first %.2f total %.2f abort %d",
        start, (int) res, CURLF.easy_strerror (res), errbuf[0] ? ": " : "", errbuf,
        src->response_code, ip ? ip : "-", port, dns, conn, tls, first, total, src->abort);
  }

  g_mutex_lock (src->lock);
  if (src->abort) {
    /* a seek or stop asked for this; the caller resets the state */
    GST_DEBUG_OBJECT (src, "transfer aborted");
  } else if (res == CURLE_OK) {
    if (!src->headers_done && src->response_code >= 400) {
      g_free (src->error_msg);
      src->error_msg = g_strdup_printf ("Server returned HTTP %ld", src->response_code);
      src->state = WORKER_ERROR;
    } else {
      src->state = WORKER_DONE;
    }
  } else if (res == CURLE_WRITE_ERROR && src->error_msg) {
    src->state = WORKER_ERROR;  /* headers_done refused (4xx/5xx) */
  } else {
    g_free (src->error_msg);
    src->error_msg = g_strdup_printf ("%s (curl %d%s%s)", CURLF.easy_strerror (res), (int) res,
        errbuf[0] ? ": " : "", errbuf);
    src->state = WORKER_ERROR;
  }
  g_cond_broadcast (src->cond);
  g_mutex_unlock (src->lock);

  CURLF.easy_cleanup (curl);
  if (headers)
    CURLF.slist_free_all (headers);
  g_free (range);
  g_free (cookie);
  return NULL;
}

/* lock held */
static gboolean
gst_curl_http_src_start_worker (GstCurlHttpSrc * src)
{
  GError *err = NULL;
  src->abort = FALSE;
  src->state = WORKER_RUNNING;
  g_free (src->error_msg);
  src->error_msg = NULL;
  src->thread = g_thread_create (worker_func, src, TRUE, &err);
  if (!src->thread) {
    src->state = WORKER_ERROR;
    src->error_msg = g_strdup_printf ("could not start transfer thread: %s", err ? err->message : "?");
    if (err)
      g_error_free (err);
    return FALSE;
  }
  return TRUE;
}

/* lock NOT held */
static void
gst_curl_http_src_stop_worker (GstCurlHttpSrc * src)
{
  GThread *t;

  g_mutex_lock (src->lock);
  src->abort = TRUE;
  g_cond_broadcast (src->cond);
  t = src->thread;
  src->thread = NULL;
  g_mutex_unlock (src->lock);
  if (t)
    g_thread_join (t);
  g_mutex_lock (src->lock);
  gst_curl_http_src_clear_queue (src);
  src->state = WORKER_IDLE;
  src->abort = FALSE;
  g_mutex_unlock (src->lock);
}

/* ---- GstBaseSrc / GstPushSrc ------------------------------------------ */

static gboolean
gst_curl_http_src_start (GstBaseSrc * bsrc)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);

  if (!src->location) {
    GST_ELEMENT_ERROR (src, RESOURCE, OPEN_READ, (NULL), ("No URL set."));
    return FALSE;
  }
  TRACE ("start %s", src->location);
  g_mutex_lock (src->lock);
  src->request_position = 0;
  src->read_position = 0;
  src->have_size = FALSE;
  src->content_size = 0;
  src->seekable = TRUE;
  src->flushing = FALSE;
  g_mutex_unlock (src->lock);
  return TRUE;
}

static gboolean
gst_curl_http_src_stop (GstBaseSrc * bsrc)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);
  TRACE ("stop");
  gst_curl_http_src_stop_worker (src);
  TRACE ("stopped");
  return TRUE;
}

static gboolean
gst_curl_http_src_unlock (GstBaseSrc * bsrc)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);
  g_mutex_lock (src->lock);
  src->flushing = TRUE;
  g_cond_broadcast (src->cond);
  g_mutex_unlock (src->lock);
  return TRUE;
}

static gboolean
gst_curl_http_src_unlock_stop (GstBaseSrc * bsrc)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);
  g_mutex_lock (src->lock);
  src->flushing = FALSE;
  g_mutex_unlock (src->lock);
  return TRUE;
}

static gboolean
gst_curl_http_src_get_size (GstBaseSrc * bsrc, guint64 * size)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);
  gboolean ret;
  g_mutex_lock (src->lock);
  ret = src->have_size;
  if (ret)
    *size = src->content_size;
  g_mutex_unlock (src->lock);
  return ret;
}

static gboolean
gst_curl_http_src_is_seekable (GstBaseSrc * bsrc)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);
  return src->seekable;
}

static gboolean
gst_curl_http_src_do_seek (GstBaseSrc * bsrc, GstSegment * segment)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (bsrc);

  GST_DEBUG_OBJECT (src, "seek to %" G_GINT64_FORMAT, segment->start);
  TRACE ("seek to %" G_GINT64_FORMAT " (seekable=%d)", segment->start, src->seekable);
  if (!src->seekable)
    return FALSE;
  if (src->have_size && (guint64) segment->start >= src->content_size)
    return FALSE;

  /* nothing to do if the transfer already sits at that offset */
  g_mutex_lock (src->lock);
  if (src->state == WORKER_IDLE && src->request_position == (guint64) segment->start) {
    g_mutex_unlock (src->lock);
    return TRUE;
  }
  g_mutex_unlock (src->lock);

  gst_curl_http_src_stop_worker (src);
  g_mutex_lock (src->lock);
  src->request_position = segment->start;
  src->read_position = segment->start;
  g_mutex_unlock (src->lock);
  return TRUE;
}

static GstFlowReturn
gst_curl_http_src_create (GstPushSrc * psrc, GstBuffer ** outbuf)
{
  GstCurlHttpSrc *src = GST_CURL_HTTP_SRC (psrc);
  GstBuffer *buf = NULL;
  GstTagList *tags = NULL;
  GstFlowReturn ret = GST_FLOW_OK;

  g_mutex_lock (src->lock);
  if (src->state == WORKER_IDLE && !src->flushing) {
    TRACE ("transfer start at %" G_GUINT64_FORMAT, src->request_position);
    if (!gst_curl_http_src_start_worker (src)) {
      g_mutex_unlock (src->lock);
      goto error;
    }
  }
  for (;;) {
    if (src->flushing) {
      g_mutex_unlock (src->lock);
      return GST_FLOW_WRONG_STATE;
    }
    buf = g_queue_pop_head (src->queue);
    if (buf) {
      src->queued_bytes -= GST_BUFFER_SIZE (buf);
      g_cond_broadcast (src->cond);       /* wake a worker blocked on the full queue */
      break;
    }
    if (src->state == WORKER_DONE) {
      GThread *t = src->thread;
      src->thread = NULL;
      src->state = WORKER_IDLE;           /* next create() after a seek starts again */
      g_mutex_unlock (src->lock);
      if (t)
        g_thread_join (t);                /* already finished: reap it before a restart makes a new one */
      return GST_FLOW_UNEXPECTED;         /* EOS */
    }
    if (src->state == WORKER_ERROR) {
      g_mutex_unlock (src->lock);
      goto error;
    }
    g_cond_wait (src->cond, src->lock);
  }
  if (src->tags) {
    tags = src->tags;
    src->tags = NULL;
  }
  if (src->src_caps)
    gst_buffer_set_caps (buf, src->src_caps);
  g_mutex_unlock (src->lock);

  if (tags)
    gst_element_found_tags_for_pad (GST_ELEMENT (src), GST_BASE_SRC_PAD (src), tags);

  *outbuf = buf;
  return ret;

error:
  {
    gchar *msg;
    g_mutex_lock (src->lock);
    msg = g_strdup (src->error_msg ? src->error_msg : "unknown error");
    if (src->thread) {
      GThread *t = src->thread;
      src->thread = NULL;
      g_mutex_unlock (src->lock);
      g_thread_join (t);
    } else {
      g_mutex_unlock (src->lock);
    }
    GST_ELEMENT_ERROR (src, RESOURCE, READ, ("Could not read from %s", src->location),
        ("%s", msg));
    g_free (msg);
    return GST_FLOW_ERROR;
  }
}

/* ---- URI handler ------------------------------------------------------- */

static GstURIType
gst_curl_http_src_uri_get_type (void)
{
  return GST_URI_SRC;
}

static gchar **
gst_curl_http_src_uri_get_protocols (void)
{
  static gchar *protocols[] = { (gchar *) "http", (gchar *) "https", NULL };
  return protocols;
}

static const gchar *
gst_curl_http_src_uri_get_uri (GstURIHandler * handler)
{
  return GST_CURL_HTTP_SRC (handler)->location;
}

static gboolean
gst_curl_http_src_uri_set_uri (GstURIHandler * handler, const gchar * uri)
{
  return gst_curl_http_src_set_location (GST_CURL_HTTP_SRC (handler), uri);
}

static void
gst_curl_http_src_uri_handler_init (gpointer g_iface, gpointer iface_data)
{
  GstURIHandlerInterface *iface = (GstURIHandlerInterface *) g_iface;
  iface->get_type = gst_curl_http_src_uri_get_type;
  iface->get_protocols = gst_curl_http_src_uri_get_protocols;
  iface->get_uri = gst_curl_http_src_uri_get_uri;
  iface->set_uri = gst_curl_http_src_uri_set_uri;
}

/* ---- plugin ------------------------------------------------------------ */

static gboolean
plugin_init (GstPlugin * plugin)
{
  if (!load_private_curl ())
    return FALSE;
  CURLF.global_init (CURL_GLOBAL_ALL);
  TRACE ("plugin_init, %s", CURLF.version ());
  /* registered under the stock element's name: media-pipeline makes it by name */
  return gst_element_register (plugin, "souphttpsrc", GST_RANK_PRIMARY, GST_TYPE_CURL_HTTP_SRC);
}

GST_PLUGIN_DEFINE (GST_VERSION_MAJOR, GST_VERSION_MINOR,
    "curlhttpsrc", "libcurl-based souphttpsrc replacement (TLS 1.3, SNI) for webOS CE",
    plugin_init, VERSION, "LGPL", PACKAGE, "https://github.com/webosarchive")
