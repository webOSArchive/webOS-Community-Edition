#!/bin/bash
palm-package . --exclude="mock"
novacom run "file:///bin/rm /tmp/com.palm.app.photos.ipk"
novacom put file:///tmp/com.palm.app.photos.ipk < com.palm.app.photos*.ipk
novacom run "file:///usr/bin/ipkg -o /media/cryptofs/apps remove com.palm.app.photos"
novacom run "file:///usr/bin/ipkg remove com.palm.app.photos"
novacom run "file:///usr/bin/ipkg -o /media/cryptofs/apps install /tmp/com.palm.app.photos.ipk"
novacom run "file:///usr/bin/luna-send -n 1 luna://com.palm.applicationManager/rescan '{}' -f"