package tools

import (
	"fmt"
	"os"
	"path/filepath"
)

type WriteParams struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func Write(p *WriteParams) (*Result, error) {
	dir := filepath.Dir(p.Path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return &Result{Content: "Error creating directory: " + err.Error(), IsError: true}, nil
	}

	if err := os.WriteFile(p.Path, []byte(p.Content), 0644); err != nil {
		return &Result{Content: "Error writing file: " + err.Error(), IsError: true}, nil
	}

	return &Result{Content: fmt.Sprintf("Successfully wrote to %s", p.Path)}, nil
}
