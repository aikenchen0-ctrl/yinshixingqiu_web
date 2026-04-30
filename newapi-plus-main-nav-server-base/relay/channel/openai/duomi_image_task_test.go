package openai

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestIsDuomiTaskChannel(t *testing.T) {
	cases := []struct {
		name    string
		baseURL string
		want    bool
	}{
		{name: "exact host", baseURL: "https://duomiapi.com", want: true},
		{name: "host with slash", baseURL: "https://duomiapi.com/", want: true},
		{name: "host with path", baseURL: "https://duomiapi.com/api/klingai", want: true},
		{name: "claw host", baseURL: "https://claw.dualseason.com", want: true},
		{name: "other host", baseURL: "https://example.com", want: false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: tc.baseURL,
				},
			}
			if got := isDuomiTaskChannel(info); got != tc.want {
				t.Fatalf("isDuomiTaskChannel(%q) = %v, want %v", tc.baseURL, got, tc.want)
			}
		})
	}
}

func TestParseDuomiTaskResponse(t *testing.T) {
	body := []byte(`{
		"id": "e8f3d384-d740-889b-139b-99d8171488c8",
		"state": "succeeded",
		"data": {
			"images": [
				{
					"url": "https://cdn3.dmiapi.com/attachments/video/aivideo/output.png",
					"file_name": "output.png"
				}
			],
			"description": ""
		},
		"progress": 100,
		"create_time": 1776827106,
		"update_time": 1776827415,
		"action": "generate"
	}`)

	taskResp, ok := parseDuomiTaskResponse(body)
	if !ok {
		t.Fatalf("expected task response to parse")
	}
	if taskResp.ID != "e8f3d384-d740-889b-139b-99d8171488c8" {
		t.Fatalf("unexpected task id: %s", taskResp.ID)
	}
	if taskResp.State != "succeeded" {
		t.Fatalf("unexpected task state: %s", taskResp.State)
	}
	if len(taskResp.Data.Images) != 1 || taskResp.Data.Images[0].URL == "" {
		t.Fatalf("expected one image url in parsed task response")
	}
}
