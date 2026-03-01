package tools

import (
	"fmt"
	"os"
	"strings"
)

type EditParams struct {
	Path      string `json:"path"`
	OldString string `json:"old_string"`
	NewString string `json:"new_string"`
}

func Edit(p *EditParams) (*Result, error) {
	data, err := os.ReadFile(p.Path)
	if err != nil {
		return &Result{Content: "Error reading file: " + err.Error(), IsError: true}, nil
	}

	content := string(data)
	count := strings.Count(content, p.OldString)

	if count == 0 {
		return &Result{
			Content: fmt.Sprintf("Error: old_string not found in %s", p.Path),
			IsError: true,
		}, nil
	}

	if count > 1 {
		return &Result{
			Content: fmt.Sprintf("Error: old_string found %d times in %s. It must be unique. Provide more context to make it unique.", count, p.Path),
			IsError: true,
		}, nil
	}

	newContent := strings.Replace(content, p.OldString, p.NewString, 1)
	if err := os.WriteFile(p.Path, []byte(newContent), 0644); err != nil {
		return &Result{Content: "Error writing file: " + err.Error(), IsError: true}, nil
	}

	return &Result{Content: fmt.Sprintf("Successfully edited %s", p.Path)}, nil
}
