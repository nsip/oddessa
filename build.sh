#!/bin/bash

set -e

CWD=`pwd`

do_build() {
	mkdir -p $OUTPUT
	cd $CWD
	cd ./harness
	go get
	GOOS="$GOOS" GOARCH="$GOARCH" go build -ldflags="$LDFLAGS" -o $OUTPUT/$HARNESS
	cd ..
	rsync -a harness/data harness/public $OUTPUT/
}

do_shells() {
	cp bin/gonias.sh $OUTPUT/
	cp bin/stopnias.sh $OUTPUT/
}

do_bats() {
	cp bin/gonias.bat $OUTPUT/
	cp bin/stopnias.bat $OUTPUT/
}

do_upx() {
	upx $OUTPUT/$HARNESS
}

do_goupx() {
	goupx $OUTPUT/$HARNESS
}

do_zip() {
	cd $OUTPUT
	cd ..
	zip -qr ../$ZIP oddessa
	cd $CWD
}

build_mac64() {
	# MAC OS X (64 only)
	echo "Building Mac binaries..."
	LDFLAGS="-s -w"
	OUTPUT=$CWD/build/Mac/oddessa
	HARNESS=harness
	ZIP=oddessa-Mac.zip
	do_build
	do_upx
	do_shells
	do_zip
	echo "...all Mac binaries built..."
}


build_windows64() {
	# WINDOWS 64
	echo "Building Windows64 binaries..."
	GOOS=windows
	GOARCH=amd64
	LDFLAGS="-s -w"
	OUTPUT=$CWD/build/Win64/oddessa
	HARNESS=harness.exe
	ZIP=oddessa-Win64.zip
	do_build
	do_upx
	do_bats
	do_zip
	echo "...all Windows64 binaries built..."
}

build_windows32() {
	# WINDOWS 32
	echo "Building Windows32 binaries..."
	GOOS=windows
	GOARCH=386
	LDFLAGS="-s -w"
	OUTPUT=$CWD/build/Win32/oddessa
	HARNESS=harness.exe
	ZIP=oddessa-Win32.zip
	do_build
	do_upx
	do_bats
	do_zip
	echo "...all Windows32 binaries built..."
}

build_linux64() {
	# LINUX 64
	echo "Building Linux64 binaries..."
	GOOS=linux
	GOARCH=amd64
	LDFLAGS="-s -w"
	OUTPUT=$CWD/build/Linux64/oddessa
	HARNESS=harness
	ZIP=oddessa-Linux64.zip
	do_build
	do_goupx
	do_shells
	do_zip
	echo "...all Linux64 binaries built..."
}

build_linux32() {
	# LINUX 32
	echo "Building Linux32 binaries..."
	GOOS=linux
	GOARCH=386
	LDFLAGS="-s -w"
	OUTPUT=$CWD/build/Linux32/oddessa
	HARNESS=harness
	ZIP=oddessa-Linux32.zip
	do_build
	do_goupx
	do_shells
	do_zip
	echo "...all Linux32 binaries built..."
}

# TODO ARM
# GOOS=linux GOARCH=arm GOARM=7 go build -o $CWD/build/LinuxArm7/go-nias/aggregator

build_mac64
build_windows64
build_windows32
build_linux64
build_linux32

