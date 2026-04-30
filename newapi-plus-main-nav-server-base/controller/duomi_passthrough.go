package controller

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func DuomiSunoGenerate(c *gin.Context) {
	channelModel, key, ok := findDuomiChannelForSuno()
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "no available duomi suno channel"}})
		return
	}

	bodyStorage, err := common.GetBodyStorage(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	bodyBytes, err := bodyStorage.Bytes()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	requestURL := strings.TrimRight(channelModel.GetBaseURL(), "/") + "/api/suno/generate"
	forwardDuomiRequest(c, channelModel, key, http.MethodPost, requestURL, bodyBytes, c.GetHeader("Content-Type"))
}

func DuomiSunoFeed(c *gin.Context) {
	taskID := strings.TrimSpace(c.Query("task_id"))
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "task_id is required"}})
		return
	}

	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	for _, channelModel := range channels {
		if !isDuomiSunoChannel(channelModel) {
			continue
		}
		keys := channelModel.GetKeys()
		if len(keys) == 0 && strings.TrimSpace(channelModel.Key) != "" {
			keys = []string{channelModel.Key}
		}

		requestURL := strings.TrimRight(channelModel.GetBaseURL(), "/") + "/api/suno/feed?task_id=" + url.QueryEscape(taskID)
		for _, key := range keys {
			statusCode, body, contentType, err := doDuomiRequest(channelModel, strings.TrimSpace(key), http.MethodGet, requestURL, nil, "")
			if err != nil || statusCode != http.StatusOK {
				continue
			}
			c.Data(statusCode, contentType, body)
			return
		}
	}

	c.JSON(http.StatusBadRequest, gin.H{"code": "task_not_exist", "message": "task_not_exist", "data": nil})
}

func findDuomiChannelForSuno() (*model.Channel, string, bool) {
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		return nil, "", false
	}
	var fallbackChannel *model.Channel
	var fallbackKey string
	for _, channelModel := range channels {
		if !isDuomiBaseChannel(channelModel) {
			continue
		}
		key, _, apiErr := channelModel.GetNextEnabledKey()
		if apiErr != nil || strings.TrimSpace(key) == "" {
			continue
		}
		if isPreferredDuomiSunoChannel(channelModel) {
			return channelModel, key, true
		}
		if fallbackChannel == nil {
			fallbackChannel = channelModel
			fallbackKey = key
		}
	}
	if fallbackChannel != nil {
		return fallbackChannel, fallbackKey, true
	}
	return nil, "", false
}

func isDuomiSunoChannel(channelModel *model.Channel) bool {
	return isDuomiBaseChannel(channelModel)
}

func isDuomiBaseChannel(channelModel *model.Channel) bool {
	if channelModel == nil || channelModel.Status != common.ChannelStatusEnabled {
		return false
	}
	if !taskcommon.IsDuomiAPI(channelModel.GetBaseURL()) {
		return false
	}
	return true
}

func isPreferredDuomiSunoChannel(channelModel *model.Channel) bool {
	if !isDuomiBaseChannel(channelModel) {
		return false
	}
	models := strings.ToLower(channelModel.Models)
	return channelModel.Type == constant.ChannelTypeSunoAPI || strings.Contains(models, "suno_")
}

func forwardDuomiRequest(c *gin.Context, channelModel *model.Channel, key string, method string, requestURL string, body []byte, requestContentType string) {
	statusCode, respBody, contentType, err := doDuomiRequest(channelModel, key, method, requestURL, body, requestContentType)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	c.Data(statusCode, contentType, respBody)
}

func doDuomiRequest(channelModel *model.Channel, key string, method string, requestURL string, body []byte, requestContentType string) (int, []byte, string, error) {
	req, err := http.NewRequest(method, requestURL, bytes.NewReader(body))
	if err != nil {
		return 0, nil, "", err
	}
	req.Header.Set("Authorization", key)
	req.Header.Set("Accept", "application/json")
	if method == http.MethodPost && strings.TrimSpace(requestContentType) != "" {
		req.Header.Set("Content-Type", requestContentType)
	}
	client, err := service.GetHttpClientWithProxy(channelModel.GetSetting().Proxy)
	if err != nil {
		return 0, nil, "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, "", err
	}
	defer service.CloseResponseBodyGracefully(resp)
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, "", err
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	return resp.StatusCode, respBody, contentType, nil
}
