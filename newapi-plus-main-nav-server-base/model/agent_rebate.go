package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AgentRebateRecordTypeTopUp      = "topup"
	AgentRebateRecordTypeAdjustment = "adjustment"
)

type AgentRebateRecord struct {
	Id int `json:"id"`

	AgentUserId      int     `json:"agent_user_id" gorm:"index"`
	InviteeUserId    int     `json:"invitee_user_id" gorm:"index"`
	TopUpId          *int    `json:"top_up_id,omitempty" gorm:"index"`
	TradeNo          string  `json:"trade_no" gorm:"type:varchar(255);index"`
	PaymentMethod    string  `json:"payment_method" gorm:"type:varchar(50);index"`
	PaymentAmount    float64 `json:"payment_amount" gorm:"type:decimal(12,6);size:12;not null;default:0.000000"`
	RebateRateBps    int     `json:"rebate_rate_bps" gorm:"type:int;not null;default:0"`
	RebateAmount     float64 `json:"rebate_amount" gorm:"type:decimal(12,6);size:12;not null;default:0.000000"`
	BalanceAfter     float64 `json:"balance_after" gorm:"type:decimal(12,6);size:12;not null;default:0.000000"`
	RecordType       string  `json:"record_type" gorm:"type:varchar(32);not null;default:'topup';index"`
	Note             string  `json:"note" gorm:"type:varchar(255);default:''"`
	OperatorUserId   int     `json:"operator_user_id" gorm:"type:int;default:0"`
	OperatorUsername string  `json:"operator_username" gorm:"type:varchar(64);default:''"`
	TopUpCompletedAt int64   `json:"top_up_completed_at" gorm:"bigint;default:0;index"`
	Snapshot         string  `json:"snapshot" gorm:"type:text"`

	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

type AgentRebateSummary struct {
	IsAgent                  bool    `json:"is_agent"`
	AgentRebateRateBps       int     `json:"agent_rebate_rate_bps"`
	AgentRebateBalance       float64 `json:"agent_rebate_balance"`
	AgentRebateHistoryAmount float64 `json:"agent_rebate_history_amount"`
	InviteeCount             int     `json:"invitee_count"`
	RecordCount              int64   `json:"record_count"`
}

type AgentRebateRecordItem struct {
	Id               int     `json:"id"`
	InviteeUserId    int     `json:"invitee_user_id"`
	InviteeUsername  string  `json:"invitee_username"`
	InviteeName      string  `json:"invitee_name"`
	TradeNo          string  `json:"trade_no"`
	PaymentMethod    string  `json:"payment_method"`
	PaymentAmount    float64 `json:"payment_amount"`
	RebateRateBps    int     `json:"rebate_rate_bps"`
	RebateAmount     float64 `json:"rebate_amount"`
	BalanceAfter     float64 `json:"balance_after"`
	RecordType       string  `json:"record_type"`
	Note             string  `json:"note"`
	OperatorUserId   int     `json:"operator_user_id"`
	OperatorUsername string  `json:"operator_username"`
	TopUpCompletedAt int64   `json:"top_up_completed_at"`
	CreatedAt        int64   `json:"created_at"`
}

func (r *AgentRebateRecord) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *AgentRebateRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func normalizeAgentRebateMoney(amount float64) float64 {
	return decimal.NewFromFloat(amount).Round(6).InexactFloat64()
}

func buildAgentRebateSnapshot(topUp *TopUp, invitee *User, agent *User, note string) string {
	if topUp == nil || invitee == nil || agent == nil {
		return ""
	}

	snapshot := map[string]interface{}{
		"topup": map[string]interface{}{
			"id":             topUp.Id,
			"trade_no":       topUp.TradeNo,
			"payment_method": topUp.PaymentMethod,
			"amount":         topUp.Amount,
			"money":          topUp.Money,
			"status":         topUp.Status,
		},
		"invitee": map[string]interface{}{
			"id":           invitee.Id,
			"username":     invitee.Username,
			"display_name": invitee.DisplayName,
			"inviter_id":   invitee.InviterId,
		},
		"agent": map[string]interface{}{
			"id":                          agent.Id,
			"username":                    agent.Username,
			"display_name":                agent.DisplayName,
			"agent_rebate_rate_bps":       agent.AgentRebateRateBps,
			"agent_rebate_balance":        agent.AgentRebateBalance,
			"agent_rebate_history_amount": agent.AgentRebateHistoryAmount,
		},
		"note": note,
	}
	data, err := common.Marshal(snapshot)
	if err != nil {
		return ""
	}
	return string(data)
}

func ApplyAgentRebateForTopUp(topUpID int) error {
	if topUpID <= 0 {
		return errors.New("无效的充值订单ID")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var topUp TopUp
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", topUpID).First(&topUp).Error; err != nil {
			return err
		}
		return applyAgentRebateForTopUpTx(tx, &topUp)
	})
}

