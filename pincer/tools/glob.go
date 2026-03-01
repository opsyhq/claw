package tools

import (
	"os"
	"path/filepath"
	"strings"
)

type GlobParams struct {
	Pattern string `json:"pattern"`
}

func Glob(p *GlobParams) (*Result, error) {
	// filepath.Glob doesn't support ** so we implement it with Walk
	if strings.Contains(p.Pattern, "**") {
		return globDoublestar(p.Pattern)
	}

	matches, err := filepath.Glob(p.Pattern)
	if err != nil {
		return &Result{Content: "Error: " + err.Error(), IsError: true}, nil
	}

	if len(matches) == 0 {
		return &Result{Content: "No files matched the pattern."}, nil
	}

	return &Result{Content: strings.Join(matches, "\n")}, nil
}

func globDoublestar(pattern string) (*Result, error) {
	// Split on ** to get prefix and suffix
	parts := strings.SplitN(pattern, "**", 2)
	root := filepath.Clean(parts[0])
	suffix := ""
	if len(parts) > 1 {
		suffix = strings.TrimPrefix(parts[1], "/")
		suffix = strings.TrimPrefix(suffix, string(filepath.Separator))
	}

	if root == "" || root == "." {
		root, _ = os.Getwd()
	}

	var matches []string

	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		base := filepath.Base(path)
		if info.IsDir() && (base == ".git" || base == "node_modules") {
			return filepath.SkipDir
		}

		if suffix == "" {
			matches = append(matches, path)
			return nil
		}

		matched, _ := filepath.Match(suffix, filepath.Base(path))
		if matched {
			matches = append(matches, path)
		}

		return nil
	})

	if len(matches) == 0 {
		return &Result{Content: "No files matched the pattern."}, nil
	}

	return &Result{Content: strings.Join(matches, "\n")}, nil
}
