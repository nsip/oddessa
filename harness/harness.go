// harness.go

// test harness for oddessa

package main

import (
	"github.com/nsip/oddessa/lib"
	"log"
	"runtime"
)

func main() {

	log.Println("Starting oddessa web services...")
	ws := &oddessa.ODDESSAWebServer{}
	go ws.Run()
	log.Println("...web services running")

	runtime.Goexit()

}