func applyAgentRebateForTopUpTx(tx *gorm.DB, topUp *TopUp) error {
	if tx == nil || topUp == nil {
		return errors.New("无效的返利充值上下文")
	}
	if topUp.Status != common.TopUpStatusSuccess {
		return nil
	}

	var existing AgentRebateRecord
	if err := tx.Where("top_up_id = ? AND record_type = ?", topUp.Id, AgentRebateRecordTypeTopUp).First(&existing).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	var invitee User
	if err := tx.Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId <= 0 {
		return nil
	}

	var agent User
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", invitee.InviterId).First(&agent).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if !agent.IsAgent || agent.AgentRebateRateBps <= 0 {
		return nil
	}

	rebateAmount := decimal.NewFromFloat(topUp.Money).
		Mul(decimal.NewFromInt(int64(agent.AgentRebateRateBps))).
		Div(decimal.NewFromInt(10000)).
		Round(6).
		InexactFloat64()
	rebateAmount = normalizeAgentRebateMoney(rebateAmount)
	if rebateAmount <= 0 {
		return nil
	}

	agent.AgentRebateBalance = normalizeAgentRebateMoney(agent.AgentRebateBalance + rebateAmount)
	agent.AgentRebateHistoryAmount = normalizeAgentRebateMoney(agent.AgentRebateHistoryAmount + rebateAmount)

	record := &AgentRebateRecord{
		AgentUserId:      agent.Id,
		InviteeUserId:    invitee.Id,
		TopUpId:          &topUp.Id,
		TradeNo:          topUp.TradeNo,
		PaymentMethod:    topUp.PaymentMethod,
		PaymentAmount:    normalizeAgentRebateMoney(topUp.Money),
		RebateRateBps:    agent.AgentRebateRateBps,
		RebateAmount:     rebateAmount,
		BalanceAfter:     agent.AgentRebateBalance,
		RecordType:       AgentRebateRecordTypeTopUp,
		TopUpCompletedAt: topUp.CompleteTime,
		Snapshot:         buildAgentRebateSnapshot(topUp, &invitee, &agent, "auto topup rebate"),
	}
	if err := tx.Create(record).Error; err != nil {
		return err
	}

	return tx.Model(&User{}).Where("id = ?", agent.Id).Updates(map[string]interface{}{
		"is_agent":                    agent.IsAgent,
		"agent_rebate_rate_bps":       agent.AgentRebateRateBps,
		"agent_rebate_balance":        agent.AgentRebateBalance,
		"agent_rebate_history_amount": agent.AgentRebateHistoryAmount,
	}).Error
}

func AdjustAgentRebateBalance(adminUserId int, adminUsername string, targetUserId int, mode string, amount float64, note string) error {
	if targetUserId <= 0 {
		return errors.New("无效的用户ID")
	}
	amount = normalizeAgentRebateMoney(amount)
	if amount < 0 {
		return errors.New("无效的返利金额")
	}
	note = strings.TrimSpace(note)

	return DB.Transaction(func(tx *gorm.DB) error {
		var agent User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", targetUserId).First(&agent).Error; err != nil {
			return err
		}
		if !agent.IsAgent {
			return errors.New("目标用户不是代理人")
		}

		oldBalance := normalizeAgentRebateMoney(agent.AgentRebateBalance)
		oldHistory := normalizeAgentRebateMoney(agent.AgentRebateHistoryAmount)
		newBalance := oldBalance
		newHistory := oldHistory
		delta := 0.0

		switch mode {
		case "add":
			if amount <= 0 {
				return errors.New("调整金额必须大于0")
			}
			delta = amount
			newBalance = normalizeAgentRebateMoney(oldBalance + amount)
			newHistory = normalizeAgentRebateMoney(oldHistory + amount)
		case "subtract":
			if amount <= 0 {
				return errors.New("调整金额必须大于0")
			}
			if amount > oldBalance {
				return errors.New("代理返利余额不足")
			}
			delta = -amount
			newBalance = normalizeAgentRebateMoney(oldBalance - amount)
			newHistory = normalizeAgentRebateMoney(oldHistory - amount)
			if newHistory < 0 {
				newHistory = 0
			}
		case "override":
			newBalance = amount
			delta = normalizeAgentRebateMoney(amount - oldBalance)
			newHistory = normalizeAgentRebateMoney(oldHistory + delta)
			if newHistory < 0 {
				newHistory = 0
			}
		default:
			return errors.New("无效的调整模式")
		}

		if err := tx.Model(&User{}).Where("id = ?", agent.Id).Updates(map[string]interface{}{
			"agent_rebate_balance":        newBalance,
			"agent_rebate_history_amount": newHistory,
		}).Error; err != nil {
			return err
		}

		record := &AgentRebateRecord{
			AgentUserId:      agent.Id,
			InviteeUserId:    0,
			PaymentAmount:    0,
			RebateRateBps:    agent.AgentRebateRateBps,
			RebateAmount:     delta,
			BalanceAfter:     newBalance,
			RecordType:       AgentRebateRecordTypeAdjustment,
			Note:             note,
			OperatorUserId:   adminUserId,
			OperatorUsername: adminUsername,
			Snapshot:         fmt.Sprintf(`{"mode":%q,"old_balance":%.6f,"new_balance":%.6f}`, mode, oldBalance, newBalance),
		}
		return tx.Create(record).Error
	})
}

