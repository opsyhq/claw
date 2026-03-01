package tools

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type GrepParams struct {
	Pattern string `json:"pattern"`
	Path    string `json:"path,omitempty"`
	Include string `json:"include,omitempty"`
}

const maxGrepResults = 1000

func Grep(p *GrepParams) (*Result, error) {
	searchPath := p.Path
	if searchPath == "" {
		var err error
		searchPath, err = os.Getwd()
		if err != nil {
			return &Result{Content: "Error: " + err.Error(), IsError: true}, nil
		}
	}

	re, err := regexp.Compile(p.Pattern)
	if err != nil {
		return &Result{Content: "Invalid regex: " + err.Error(), IsError: true}, nil
	}

	var matches []string

	err = filepath.Walk(searchPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip errors
		}
		if len(matches) >= maxGrepResults {
			return filepath.SkipAll
		}

		// Skip directories
		if info.IsDir() {
			base := filepath.Base(path)
			if base == ".git" || base == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}

		// Apply include filter
		if p.Include != "" {
			matched, _ := filepath.Match(p.Include, filepath.Base(path))
			if !matched {
				return nil
			}
		}

		// Skip large files (>1MB)
		if info.Size() > 1024*1024 {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()
			if re.MatchString(line) {
				relPath, _ := filepath.Rel(searchPath, path)
				matches = append(matches, fmt.Sprintf("%s:%d:%s", relPath, lineNum, line))
				if len(matches) >= maxGrepResults {
					break
				}
			}
		}

		return nil
	})

	if err != nil {
		return &Result{Content: "Error: " + err.Error(), IsError: true}, nil
	}

	if len(matches) == 0 {
		return &Result{Content: "No matches found."}, nil
	}

	output := strings.Join(matches, "\n")
	if len(matches) >= maxGrepResults {
		output += fmt.Sprintf("\n\n(results truncated at %d matches)", maxGrepResults)
	}

	return &Result{Content: output}, nil
}
