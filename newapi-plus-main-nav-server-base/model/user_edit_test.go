package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUserEdit_PreservesQuota(t *testing.T) {
	truncateTables(t)

	original := &User{
		Id:          901,
		Username:    "quota_edit_guard",
		DisplayName: "Before",
		Group:       "default",
		Remark:      "before",
		Status:      common.UserStatusEnabled,
		Role:        common.RoleCommonUser,
		Quota:       123456,
	}
	require.NoError(t, DB.Create(original).Error)

	edited := &User{
		Id:          original.Id,
		Username:    original.Username,
		DisplayName: "After",
		Group:       "vip",
		Remark:      "after",
	}
	require.NoError(t, edited.Edit(false))

	var reloaded User
	require.NoError(t, DB.First(&reloaded, original.Id).Error)
	require.Equal(t, 123456, reloaded.Quota)
	require.Equal(t, "After", reloaded.DisplayName)
	require.Equal(t, "vip", reloaded.Group)
	require.Equal(t, "after", reloaded.Remark)
}