func GetAgentRebateSummary(agentUserId int) (*AgentRebateSummary, error) {
	if agentUserId <= 0 {
		return nil, errors.New("无效的用户ID")
	}

	var user User
	if err := DB.Select("id", "is_agent", "agent_rebate_rate_bps", "agent_rebate_balance", "agent_rebate_history_amount", "aff_count").Where("id = ?", agentUserId).First(&user).Error; err != nil {
		return nil, err
	}

	var recordCount int64
	if err := DB.Model(&AgentRebateRecord{}).Where("agent_user_id = ?", agentUserId).Count(&recordCount).Error; err != nil {
		return nil, err
	}

	return &AgentRebateSummary{
		IsAgent:                  user.IsAgent,
		AgentRebateRateBps:       user.AgentRebateRateBps,
		AgentRebateBalance:       normalizeAgentRebateMoney(user.AgentRebateBalance),
		AgentRebateHistoryAmount: normalizeAgentRebateMoney(user.AgentRebateHistoryAmount),
		InviteeCount:             user.AffCount,
		RecordCount:              recordCount,
	}, nil
}

func GetAgentRebateRecords(agentUserId int, pageInfo *common.PageInfo) ([]AgentRebateRecordItem, int64, error) {
	if agentUserId <= 0 {
		return nil, 0, errors.New("无效的用户ID")
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var total int64
	query := tx.Model(&AgentRebateRecord{}).Where("agent_user_id = ?", agentUserId)
	if err := query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	var records []AgentRebateRecord
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&records).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	inviteeIDs := make([]int, 0, len(records))
	seen := make(map[int]struct{}, len(records))
	for _, record := range records {
		if record.InviteeUserId <= 0 {
			continue
		}
		if _, ok := seen[record.InviteeUserId]; ok {
			continue
		}
		seen[record.InviteeUserId] = struct{}{}
		inviteeIDs = append(inviteeIDs, record.InviteeUserId)
	}

	invitees := make(map[int]User, len(inviteeIDs))
	if len(inviteeIDs) > 0 {
		var users []User
		if err := tx.Select("id", "username", "display_name").Where("id IN ?", inviteeIDs).Find(&users).Error; err != nil {
			tx.Rollback()
			return nil, 0, err
		}
		for _, user := range users {
			invitees[user.Id] = user
		}
	}

	items := make([]AgentRebateRecordItem, 0, len(records))
	for _, record := range records {
		invitee := invitees[record.InviteeUserId]
		inviteeName := invitee.DisplayName
		if strings.TrimSpace(inviteeName) == "" {
			inviteeName = invitee.Username
		}
		items = append(items, AgentRebateRecordItem{
			Id:               record.Id,
			InviteeUserId:    record.InviteeUserId,
			InviteeUsername:  invitee.Username,
			InviteeName:      inviteeName,
			TradeNo:          record.TradeNo,
			PaymentMethod:    record.PaymentMethod,
			PaymentAmount:    normalizeAgentRebateMoney(record.PaymentAmount),
			RebateRateBps:    record.RebateRateBps,
			RebateAmount:     normalizeAgentRebateMoney(record.RebateAmount),
			BalanceAfter:     normalizeAgentRebateMoney(record.BalanceAfter),
			RecordType:       record.RecordType,
			Note:             record.Note,
			OperatorUserId:   record.OperatorUserId,
			OperatorUsername: record.OperatorUsername,
			TopUpCompletedAt: record.TopUpCompletedAt,
			CreatedAt:        record.CreatedAt,
		})
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}
