package openai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	duomiTaskPollInterval = 2 * time.Second
	duomiTaskPollMaxStep  = 60
	duomiImageTaskAction  = "image_generate"
)

type duomiTaskResponse struct {
	ID         string `json:"id"`
	State      string `json:"state"`
	Progress   int    `json:"progress"`
	CreateTime int64  `json:"create_time"`
	UpdateTime int64  `json:"update_time"`
	Action     string `json:"action"`
	Message    string `json:"message,omitempty"`
	Data       struct {
		Images []struct {
			URL      string `json:"url"`
			FileName string `json:"file_name"`
		} `json:"images"`
		Description string `json:"description"`
	} `json:"data"`
}

func maybeHandleDuomiImageTask(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError, bool) {
	if resp == nil || !isDuomiTaskChannel(info) {
		return nil, nil, false
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError), true
	}
	service.CloseResponseBodyGracefully(resp)

	initialTask, ok := parseDuomiTaskResponse(responseBody)
	if !ok {
		resp.Body = io.NopCloser(bytes.NewReader(responseBody))
		return nil, nil, false
	}
	persistDuomiImageTask(c, info, initialTask, responseBody)

	if isAsyncImageRequested(c) {
		c.Writer.Header().Set("Content-Type", "application/json")
		service.IOCopyBytesGracefully(c, nil, responseBody)
		return &dto.Usage{}, nil, true
	}

	finalTask := initialTask
	finalBody := responseBody

	if shouldPollDuomiTask(initialTask) {
		logger.LogDebug(c, fmt.Sprintf("duomi image task detected, polling task %s", initialTask.ID))
		finalTask, finalBody, err = waitDuomiTask(c, info, initialTask.ID)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponse), true
		}
	}
	persistDuomiImageTask(c, info, finalTask, finalBody)

	if isDuomiFailureState(finalTask.State) {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: duomiTaskErrorMessage(finalTask),
			Type:    "duomi_image_error",
			Code:    strings.ToLower(strings.TrimSpace(finalTask.State)),
		}, http.StatusBadRequest), true
	}

	imageResponse, err := duomiTaskToImageResponse(info, finalTask, finalBody)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody), true
	}
	if len(imageResponse.Data) == 0 {
		return nil, types.NewError(fmt.Errorf("duomi task %s succeeded but returned no images", finalTask.ID), types.ErrorCodeBadResponseBody), true
	}

	jsonResp, err := common.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody), true
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	service.IOCopyBytesGracefully(c, nil, jsonResp)
	return &dto.Usage{}, nil, true
}

func isAsyncImageRequested(c *gin.Context) bool {
	if c == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(c.Query("async"))) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func isDuomiTaskChannel(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	return taskcommon.IsDuomiAPI(info.ChannelBaseUrl)
}

func parseDuomiTaskResponse(body []byte) (*duomiTaskResponse, bool) {
	if len(body) == 0 {
		return nil, false
	}
	var taskResp duomiTaskResponse
	if err := common.Unmarshal(body, &taskResp); err != nil {
		return nil, false
	}
	if strings.TrimSpace(taskResp.ID) == "" || strings.TrimSpace(taskResp.State) == "" {
		return nil, false
	}
	return &taskResp, true
}

func shouldPollDuomiTask(task *duomiTaskResponse) bool {
	if task == nil {
		return false
	}
	if isDuomiFailureState(task.State) {
		return false
	}
	if isDuomiSuccessState(task.State) && len(task.Data.Images) > 0 {
		return false
	}
	return true
}

func isDuomiSuccessState(state string) bool {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "succeeded", "success", "completed":
		return true
	default:
		return false
	}
}

func isDuomiFailureState(state string) bool {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "failed", "failure", "canceled", "cancelled", "rejected", "error":
		return true
	default:
		return false
	}
}

