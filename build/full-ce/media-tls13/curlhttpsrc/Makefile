# Cross-build libgstcurlhttpsrc.so for the TouchPad (ARMv7, VFPv3, soft-float
# ABI, glibc 2.8, GStreamer 0.10.29, GLib 2.16.6) against the CE libcurl
# 7.88.1 / OpenSSL 1.1.1 in /usr/lib/ssl11.
#
# Inputs (see scripts/media-tls13-env.sh, which populates them):
#   SYSROOT  headers for glib 2.16 / gstreamer 0.10.30 (Debian armel -dev packages)
#   ROOTFS   the stock TouchPad rootfs, for the libraries we link against
#   CURLINC  curl 7.88.1 include/
#   SSL11    the CE libcurl.so.4.8.0 (+libssl/libcrypto 1.1) to link against
#
# The toolchain's glibc is newer than the device's; check-symbols fails the
# build if the .so ends up needing any GLIBC_ version the device lacks.

WORK    ?= $(abspath ../../../work/curlhttpsrc)
SYSROOT ?= $(WORK)/sysroot
ROOTFS  ?= /tmp/claude-1000/-home-jonwise-Projects-webos-doctor-ce/9b0f82ab-334a-4568-b17a-ad445a2e306f/scratchpad/tls/rootfs
CURLINC ?= $(WORK)/src/curl-7.88.1/include
SSL11   ?= $(WORK)/ssl11
OUT     ?= $(WORK)/out

TOOLCHAIN ?= /opt/gcc-linaro-4.9.4-2017.01-x86_64_arm-linux-gnueabi
CC      = $(TOOLCHAIN)/bin/arm-linux-gnueabi-gcc
READELF = $(TOOLCHAIN)/bin/arm-linux-gnueabi-readelf

CFLAGS  = -O2 -fPIC -Wall -Wno-unused-parameter \
          -march=armv7-a -mfpu=vfpv3 -mfloat-abi=softfp -mthumb-interwork \
          -fno-stack-protector -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0 \
          -DGST_DISABLE_DEPRECATED \
          -I$(SYSROOT)/usr/include/gstreamer-0.10 \
          -I$(SYSROOT)/usr/include/glib-2.0 -I$(SYSROOT)/usr/lib/glib-2.0/include \
          -I$(CURLINC)
# The rootfs ships only versioned .so.N files (and libc/libpthread "linker
# scripts" with absolute paths), so link through a directory of plain symlinks
# to the device libraries; libc/libpthread come from the toolchain and
# check-symbols proves nothing newer than the device's glibc 2.8 is required.
LINKDIR = $(OUT)/link
LDFLAGS = -shared -Wl,-soname,libgstcurlhttpsrc.so -Wl,--no-undefined -Wl,-z,defs \
          -Wl,-rpath,/usr/lib/ssl11 -Wl,--hash-style=sysv \
          -L$(LINKDIR) -Wl,-rpath-link,$(LINKDIR)
# no -lcurl: the CE libcurl is dlopen'ed privately (see load_private_curl)
LIBS    = -lgstbase-0.10 -lgstreamer-0.10 -lgobject-2.0 -lgthread-2.0 -lglib-2.0 -ldl -lpthread

TARGET  = $(OUT)/libgstcurlhttpsrc.so

all: $(TARGET) check-symbols

$(OUT):
	mkdir -p $(OUT)

$(LINKDIR): | $(OUT)
	mkdir -p $(LINKDIR)
	for l in glib-2.0 gobject-2.0 gthread-2.0 gmodule-2.0; do ln -sf $(ROOTFS)/usr/lib/lib$$l.so.0 $(LINKDIR)/lib$$l.so; done
	for l in gstreamer-0.10 gstbase-0.10; do ln -sf $(ROOTFS)/usr/lib/lib$$l.so.0 $(LINKDIR)/lib$$l.so; done
	ln -sf $(SSL11)/libcurl.so.4.8.0 $(LINKDIR)/libcurl.so
	ln -sf $(SSL11)/libssl.so.1.1 $(LINKDIR)/libssl.so.1.1
	ln -sf $(SSL11)/libcrypto.so.1.1 $(LINKDIR)/libcrypto.so.1.1
	ln -sf $(ROOTFS)/usr/lib/libz.so.1 $(LINKDIR)/libz.so.1

$(TARGET): gstcurlhttpsrc.c | $(OUT) $(LINKDIR)
	$(CC) $(CFLAGS) -o $(OUT)/gstcurlhttpsrc.o -c gstcurlhttpsrc.c
	$(CC) $(LDFLAGS) -o $@ $(OUT)/gstcurlhttpsrc.o $(LIBS)

# every GLIBC_x.y version node this .so needs must exist in the device's libc-2.8
check-symbols: $(TARGET)
	@$(READELF) -V $(TARGET) | grep -o 'GLIBC_[0-9.]*' | sort -u > $(OUT)/needs.txt
	@$(READELF) -V $(ROOTFS)/lib/libc-2.8.so | grep -o 'GLIBC_[0-9.]*' | sort -u > $(OUT)/have.txt
	@bad=$$(comm -23 $(OUT)/needs.txt $(OUT)/have.txt); \
	 if [ -n "$$bad" ]; then echo "ERROR: needs glibc versions the device lacks: $$bad"; exit 1; fi
	@echo "glibc versions OK: $$(tr '\n' ' ' < $(OUT)/needs.txt)"
	@$(READELF) -d $(TARGET) | grep -E 'NEEDED|RPATH|RUNPATH|SONAME'
	@$(READELF) -A $(TARGET) | grep -E 'Tag_(CPU_arch|ABI_VFP_args|FP_arch)'
	@ls -la $(TARGET)

clean:
	rm -rf $(OUT)

.PHONY: all check-symbols clean
