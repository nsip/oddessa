
cd tools; go build release.go; cd ..
./tools/release oddessa oddessa-Mac.zip build/oddessa-Mac.zip
./tools/release oddessa oddessa-Win64.zip build/oddessa-Win64.zip
./tools/release oddessa oddessa-Win32.zip build/oddessa-Win32.zip
./tools/release oddessa oddessa-Linux64.zip build/oddessa-Linux64.zip
./tools/release oddessa oddessa-Linux32.zip build/oddessa-Linux32.zip