func waitDuomiTask(c *gin.Context, info *relaycommon.RelayInfo, taskID string) (*duomiTaskResponse, []byte, error) {
	var (
		lastTask *duomiTaskResponse
		lastBody []byte
		err      error
	)

	for step := 1; step <= duomiTaskPollMaxStep; step++ {
		if step > 1 {
			select {
			case <-c.Request.Context().Done():
				return nil, nil, c.Request.Context().Err()
			case <-time.After(duomiTaskPollInterval):
			}
		}

		lastTask, lastBody, err = fetchDuomiTask(c, info, taskID)
		if err != nil {
			return nil, nil, err
		}

		if isDuomiFailureState(lastTask.State) {
			return lastTask, lastBody, nil
		}
		if isDuomiSuccessState(lastTask.State) && len(lastTask.Data.Images) > 0 {
			return lastTask, lastBody, nil
		}
	}

	if lastTask != nil {
		return lastTask, lastBody, fmt.Errorf("duomi task %s polling timeout, current state=%s", taskID, lastTask.State)
	}
	return nil, nil, fmt.Errorf("duomi task %s polling timeout", taskID)
}

func fetchDuomiTask(c *gin.Context, info *relaycommon.RelayInfo, taskID string) (*duomiTaskResponse, []byte, error) {
	taskURL, err := buildDuomiTaskURL(info, taskID)
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequest(http.MethodGet, taskURL, nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", info.ApiKey)

	headerOverride, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, nil, err
	}
	for key, value := range headerOverride {
		req.Header.Set(key, value)
		if strings.EqualFold(key, "Host") {
			req.Host = value
		}
	}

	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return nil, nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, body, fmt.Errorf("duomi task fetch failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	taskResp, ok := parseDuomiTaskResponse(body)
	if !ok {
		return nil, body, fmt.Errorf("invalid duomi task response: %s", strings.TrimSpace(string(body)))
	}
	return taskResp, body, nil
}

func buildDuomiTaskURL(info *relaycommon.RelayInfo, taskID string) (string, error) {
	if info == nil {
		return "", fmt.Errorf("relay info is nil")
	}
	baseURL := strings.TrimSpace(info.ChannelBaseUrl)
	if baseURL == "" {
		return "", fmt.Errorf("channel base url is empty")
	}

	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return strings.TrimRight(baseURL, "/") + "/v1/tasks/" + url.PathEscape(taskID), nil
	}

	parsed.Path = ""
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/") + "/v1/tasks/" + url.PathEscape(taskID), nil
}

func duomiTaskToImageResponse(info *relaycommon.RelayInfo, task *duomiTaskResponse, metadata []byte) (*dto.ImageResponse, error) {
	imageResponse := &dto.ImageResponse{
		Created:  task.CreateTime,
		Metadata: metadata,
	}
	if imageResponse.Created == 0 {
		imageResponse.Created = common.GetTimestamp()
	}

	wantBase64 := false
	if req, ok := info.Request.(*dto.ImageRequest); ok && strings.EqualFold(req.ResponseFormat, "b64_json") {
		wantBase64 = true
	}

	for _, image := range task.Data.Images {
		imageData := dto.ImageData{
			RevisedPrompt: task.Data.Description,
		}
		if wantBase64 {
			_, b64, err := service.GetImageFromUrl(image.URL)
			if err != nil {
				return nil, fmt.Errorf("download duomi image failed: %w", err)
			}
			imageData.B64Json = b64
		} else {
			imageData.Url = image.URL
		}
		imageResponse.Data = append(imageResponse.Data, imageData)
	}
	return imageResponse, nil
}

func duomiTaskErrorMessage(task *duomiTaskResponse) string {
	if task == nil {
		return "duomi image task failed"
	}
	if msg := strings.TrimSpace(task.Message); msg != "" {
		return msg
	}
	return fmt.Sprintf("duomi image task failed, state=%s", strings.TrimSpace(task.State))
}

