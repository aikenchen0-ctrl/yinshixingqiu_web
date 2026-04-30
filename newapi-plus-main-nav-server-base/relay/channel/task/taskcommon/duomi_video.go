package taskcommon

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
)

var duomiCompatibleHosts = []string{
	"duomiapi.com",
	"claw.dualseason.com",
}

func HasBaseURLHost(baseURL string, hosts ...string) bool {
	baseURL = strings.ToLower(strings.TrimSpace(baseURL))
	if baseURL == "" {
		return false
	}

	parsed, err := url.Parse(baseURL)
	if err == nil && parsed.Host != "" {
		host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
		for _, candidate := range hosts {
			candidate = strings.ToLower(strings.TrimSpace(candidate))
			if candidate != "" && host == candidate {
				return true
			}
		}
	}

	for _, candidate := range hosts {
		candidate = strings.ToLower(strings.TrimSpace(candidate))
		if candidate != "" && strings.Contains(baseURL, candidate) {
			return true
		}
	}

	return false
}

func IsDuomiAPI(baseURL string) bool {
	return HasBaseURLHost(baseURL, duomiCompatibleHosts...)
}

func BuildDuomiVideoGenerationsURL(baseURL string) (string, error) {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return "", fmt.Errorf("channel base url is empty")
	}
	return strings.TrimRight(baseURL, "/") + "/v1/videos/generations", nil
}

func BuildDuomiVideoTaskURL(baseURL, taskID string) (string, error) {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return "", fmt.Errorf("channel base url is empty")
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return strings.TrimRight(baseURL, "/") + "/v1/videos/tasks/" + url.PathEscape(taskID), nil
	}
	parsed.Path = ""
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/") + "/v1/videos/tasks/" + url.PathEscape(taskID), nil
}

func BuildPassThroughJSONBody(cachedBody []byte, upstreamModelName string) ([]byte, error) {
	if len(cachedBody) == 0 || upstreamModelName == "" {
		return cachedBody, nil
	}
	var body map[string]any
	if err := common.Unmarshal(cachedBody, &body); err != nil {
		return cachedBody, nil
	}
	body["model"] = upstreamModelName
	return common.Marshal(body)
}

func ExtractTaskID(body []byte) string {
	return extractString(body,
		"id",
		"task_id",
		"data.id",
		"data.task_id",
		"result.id",
		"result.task_id",
	)
}

func ExtractTaskState(body []byte) string {
	return strings.ToLower(strings.TrimSpace(extractString(body,
		"state",
		"status",
		"data.state",
		"data.status",
		"result.state",
		"result.status",
	)))
}

func ExtractVideoURL(body []byte) string {
	return extractString(body,
		"data.videos.0.url",
		"videos.0.url",
		"result.videos.0.url",
		"data.video_url",
		"video_url",
		"url",
	)
}

func ExtractProgress(body []byte) string {
	for _, path := range []string{"progress", "data.progress", "result.progress"} {
		value := gjson.GetBytes(body, path)
		if !value.Exists() {
			continue
		}
		switch value.Type {
		case gjson.Number:
			return fmt.Sprintf("%d%%", int(value.Int()))
		case gjson.String:
			progress := strings.TrimSpace(value.String())
			if progress == "" {
				continue
			}
			if strings.HasSuffix(progress, "%") {
				return progress
			}
			return progress + "%"
		}
	}
	return ""
}

func ExtractErrorMessage(body []byte) string {
	return extractString(body,
		"message",
		"error.message",
		"data.message",
		"data.error.message",
		"result.message",
		"result.error.message",
	)
}

func ParseDuomiVideoTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{Code: 0}
	state := ExtractTaskState(respBody)
	if state == "" && ExtractVideoURL(respBody) != "" {
		state = "succeeded"
	}
	switch state {
	case "pending", "queued", "created":
		taskInfo.Status = model.TaskStatusQueued
		taskInfo.Progress = "10%"
	case "running", "processing", "in_progress":
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = "50%"
	case "succeeded", "success", "completed":
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = "100%"
		taskInfo.Url = ExtractVideoURL(respBody)
	case "error", "failed", "cancelled", "canceled":
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Progress = "100%"
		taskInfo.Reason = ExtractErrorMessage(respBody)
	default:
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = "30%"
	}
	if progress := ExtractProgress(respBody); progress != "" {
		taskInfo.Progress = progress
	}
	return taskInfo, nil
}

func ConvertStoredDuomiVideoToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.TaskID = task.TaskID
	video.Model = task.Properties.OriginModelName
	video.Status = task.Status.ToVideoStatus()
	video.SetProgressStr(task.Progress)
	video.CreatedAt = task.CreatedAt
	if task.FinishTime > 0 {
		video.CompletedAt = task.FinishTime
	} else if task.UpdatedAt > 0 {
		video.CompletedAt = task.UpdatedAt
	}
	if url := ExtractVideoURL(task.Data); url != "" {
		video.SetMetadata("url", url)
	} else if url := task.GetResultURL(); url != "" {
		video.SetMetadata("url", url)
	}
	if task.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{
			Message: ExtractErrorMessage(task.Data),
			Code:    "failed",
		}
		if strings.TrimSpace(video.Error.Message) == "" {
			video.Error.Message = task.FailReason
		}
	}
	return common.Marshal(video)
}

func extractString(data []byte, paths ...string) string {
	for _, path := range paths {
		value := strings.TrimSpace(gjson.GetBytes(data, path).String())
		if value != "" {
			return value
		}
	}
	return ""
}
