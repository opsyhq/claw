package tools

import (
	"fmt"
	"os"
	"strings"
)

type LsParams struct {
	Path string `json:"path"`
}

func Ls(p *LsParams) (*Result, error) {
	entries, err := os.ReadDir(p.Path)
	if err != nil {
		return &Result{Content: "Error listing directory: " + err.Error(), IsError: true}, nil
	}

	if len(entries) == 0 {
		return &Result{Content: "(empty directory)"}, nil
	}

	var lines []string
	for _, entry := range entries {
		prefix := "[FILE]"
		size := ""

		if entry.IsDir() {
			prefix = "[DIR]"
		} else {
			info, err := entry.Info()
			if err == nil {
				size = fmt.Sprintf(" (%s)", formatSize(info.Size()))
			}
		}

		lines = append(lines, fmt.Sprintf("%s %s%s", prefix, entry.Name(), size))
	}

	return &Result{Content: strings.Join(lines, "\n")}, nil
}

func formatSize(bytes int64) string {
	switch {
	case bytes < 1024:
		return fmt.Sprintf("%dB", bytes)
	case bytes < 1024*1024:
		return fmt.Sprintf("%.1fKB", float64(bytes)/1024)
	case bytes < 1024*1024*1024:
		return fmt.Sprintf("%.1fMB", float64(bytes)/(1024*1024))
	default:
		return fmt.Sprintf("%.1fGB", float64(bytes)/(1024*1024*1024))
	}
}
