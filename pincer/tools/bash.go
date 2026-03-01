package tools

import (
	"bytes"
	"context"
	"os/exec"
	"time"
)

type BashParams struct {
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"` // milliseconds
}

func Bash(p *BashParams) (*Result, error) {
	timeout := 120 * time.Second
	if p.Timeout > 0 {
		timeout = time.Duration(p.Timeout) * time.Millisecond
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "/bin/bash", "-c", p.Command)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	if output == "" {
		output = "(no output)"
	}

	if err != nil && stdout.Len() == 0 && stderr.Len() == 0 {
		return &Result{Content: "Error: " + err.Error(), IsError: true}, nil
	}

	return &Result{Content: output, IsError: err != nil}, nil
}
