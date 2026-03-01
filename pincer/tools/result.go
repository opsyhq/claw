package tools

// Result is the common return type for all tool executions.
type Result struct {
	Content string `json:"content"`
	IsError bool   `json:"isError,omitempty"`
}
