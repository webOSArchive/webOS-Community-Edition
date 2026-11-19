#!/bin/sh
# Stands in for luna-send in oauth_glue_test.c: notes what it was asked, answers what the test left.
printf '%s\n' "$*" >> "$CE_FAKE_DIR/calls"
cat "$CE_FAKE_DIR/reply"
