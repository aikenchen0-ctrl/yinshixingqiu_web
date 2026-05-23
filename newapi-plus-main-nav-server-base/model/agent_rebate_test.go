package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUserForAgentRebateTest(t *testing.T, user *User) {
	t.Helper()
	require.NoError(t, DB.Create(user).Error)
}

func insertTopUpForAgentRebateTest(t *testing.T, topUp *TopUp) {
	t.Helper()
	require.NoError(t, DB.Create(topUp).Error)
}

func TestApplyAgentRebateForTopUp_CreatesRecordAndIsIdempotent(t *testing.T) {
	truncateTables(t)

	agent := &User{
		Id:                 1001,
		Username:           "agent-user",
		Status:             common.UserStatusEnabled,
		AffCode:            "AGT1",
		IsAgent:            true,
		AgentRebateRateBps: 1500,
	}
	invitee := &User{
		Id:        1002,
		Username:  "invitee-user",
		Status:    common.UserStatusEnabled,
		AffCode:   "IVT1",
		InviterId: agent.Id,
	}
	insertUserForAgentRebateTest(t, agent)
	insertUserForAgentRebateTest(t, invitee)

	completeAt := time.Now().Unix()
	topUp := &TopUp{
		Id:            501,
		UserId:        invitee.Id,
		Amount:        10,
		Money:         12.5,
		TradeNo:       "agent-rebate-topup",
		PaymentMethod: PaymentMethodWaffo,
		CreateTime:    completeAt - 60,
		CompleteTime:  completeAt,
		Status:        common.TopUpStatusSuccess,
	}
	insertTopUpForAgentRebateTest(t, topUp)

	require.NoError(t, ApplyAgentRebateForTopUp(topUp.Id))
	require.NoError(t, ApplyAgentRebateForTopUp(topUp.Id))

	var updatedAgent User
	require.NoError(t, DB.Where("id = ?", agent.Id).First(&updatedAgent).Error)
	assert.InDelta(t, 1.875, updatedAgent.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 1.875, updatedAgent.AgentRebateHistoryAmount, 0.000001)

	var records []AgentRebateRecord
	require.NoError(t, DB.Where("agent_user_id = ?", agent.Id).Find(&records).Error)
	require.Len(t, records, 1)
	assert.Equal(t, AgentRebateRecordTypeTopUp, records[0].RecordType)
	assert.Equal(t, topUp.TradeNo, records[0].TradeNo)
	assert.Equal(t, invitee.Id, records[0].InviteeUserId)
	assert.InDelta(t, 12.5, records[0].PaymentAmount, 0.000001)
	assert.InDelta(t, 1.875, records[0].RebateAmount, 0.000001)
}

func TestAdjustAgentRebateBalance_SubtractUpdatesHistory(t *testing.T) {
	truncateTables(t)

	agent := &User{
		Id:                       2001,
		Username:                 "agent-adjust",
		Status:                   common.UserStatusEnabled,
		AffCode:                  "AGT2",
		IsAgent:                  true,
		AgentRebateRateBps:       800,
		AgentRebateBalance:       5.5,
		AgentRebateHistoryAmount: 9.25,
	}
	insertUserForAgentRebateTest(t, agent)

	require.NoError(t, AdjustAgentRebateBalance(1, "root", agent.Id, "subtract", 2.25, "refund rollback"))

	var updatedAgent User
	require.NoError(t, DB.Where("id = ?", agent.Id).First(&updatedAgent).Error)
	assert.InDelta(t, 3.25, updatedAgent.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 7.0, updatedAgent.AgentRebateHistoryAmount, 0.000001)

	var record AgentRebateRecord
	require.NoError(t, DB.Where("agent_user_id = ? AND record_type = ?", agent.Id, AgentRebateRecordTypeAdjustment).First(&record).Error)
	assert.Equal(t, "refund rollback", record.Note)
	assert.Equal(t, "root", record.OperatorUsername)
	assert.InDelta(t, -2.25, record.RebateAmount, 0.000001)
	assert.InDelta(t, 3.25, record.BalanceAfter, 0.000001)
}
