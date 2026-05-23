package controller

import (
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type agentRebateSelfResponse struct {
	Summary struct {
		IsAgent                  bool    `json:"is_agent"`
		AgentRebateRateBps       int     `json:"agent_rebate_rate_bps"`
		AgentRebateBalance       float64 `json:"agent_rebate_balance"`
		AgentRebateHistoryAmount float64 `json:"agent_rebate_history_amount"`
		InviteeCount             int     `json:"invitee_count"`
		RecordCount              int64   `json:"record_count"`
	} `json:"summary"`
	Page struct {
		Total int                           `json:"total"`
		Items []model.AgentRebateRecordItem `json:"items"`
	} `json:"page"`
}

type selfAgentProfileResponse struct {
	ID                       int     `json:"id"`
	IsAgent                  bool    `json:"is_agent"`
	AgentRebateRateBps       int     `json:"agent_rebate_rate_bps"`
	AgentRebateBalance       float64 `json:"agent_rebate_balance"`
	AgentRebateHistoryAmount float64 `json:"agent_rebate_history_amount"`
}

type adminAgentProfileResponse struct {
	IsAgent                  bool    `json:"is_agent"`
	AgentRebateRateBps       int     `json:"agent_rebate_rate_bps"`
	AgentRebateBalance       float64 `json:"agent_rebate_balance"`
	AgentRebateHistoryAmount float64 `json:"agent_rebate_history_amount"`
}

func setupAgentRebateControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.AgentRebateRecord{}))
	return db
}

func insertAgentRebateControllerUser(t *testing.T, user *model.User) {
	t.Helper()
	require.NoError(t, model.DB.Create(user).Error)
}

func insertAgentRebateControllerTopUp(t *testing.T, topUp *model.TopUp) {
	t.Helper()
	require.NoError(t, model.DB.Create(topUp).Error)
}

func decodeRawResponse[T any](t *testing.T, raw json.RawMessage) T {
	t.Helper()

	var value T
	require.NoError(t, common.Unmarshal(raw, &value))
	return value
}

func TestGetSelf_IncludesAgentRebateFields(t *testing.T) {
	setupAgentRebateControllerTestDB(t)

	insertAgentRebateControllerUser(t, &model.User{
		Id:                       101,
		Username:                 "agent-self",
		DisplayName:              "Agent Self",
		Role:                     common.RoleCommonUser,
		Status:                   common.UserStatusEnabled,
		Group:                    "default",
		IsAgent:                  true,
		AgentRebateRateBps:       1750,
		AgentRebateBalance:       6.54321,
		AgentRebateHistoryAmount: 9.87654,
	})

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/user/self", nil, 101)
	ctx.Set("role", common.RoleCommonUser)

	GetSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	data := decodeRawResponse[selfAgentProfileResponse](t, response.Data)
	assert.Equal(t, 101, data.ID)
	assert.True(t, data.IsAgent)
	assert.Equal(t, 1750, data.AgentRebateRateBps)
	assert.InDelta(t, 6.54321, data.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 9.87654, data.AgentRebateHistoryAmount, 0.000001)
}

