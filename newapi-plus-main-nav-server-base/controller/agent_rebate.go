package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type AdminAdjustAgentRebateRequest struct {
	Mode   string  `json:"mode"`
	Amount float64 `json:"amount"`
	Note   string  `json:"note"`
}

type AdminUpdateAgentProfileRequest struct {
	IsAgent            *bool `json:"is_agent"`
	AgentRebateRateBps *int  `json:"agent_rebate_rate_bps,omitempty"`
}

func GetAgentRebateSelf(c *gin.Context) {
	userID := c.GetInt("id")
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil || !user.IsAgent {
		common.ApiErrorMsg(c, "当前账号不是代理人")
		return
	}

	pageInfo := common.GetPageQuery(c)
	summary, err := model.GetAgentRebateSummary(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	records, total, err := model.GetAgentRebateRecords(userID, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, gin.H{
		"summary": summary,
		"page":    pageInfo,
	})
}

func AdminAdjustUserAgentRebate(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	var req AdminAdjustAgentRebateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Mode = strings.TrimSpace(req.Mode)
	if req.Mode == "" {
		common.ApiErrorMsg(c, "缺少调整模式")
		return
	}

	if err := model.AdjustAgentRebateBalance(c.GetInt("id"), c.GetString("username"), userID, req.Mode, req.Amount, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func AdminUpdateUserAgentProfile(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	var req AdminUpdateAgentProfileRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.IsAgent == nil && req.AgentRebateRateBps == nil {
		common.ApiErrorMsg(c, "缺少代理参数")
		return
	}
	if req.AgentRebateRateBps != nil && (*req.AgentRebateRateBps < 0 || *req.AgentRebateRateBps > 10000) {
		common.ApiErrorMsg(c, "返点比例超出范围")
		return
	}

	user, err := model.GetUserById(userID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}
	myRole := c.GetInt("role")
	if myRole <= user.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "无权操作同级或更高权限用户")
		return
	}

	updates := map[string]interface{}{}
	if req.IsAgent != nil {
		updates["is_agent"] = *req.IsAgent
	}
	if req.AgentRebateRateBps != nil {
		updates["agent_rebate_rate_bps"] = *req.AgentRebateRateBps
	}
	if len(updates) == 0 {
		common.ApiErrorMsg(c, "没有可更新的代理字段")
		return
	}

	if err := model.DB.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	updatedUser, err := model.GetUserById(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"is_agent":                    updatedUser.IsAgent,
			"agent_rebate_rate_bps":       updatedUser.AgentRebateRateBps,
			"agent_rebate_balance":        updatedUser.AgentRebateBalance,
			"agent_rebate_history_amount": updatedUser.AgentRebateHistoryAmount,
		},
	})
}
