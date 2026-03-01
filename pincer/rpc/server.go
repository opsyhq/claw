package rpc

import (
	"encoding/json"

	"github.com/opsyhq/claw/pincer/tools"
)

type Request struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
	ID     int             `json:"id"`
}

type Response struct {
	Result  any    `json:"result,omitempty"`
	Error   string `json:"error,omitempty"`
	ID      int    `json:"id"`
	IsError bool   `json:"isError,omitempty"`
}

func ErrorResponse(id int, msg string) *Response {
	return &Response{
		Error:   msg,
		ID:      id,
		IsError: true,
	}
}

func Dispatch(req *Request) *Response {
	var result *tools.Result
	var err error

	switch req.Method {
	case "bash":
		var p tools.BashParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Bash(&p)

	case "read":
		var p tools.ReadParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Read(&p)

	case "write":
		var p tools.WriteParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Write(&p)

	case "edit":
		var p tools.EditParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Edit(&p)

	case "grep":
		var p tools.GrepParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Grep(&p)

	case "glob":
		var p tools.GlobParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Glob(&p)

	case "ls":
		var p tools.LsParams
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return ErrorResponse(req.ID, "invalid params: "+err.Error())
		}
		result, err = tools.Ls(&p)

	default:
		return ErrorResponse(req.ID, "unknown method: "+req.Method)
	}

	if err != nil {
		return ErrorResponse(req.ID, err.Error())
	}

	return &Response{
		Result:  result,
		ID:      req.ID,
		IsError: result.IsError,
	}
}
