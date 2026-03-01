package tools

import (
	"fmt"
	"os"
	"strings"
)

type ReadParams struct {
	Path   string `json:"path"`
	Offset *int   `json:"offset,omitempty"`
	Limit  *int   `json:"limit,omitempty"`
}

func Read(p *ReadParams) (*Result, error) {
	data, err := os.ReadFile(p.Path)
	if err != nil {
		return &Result{Content: "Error reading file: " + err.Error(), IsError: true}, nil
	}

	lines := strings.Split(string(data), "\n")

	offset := 0
	if p.Offset != nil {
		offset = *p.Offset
	}

	limit := len(lines)
	if p.Limit != nil {
		limit = *p.Limit
	}

	end := offset + limit
	if end > len(lines) {
		end = len(lines)
	}
	if offset > len(lines) {
		offset = len(lines)
	}

	sliced := lines[offset:end]

	var numbered []string
	for i, line := range sliced {
		numbered = append(numbered, fmt.Sprintf("%d\t%s", offset+i+1, line))
	}

	return &Result{Content: strings.Join(numbered, "\n")}, nil
}
