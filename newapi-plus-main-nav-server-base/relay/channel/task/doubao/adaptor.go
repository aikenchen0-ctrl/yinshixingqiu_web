package doubao

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type,omitempty"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type requestPayload struct {
	Model                 string         `json:"model"`
	Content               []ContentItem  `json:"content,omitempty"`
	CallbackURL           string         `json:"callback_url,omitempty"`
	ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
	ServiceTier           string         `json:"service_tier,omitempty"`
	ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
	GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
	Draft                 *dto.BoolValue `json:"draft,omitempty"`
	Tools                 []struct {
		Type string `json:"type,omitempty"`
	} `json:"tools,omitempty"`
	Resolution  string         `json:"resolution,omitempty"`
	Ratio       string         `json:"ratio,omitempty"`
	Duration    *dto.IntValue  `json:"duration,omitempty"`
	Frames      *dto.IntValue  `json:"frames,omitempty"`
	Seed        *dto.IntValue  `json:"seed,omitempty"`
	CameraFixed *dto.BoolValue `json:"camera_fixed,omitempty"`
	Watermark   *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID string `json:"id"` // task_id
}

type responseTask struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Status  string `json:"status"`
	Content struct {
		VideoURL string `json:"video_url"`
	} `json:"content"`
	Seed            int    `json:"seed"`
	Resolution      string `json:"resolution"`
	Duration        int    `json:"duration"`
	Ratio           string `json:"ratio"`
	FramesPerSecond int    `json:"framespersecond"`
	ServiceTier     string `json:"service_tier"`
	Tools           []struct {
		Type string `json:"type"`
	} `json:"tools"`
	Usage struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
		ToolUsage        struct {
			WebSearch int `json:"web_search"`
		} `json:"tool_usage"`
	} `json:"usage"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

const (
	wrappedVideoProviderNone    = ""
	wrappedVideoProviderKKIDC   = "kkidc"
	wrappedVideoProviderApimart = "apimart"
)

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) validateWrappedVideoRequest(c *gin.Context, info *relaycommon.RelayInfo, provider string) *dto.TaskError {
	var raw map[string]interface{}
	if err := common.UnmarshalBodyReusable(c, &raw); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}

	req := relaycommon.TaskSubmitReq{
		Model:    strings.TrimSpace(common.Interface2String(raw["model"])),
		Prompt:   strings.TrimSpace(common.Interface2String(raw["prompt"])),
		Size:     strings.TrimSpace(common.Interface2String(raw["size"])),
		Metadata: make(map[string]interface{}),
	}
	if req.Model == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}

	switch v := raw["duration"].(type) {
	case float64:
		req.Duration = int(v)
	case int:
		req.Duration = v
	case string:
		if n, err := strconv.Atoi(v); err == nil {
			req.Duration = n
		}
	}

	if images, ok := raw["image_urls"].([]interface{}); ok {
		for _, item := range images {
			if s := strings.TrimSpace(common.Interface2String(item)); s != "" {
				req.Images = append(req.Images, s)
			}
		}
	}
	if withRoles, ok := raw["image_with_roles"].([]interface{}); ok {
		for _, item := range withRoles {
			if itemMap, ok := item.(map[string]interface{}); ok {
				if s := strings.TrimSpace(common.Interface2String(itemMap["url"])); s != "" {
					req.Images = append(req.Images, s)
				}
			}
		}
	}

	hasVideoRefs := hasAnyNonEmptyValues(raw["video_urls"])
	hasAudioRefs := hasAnyNonEmptyValues(raw["audio_urls"])
	hasImageRefs := len(req.Images) > 0

	if req.Prompt == "" && !hasImageRefs && !hasVideoRefs && !hasAudioRefs {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt is required"), "invalid_request", http.StatusBadRequest)
	}

	if provider == wrappedVideoProviderKKIDC && requiresReferenceVideos(req.Model) {
		var metadata struct {
			ReferenceVideos []string `json:"reference_videos"`
		}
		if rawMeta, ok := raw["metadata"].(map[string]interface{}); ok {
			req.Metadata = rawMeta
			if err := taskcommon.UnmarshalMetadata(req.Metadata, &metadata); err != nil {
				return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
			}
		}
		if len(metadata.ReferenceVideos) == 0 {
			return service.TaskErrorWrapperLocal(
				fmt.Errorf("model %s currently requires metadata.reference_videos and it cannot be empty", req.Model),
				"invalid_request",
				http.StatusBadRequest,
			)
		}
	}

	action := constant.TaskActionTextGenerate
	if hasImageRefs {
		action = constant.TaskActionGenerate
	}
	info.Action = action
	c.Set("task_request", req)
	return nil
}

func hasAnyNonEmptyValues(v interface{}) bool {
	items, ok := v.([]interface{})
	if !ok {
		return false
	}
	for _, item := range items {
		if strings.TrimSpace(common.Interface2String(item)) != "" {
			return true
		}
	}
	return false
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	provider := wrappedVideoProvider(a.baseURL)
	if provider == wrappedVideoProviderApimart || provider == wrappedVideoProviderKKIDC {
		return a.validateWrappedVideoRequest(c, info, provider)
	}

	// Accept only POST /v1/video/generations as "generate" action.
	if taskErr = relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}

	return nil
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	switch wrappedVideoProvider(a.baseURL) {
	case wrappedVideoProviderKKIDC:
		return joinBaseURL(a.baseURL, "/v1/video/generations"), nil
	case wrappedVideoProviderApimart:
		return joinBaseURL(a.baseURL, "/v1/videos/generations"), nil
	}
	return fmt.Sprintf("%s/api/v3/contents/generations/tasks", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if wrappedVideoProvider(a.baseURL) == wrappedVideoProviderApimart {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	} else if wrappedVideoProvider(a.baseURL) == wrappedVideoProviderKKIDC {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	} else {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	return nil
}

// EstimateBilling 检测请求 metadata 中是否包含视频输入，返回视频折扣 OtherRatio。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	if hasVideoInMetadata(req.Metadata) {
		if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
			return map[string]float64{"video_input": ratio}
		}
	}
	return nil
}

// hasVideoInMetadata 直接检查 metadata 的 content 数组是否包含 video_url 条目，
// 避免构建完整的上游 requestPayload。
func hasVideoInMetadata(metadata map[string]interface{}) bool {
	if metadata == nil {
		return false
	}
	contentRaw, ok := metadata["content"]
	if !ok {
		return false
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return false
	}
	for _, item := range contentSlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "video_url" {
			return true
		}
		if _, has := itemMap["video_url"]; has {
			return true
		}
	}
	return false
}

// BuildRequestBody converts request into Doubao specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	if provider := wrappedVideoProvider(a.baseURL); provider != wrappedVideoProviderNone {
		return a.buildWrappedRequestBody(c, info)
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	switch wrappedVideoProvider(a.baseURL) {
	case wrappedVideoProviderApimart:
		taskID = extractTaskID(responseBody)
		if taskID == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		c.Data(http.StatusOK, "application/json", responseBody)
		return taskID, responseBody, nil
	case wrappedVideoProviderKKIDC:
		taskID = extractTaskID(responseBody)
		if taskID == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}

		c.JSON(http.StatusOK, dto.VideoResponse{
			TaskId: info.PublicTaskID,
			Status: dto.VideoStatusQueued,
		})
		return taskID, responseBody, nil
	}

	// Parse Doubao response
	var dResp responsePayload
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.ID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return dResp.ID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	switch wrappedVideoProvider(baseUrl) {
	case wrappedVideoProviderKKIDC:
		uri := joinBaseURL(baseUrl, "/v1/video/generations/"+taskID)

		req, err := http.NewRequest(http.MethodGet, uri, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key)

		client, err := service.GetHttpClientWithProxy(proxy)
		if err != nil {
			return nil, fmt.Errorf("new proxy http client failed: %w", err)
		}
		return client.Do(req)
	case wrappedVideoProviderApimart:
		uri := joinBaseURL(baseUrl, "/v1/tasks/"+taskID)

		req, err := http.NewRequest(http.MethodGet, uri, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key)

		client, err := service.GetHttpClientWithProxy(proxy)
		if err != nil {
			return nil, fmt.Errorf("new proxy http client failed: %w", err)
		}
		return client.Do(req)
	}

	uri := fmt.Sprintf("%s/api/v3/contents/generations/tasks/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:   req.Model,
		Content: []ContentItem{},
	}

	// Add images if present
	if req.HasImage() {
		for _, imgURL := range req.Images {
			r.Content = append(r.Content, ContentItem{
				Type: "image_url",
				ImageURL: &MediaURL{
					URL: imgURL,
				},
			})
		}
	}

	metadata := req.Metadata
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	}

	r.Content = lo.Reject(r.Content, func(c ContentItem, _ int) bool { return c.Type == "text" })
	r.Content = append(r.Content, ContentItem{
		Type: "text",
		Text: req.Prompt,
	})

	return &r, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	status := strings.ToLower(strings.TrimSpace(resTask.Status))
	if status == "" {
		status = strings.ToLower(strings.TrimSpace(extractTaskStatus(respBody)))
	}
	if status == "" && extractVideoURL(respBody) != "" {
		status = "succeeded"
	}

	switch status {
	case "created", "submitted", "pending", "queued", "queueing":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "processing", "running", "in_progress", "in-progress":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded", "success", "completed", "done":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = resTask.Content.VideoURL
		if taskResult.Url == "" {
			taskResult.Url = extractVideoURL(respBody)
		}
		taskResult.CompletionTokens = resTask.Usage.CompletionTokens
		if taskResult.CompletionTokens == 0 {
			taskResult.CompletionTokens = extractInt(respBody,
				"usage.completion_tokens",
				"data.usage.completion_tokens",
				"result.usage.completion_tokens",
			)
		}
		taskResult.TotalTokens = resTask.Usage.TotalTokens
		if taskResult.TotalTokens == 0 {
			taskResult.TotalTokens = extractInt(respBody,
				"usage.total_tokens",
				"data.usage.total_tokens",
				"result.usage.total_tokens",
			)
		}
	case "failed", "error", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = resTask.Error.Message
		if taskResult.Reason == "" {
			taskResult.Reason = extractFailureReason(respBody)
		}
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
	default:
		// Unknown status, treat as processing
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	if progress := extractProgress(respBody); progress != "" {
		taskResult.Progress = progress
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var dResp responseTask
	if err := common.Unmarshal(originTask.Data, &dResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal doubao task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.TaskID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	if progress := extractProgress(originTask.Data); progress != "" {
		openAIVideo.SetProgressStr(progress)
	} else {
		openAIVideo.SetProgressStr(originTask.Progress)
	}
	videoURL := dResp.Content.VideoURL
	if videoURL == "" {
		videoURL = extractVideoURL(originTask.Data)
	}
	openAIVideo.SetMetadata("url", videoURL)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusFailure || strings.EqualFold(dResp.Status, "failed") {
		message := dResp.Error.Message
		if message == "" {
			message = extractFailureReason(originTask.Data)
		}
		if message == "" {
			message = originTask.FailReason
		}
		code := dResp.Error.Code
		if code == "" {
			code = "failed"
		}
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: message,
			Code:    code,
		}
	}

	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) buildWrappedRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	body, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_request_body_failed")
	}
	if !strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		return nil, fmt.Errorf("wrapped video api only supports application/json bodies")
	}
	if info.UpstreamModelName != "" {
		body, err = sjson.SetBytes(body, "model", info.UpstreamModelName)
		if err != nil {
			return nil, errors.Wrap(err, "set_model_failed")
		}
	}
	return bytes.NewReader(body), nil
}

func isKKIDCWrappedVideoAPI(baseURL string) bool {
	return taskcommon.HasBaseURLHost(baseURL, "kkidc.com")
}

func isApimartWrappedVideoAPI(baseURL string) bool {
	return taskcommon.HasBaseURLHost(baseURL, "api.apimart.ai", "claw.dualseason.com")
}

func wrappedVideoProvider(baseURL string) string {
	switch {
	case isKKIDCWrappedVideoAPI(baseURL):
		return wrappedVideoProviderKKIDC
	case isApimartWrappedVideoAPI(baseURL):
		return wrappedVideoProviderApimart
	default:
		return wrappedVideoProviderNone
	}
}

func requiresReferenceVideos(modelName string) bool {
	modelName = strings.TrimSpace(strings.ToLower(modelName))
	return modelName == "seed-2-vision" || modelName == "seed-2-fast-vision"
}

func joinBaseURL(baseURL, suffix string) string {
	return strings.TrimRight(baseURL, "/") + suffix
}

func extractTaskID(data []byte) string {
	return extractString(data,
		"id",
		"task_id",
		"data.id",
		"data.0.id",
		"data.task_id",
		"data.0.task_id",
		"result.id",
		"result.task_id",
	)
}

func extractTaskStatus(data []byte) string {
	return extractString(data,
		"state",
		"status",
		"data.status",
		"data.state",
		"data.status",
		"result.state",
		"result.status",
	)
}

func extractVideoURL(data []byte) string {
	return extractString(data,
		"content.video_url",
		"video_url",
		"url",
		"result_url",
		"data.content.video_url",
		"data.video_url",
		"data.url",
		"result.content.video_url",
		"result.video_url",
		"result.url",
		"data.result.videos.0.url.0",
		"data.result.videos.0.url",
		"videos.0.url",
		"data.videos.0.url",
		"result.videos.0.url",
	)
}

func extractFailureReason(data []byte) string {
	return extractString(data,
		"error.message",
		"error.msg",
		"message",
		"msg",
		"reason",
		"data.error.message",
		"data.message",
		"data.msg",
		"data.reason",
		"result.error.message",
		"result.message",
	)
}

func extractProgress(data []byte) string {
	for _, path := range []string{"progress", "data.progress", "result.progress"} {
		value := gjson.GetBytes(data, path)
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

func extractString(data []byte, paths ...string) string {
	for _, path := range paths {
		result := gjson.GetBytes(data, path)
		if !result.Exists() {
			continue
		}
		value := strings.TrimSpace(result.String())
		if value != "" {
			return value
		}
	}
	return ""
}

func extractInt(data []byte, paths ...string) int {
	for _, path := range paths {
		result := gjson.GetBytes(data, path)
		if !result.Exists() {
			continue
		}
		if result.Type == gjson.Number {
			return int(result.Int())
		}
	}
	return 0
}