func persistDuomiImageTask(c *gin.Context, info *relaycommon.RelayInfo, taskResp *duomiTaskResponse, body []byte) {
	if info == nil || taskResp == nil || strings.TrimSpace(taskResp.ID) == "" {
		return
	}

	task, exist, err := model.GetByTaskId(info.UserId, taskResp.ID)
	if err != nil {
		logger.LogError(c, "duomi image task lookup failed: "+err.Error())
		return
	}

	if !exist {
		task = model.InitTask(constant.TaskPlatform("duomi-image"), info)
		task.TaskID = taskResp.ID
		task.Action = duomiImageTaskAction
		task.PrivateData.UpstreamTaskID = taskResp.ID
	}

	task.Properties.OriginModelName = info.OriginModelName
	task.Properties.UpstreamModelName = info.UpstreamModelName
	task.Data = body
	task.Status = duomiTaskStateToStatus(taskResp.State)
	task.Progress = duomiTaskProgress(taskResp)
	task.SubmitTime = duomiTaskTimestamp(taskResp.CreateTime, time.Now().Unix())
	task.StartTime = task.SubmitTime
	task.FinishTime = duomiTaskFinishTime(taskResp)
	task.FailReason = ""
	task.PrivateData.ResultURL = ""

	if len(taskResp.Data.Images) > 0 {
		task.PrivateData.ResultURL = strings.TrimSpace(taskResp.Data.Images[0].URL)
	}
	if task.Status == model.TaskStatusFailure {
		task.FailReason = duomiTaskErrorMessage(taskResp)
	}
	if task.Quota == 0 && info.PriceData.Quota > 0 {
		task.Quota = info.PriceData.Quota
	}

	if exist {
		if err := task.Update(); err != nil {
			logger.LogError(c, "duomi image task update failed: "+err.Error())
		}
		return
	}
	if err := task.Insert(); err != nil {
		logger.LogError(c, "duomi image task insert failed: "+err.Error())
	}
}

func duomiTaskStateToStatus(state string) model.TaskStatus {
	switch {
	case isDuomiSuccessState(state):
		return model.TaskStatusSuccess
	case isDuomiFailureState(state):
		return model.TaskStatusFailure
	default:
		return model.TaskStatusInProgress
	}
}

func duomiTaskProgress(taskResp *duomiTaskResponse) string {
	if taskResp == nil {
		return "0%"
	}
	if taskResp.Progress > 0 {
		return fmt.Sprintf("%d%%", taskResp.Progress)
	}
	switch duomiTaskStateToStatus(taskResp.State) {
	case model.TaskStatusSuccess, model.TaskStatusFailure:
		return "100%"
	case model.TaskStatusInProgress:
		return "50%"
	default:
		return "0%"
	}
}

func duomiTaskTimestamp(v int64, fallback int64) int64 {
	if v > 0 {
		return v
	}
	return fallback
}

func duomiTaskFinishTime(taskResp *duomiTaskResponse) int64 {
	if taskResp == nil {
		return 0
	}
	if duomiTaskStateToStatus(taskResp.State) == model.TaskStatusSuccess || duomiTaskStateToStatus(taskResp.State) == model.TaskStatusFailure {
		return duomiTaskTimestamp(taskResp.UpdateTime, time.Now().Unix())
	}
	return 0
}

func isDuomiImageTask(task *model.Task) bool {
	if task == nil {
		return false
	}
	if task.Action == duomiImageTaskAction {
		return true
	}
	if strings.Contains(strings.ToLower(string(task.Platform)), "duomi-image") {
		return true
	}
	return false
}

func duomiTaskIDString(task *model.Task) string {
	if task == nil {
		return ""
	}
	if strings.TrimSpace(task.TaskID) != "" {
		return task.TaskID
	}
	if strings.TrimSpace(task.GetUpstreamTaskID()) != "" {
		return task.GetUpstreamTaskID()
	}
	return ""
}

func duomiTaskResponseFromStoredTask(task *model.Task) []byte {
	if task == nil {
		return nil
	}
	if task.Data != nil && bytes.Contains(task.Data, []byte(`"data"`)) && bytes.Contains(task.Data, []byte(`"images"`)) {
		return task.Data
	}

	payload := map[string]any{
		"id":          duomiTaskIDString(task),
		"state":       duomiTaskStateFromLocal(task.Status),
		"progress":    duomiTaskProgressInt(task.Progress),
		"create_time": task.SubmitTime,
		"update_time": task.FinishTime,
		"action":      "generate",
		"data": map[string]any{
			"images":      []map[string]string{},
			"description": "",
		},
	}
	if task.GetResultURL() != "" {
		payload["data"].(map[string]any)["images"] = []map[string]string{
			{
				"url":       task.GetResultURL(),
				"file_name": "",
			},
		}
	}
	if task.FailReason != "" {
		payload["message"] = task.FailReason
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return nil
	}
	return body
}

func duomiTaskStateFromLocal(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	default:
		return "processing"
	}
}

func duomiTaskProgressInt(progress string) int {
	progress = strings.TrimSpace(strings.TrimSuffix(progress, "%"))
	if progress == "" {
		return 0
	}
	v, err := strconv.Atoi(progress)
	if err != nil {
		return 0
	}
	return v
}