func TestGetAgentRebateSelf_ReturnsSummaryAndRecords(t *testing.T) {
	setupAgentRebateControllerTestDB(t)

	agent := &model.User{
		Id:                       201,
		Username:                 "agent-rebate",
		DisplayName:              "Agent Rebate",
		Role:                     common.RoleCommonUser,
		Status:                   common.UserStatusEnabled,
		AffCode:                  "AG201",
		AffCount:                 1,
		IsAgent:                  true,
		AgentRebateRateBps:       1200,
		AgentRebateBalance:       0,
		AgentRebateHistoryAmount: 0,
	}
	invitee := &model.User{
		Id:        202,
		Username:  "invitee-rebate",
		Status:    common.UserStatusEnabled,
		AffCode:   "IV202",
		InviterId: agent.Id,
	}
	insertAgentRebateControllerUser(t, agent)
	insertAgentRebateControllerUser(t, invitee)
	insertAgentRebateControllerTopUp(t, &model.TopUp{
		Id:            701,
		UserId:        invitee.Id,
		Amount:        10,
		Money:         20,
		TradeNo:       "agent-self-topup",
		PaymentMethod: model.PaymentMethodWaffo,
		CreateTime:    time.Now().Unix() - 120,
		CompleteTime:  time.Now().Unix(),
		Status:        common.TopUpStatusSuccess,
	})
	require.NoError(t, model.ApplyAgentRebateForTopUp(701))

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/user/agent_rebate?p=0&page_size=10", nil, agent.Id)

	GetAgentRebateSelf(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	data := decodeRawResponse[agentRebateSelfResponse](t, response.Data)
	assert.True(t, data.Summary.IsAgent)
	assert.Equal(t, 1200, data.Summary.AgentRebateRateBps)
	assert.InDelta(t, 2.4, data.Summary.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 2.4, data.Summary.AgentRebateHistoryAmount, 0.000001)
	assert.Equal(t, 1, data.Summary.InviteeCount)
	require.Len(t, data.Page.Items, 1)
	assert.Equal(t, "invitee-rebate", data.Page.Items[0].InviteeUsername)
	assert.Equal(t, model.AgentRebateRecordTypeTopUp, data.Page.Items[0].RecordType)
	assert.InDelta(t, 2.4, data.Page.Items[0].RebateAmount, 0.000001)
}

func TestAdminUpdateUserAgentProfile_UpdatesFields(t *testing.T) {
	setupAgentRebateControllerTestDB(t)

	insertAgentRebateControllerUser(t, &model.User{
		Id:       301,
		Username: "managed-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	})

	body := map[string]any{
		"is_agent":              true,
		"agent_rebate_rate_bps": 2300,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPatch, "/api/user/301/agent", body, 1)
	ctx.Set("role", common.RoleRootUser)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(301)}}

	AdminUpdateUserAgentProfile(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	data := decodeRawResponse[adminAgentProfileResponse](t, response.Data)
	assert.True(t, data.IsAgent)
	assert.Equal(t, 2300, data.AgentRebateRateBps)

	var updated model.User
	require.NoError(t, model.DB.Where("id = ?", 301).First(&updated).Error)
	assert.True(t, updated.IsAgent)
	assert.Equal(t, 2300, updated.AgentRebateRateBps)
}

func TestAdminAdjustUserAgentRebate_RecordsAdjustment(t *testing.T) {
	setupAgentRebateControllerTestDB(t)

	insertAgentRebateControllerUser(t, &model.User{
		Id:                       401,
		Username:                 "adjust-target",
		Role:                     common.RoleCommonUser,
		Status:                   common.UserStatusEnabled,
		IsAgent:                  true,
		AgentRebateRateBps:       1500,
		AgentRebateBalance:       5.5,
		AgentRebateHistoryAmount: 5.5,
	})

	body := map[string]any{
		"mode":   "subtract",
		"amount": 1.25,
		"note":   "manual rollback",
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/401/agent_rebate/adjust", body, 9001)
	ctx.Set("role", common.RoleRootUser)
	ctx.Set("username", "root-admin")
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(401)}}

	AdminAdjustUserAgentRebate(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	var updated model.User
	require.NoError(t, model.DB.Where("id = ?", 401).First(&updated).Error)
	assert.InDelta(t, 4.25, updated.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 4.25, updated.AgentRebateHistoryAmount, 0.000001)

	var record model.AgentRebateRecord
	require.NoError(t, model.DB.Where("agent_user_id = ? AND record_type = ?", 401, model.AgentRebateRecordTypeAdjustment).First(&record).Error)
	assert.Equal(t, "root-admin", record.OperatorUsername)
	assert.Equal(t, "manual rollback", record.Note)
	assert.InDelta(t, -1.25, record.RebateAmount, 0.000001)
}

func TestUpdateUser_PreservesAgentFieldsWhenOmitted(t *testing.T) {
	setupAgentRebateControllerTestDB(t)

	insertAgentRebateControllerUser(t, &model.User{
		Id:                       501,
		Username:                 "agent-preserve",
		DisplayName:              "Before",
		Role:                     common.RoleCommonUser,
		Status:                   common.UserStatusEnabled,
		Group:                    "default",
		IsAgent:                  true,
		AgentRebateRateBps:       2300,
		AgentRebateBalance:       3.5,
		AgentRebateHistoryAmount: 7.25,
	})

	body := map[string]any{
		"id":           501,
		"username":     "agent-preserve",
		"display_name": "After",
		"group":        "vip",
		"remark":       "updated",
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/user/", body, 1)
	ctx.Set("role", common.RoleRootUser)

	UpdateUser(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	var updated model.User
	require.NoError(t, model.DB.Where("id = ?", 501).First(&updated).Error)
	assert.Equal(t, "After", updated.DisplayName)
	assert.Equal(t, "vip", updated.Group)
	assert.True(t, updated.IsAgent)
	assert.Equal(t, 2300, updated.AgentRebateRateBps)
	assert.InDelta(t, 3.5, updated.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 7.25, updated.AgentRebateHistoryAmount, 0.000001)
}
