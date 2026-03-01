package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/opsyhq/claw/pincer/rpc"
)

const Version = "0.1.5"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--version" {
		fmt.Println(Version)
		os.Exit(0)
	}

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0), 10*1024*1024) // 10MB buffer

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var req rpc.Request
		if err := json.Unmarshal(line, &req); err != nil {
			resp := rpc.ErrorResponse(0, fmt.Sprintf("invalid JSON: %v", err))
			writeResponse(resp)
			continue
		}

		resp := rpc.Dispatch(&req)
		writeResponse(resp)
	}
}

func writeResponse(resp *rpc.Response) {
	data, _ := json.Marshal(resp)
	fmt.Println(string(data))
}
