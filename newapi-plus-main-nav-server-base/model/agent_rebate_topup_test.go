package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertAgentRebateWiringUsers(t *testing.T, agentID int, inviteeID int, rateBps int) {
	t.Helper()

	insertUserForAgentRebateTest(t, &User{
		Id:                 agentID,
		Username:           "agent-wiring",
		Status:             common.UserStatusEnabled,
		AffCode:            "AGW1",
		IsAgent:            true,
		AgentRebateRateBps: rateBps,
	})
	insertUserForAgentRebateTest(t, &User{
		Id:        inviteeID,
		Username:  "invitee-wiring",
		Status:    common.UserStatusEnabled,
		AffCode:   "IVW1",
		InviterId: agentID,
	})
}

func countAgentRebateRecordsForWiringTest(t *testing.T, agentID int) int64 {
	t.Helper()

	var count int64
	require.NoError(t, DB.Model(&AgentRebateRecord{}).Where("agent_user_id = ?", agentID).Count(&count).Error)
	return count
}

func getAgentForWiringTest(t *testing.T, agentID int) User {
	t.Helper()

	var user User
	require.NoError(t, DB.Where("id = ?", agentID).First(&user).Error)
	return user
}

func TestTopUpCompletionPathsApplyAgentRebate(t *testing.T) {
	testCases := []struct {
		name           string
		topUpID        int
		agentID        int
		inviteeID      int
		tradeNo        string
		paymentMethod  string
		amount         int64
		money          float64
		invoke         func(string) error
		expectedRebate float64
	}{
		{
			name:           "stripe recharge",
			topUpID:        801,
			agentID:        901,
			inviteeID:      902,
			tradeNo:        "rebate-stripe",
			paymentMethod:  PaymentMethodStripe,
			amount:         10,
			money:          25,
			invoke:         func(tradeNo string) error { return Recharge(tradeNo, "cus_agent_rebate", "127.0.0.1") },
			expectedRebate: 2.5,
		},
		{
			name:           "manual complete",
			topUpID:        802,
			agentID:        903,
			inviteeID:      904,
			tradeNo:        "rebate-manual",
			paymentMethod:  "alipay",
			amount:         8,
			money:          18.88,
			invoke:         func(tradeNo string) error { return ManualCompleteTopUp(tradeNo, "127.0.0.1") },
			expectedRebate: 1.888,
		},
		{
			name:          "creem recharge",
			topUpID:       803,
			agentID:       905,
			inviteeID:     906,
			tradeNo:       "rebate-creem",
			paymentMethod: PaymentMethodCreem,
			amount:        12,
			money:         12,
			invoke: func(tradeNo string) error {
				return RechargeCreem(tradeNo, "invitee@example.com", "Invitee", "127.0.0.1")
			},
			expectedRebate: 1.2,
		},
		{
			name:           "waffo recharge",
			topUpID:        804,
			agentID:        907,
			inviteeID:      908,
			tradeNo:        "rebate-waffo",
			paymentMethod:  PaymentMethodWaffo,
			amount:         15,
			money:          15.5,
			invoke:         func(tradeNo string) error { return RechargeWaffo(tradeNo, "127.0.0.1") },
			expectedRebate: 1.55,
		},
		{
			name:           "waffo pancake recharge",
			topUpID:        805,
			agentID:        909,
			inviteeID:      910,
			tradeNo:        "rebate-waffo-pancake",
			paymentMethod:  PaymentMethodWaffoPancake,
			amount:         9,
			money:          9.9,
			invoke:         func(tradeNo string) error { return RechargeWaffoPancake(tradeNo) },
			expectedRebate: 0.99,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			insertAgentRebateWiringUsers(t, tc.agentID, tc.inviteeID, 1000)
			insertTopUpForAgentRebateTest(t, &TopUp{
				Id:            tc.topUpID,
				UserId:        tc.inviteeID,
				Amount:        tc.amount,
				Money:         tc.money,
				TradeNo:       tc.tradeNo,
				PaymentMethod: tc.paymentMethod,
				CreateTime:    time.Now().Unix() - 60,
				Status:        common.TopUpStatusPending,
			})

			require.NoError(t, tc.invoke(tc.tradeNo))

			agent := getAgentForWiringTest(t, tc.agentID)
			assert.InDelta(t, tc.expectedRebate, agent.AgentRebateBalance, 0.000001)
			assert.InDelta(t, tc.expectedRebate, agent.AgentRebateHistoryAmount, 0.000001)
			assert.EqualValues(t, 1, countAgentRebateRecordsForWiringTest(t, tc.agentID))

			topUp := GetTopUpByTradeNo(tc.tradeNo)
			require.NotNil(t, topUp)
			assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
		})
	}
}

func TestCompleteEpayTopUp_AppliesAgentRebateAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	insertAgentRebateWiringUsers(t, 1201, 1202, 1000)
	insertTopUpForAgentRebateTest(t, &TopUp{
		Id:            901,
		UserId:        1202,
		Amount:        11,
		Money:         13.4,
		TradeNo:       "rebate-epay",
		PaymentMethod: "alipay",
		CreateTime:    time.Now().Unix() - 60,
		Status:        common.TopUpStatusPending,
	})

	topUp, quotaToAdd, err := CompleteEpayTopUp("rebate-epay")
	require.NoError(t, err)
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Positive(t, quotaToAdd)

	invitee := getAgentForWiringTest(t, 1202)
	assert.Equal(t, quotaToAdd, invitee.Quota)

	agent := getAgentForWiringTest(t, 1201)
	assert.InDelta(t, 1.34, agent.AgentRebateBalance, 0.000001)
	assert.InDelta(t, 1.34, agent.AgentRebateHistoryAmount, 0.000001)
	assert.EqualValues(t, 1, countAgentRebateRecordsForWiringTest(t, 1201))

	topUpAgain, quotaAgain, err := CompleteEpayTopUp("rebate-epay")
	require.NoError(t, err)
	require.NotNil(t, topUpAgain)
	assert.Equal(t, 0, quotaAgain)
	assert.EqualValues(t, 1, countAgentRebateRecordsForWiringTest(t, 1201))
}
