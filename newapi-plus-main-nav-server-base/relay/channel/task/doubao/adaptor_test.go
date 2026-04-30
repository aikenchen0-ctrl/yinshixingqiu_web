package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildRequestURLForKKIDCWrappedAPI(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://ai-api.kkidc.com"}

	url, err := adaptor.BuildRequestURL(nil)
	require.NoError(t, err)
	require.Equal(t, "https://ai-api.kkidc.com/v1/video/generations", url)
}

func TestBuildRequestURLForClawWrappedAPI(t *testing.T) {
	adaptor := &TaskAdaptor{baseURL: "https://claw.dualseason.com"}

	url, err := adaptor.BuildRequestURL(nil)
	require.NoError(t, err)
	require.Equal(t, "https://claw.dualseason.com/v1/videos/generations", url)
}

func TestParseTaskResultOfficialDoubaoFormat(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"id":"task-official",
		"status":"succeeded",
		"content":{"video_url":"https://cdn.example.com/video.mp4"},
		"usage":{"completion_tokens":11,"total_tokens":22}
	}`)

	result, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, model.TaskStatusSuccess, result.Status)
	require.Equal(t, "100%", result.Progress)
	require.Equal(t, "https://cdn.example.com/video.mp4", result.Url)
	require.Equal(t, 11, result.CompletionTokens)
	require.Equal(t, 22, result.TotalTokens)
}

func TestParseTaskResultKKIDCWrappedFormat(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"task_id":"cgt-20260323201806-12zxw",
		"status":"completed",
		"url":"https://ai-api.kkidc.com/files/result.mp4"
	}`)

	result, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, model.TaskStatusSuccess, result.Status)
	require.Equal(t, "100%", result.Progress)
	require.Equal(t, "https://ai-api.kkidc.com/files/result.mp4", result.Url)
}

func TestParseTaskResultFailureReason(t *testing.T) {
	adaptor := &TaskAdaptor{}
	body := []byte(`{
		"status":"failed",
		"error":{"message":"quota exceeded"}
	}`)

	result, err := adaptor.ParseTaskResult(body)
	require.NoError(t, err)
	require.Equal(t, model.TaskStatusFailure, result.Status)
	require.Equal(t, "quota exceeded", result.Reason)
}
