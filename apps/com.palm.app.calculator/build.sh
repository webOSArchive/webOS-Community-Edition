#!/bin/sh

# This is a test package to facilitate packaging the application outside of the 
# OE build environment.  Please contact Matthew Tippett or Ken Huang if the
# existance of this file 

# we'll need to move the submission number and deal with that appropraitely
echo "env is set to "
set
echo "Checking for BuildResults directory"
ls `pwd`

echo "Making BuildResults Directory"
mkdir `pwd`/BuildResults

echo "Attempting to build the package"
palm-package `pwd`/build-dir/trunk -o `pwd`/BuildResults
