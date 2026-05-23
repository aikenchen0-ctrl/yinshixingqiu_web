/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  renderQuota,
  getCurrencyConfig,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  InputNumber,
  Input,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconLink,
  IconUserGroup,
  IconEdit,
} from '@douyinfe/semi-icons';
import UserBindingManagementModal from './UserBindingManagementModal';

const { Text, Title } = Typography;

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const userId = props.editingUser.id;
  const [loading, setLoading] = useState(true);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustQuotaLocal, setAdjustQuotaLocal] = useState('');
  const [adjustAmountLocal, setAdjustAmountLocal] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [agentAdjustModalOpen, setAgentAdjustModalOpen] = useState(false);
  const [agentAdjustMode, setAgentAdjustMode] = useState('add');
  const [agentAdjustAmount, setAgentAdjustAmount] = useState('');
  const [agentAdjustNote, setAgentAdjustNote] = useState('');
  const [agentAdjustLoading, setAgentAdjustLoading] = useState(false);
  const [agentToggleLoading, setAgentToggleLoading] = useState(false);
  const isMobile = useIsMobile();
  const [groupOptions, setGroupOptions] = useState([]);
  const [bindingModalVisible, setBindingModalVisible] = useState(false);
  const formApiRef = useRef(null);
  const [showAdjustQuotaRaw, setShowAdjustQuotaRaw] = useState(false);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  const [inputs, setInputs] = useState(null);

  const isEdit = Boolean(userId);

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    github_id: '',
    oidc_id: '',
    discord_id: '',
    wechat_id: '',
    telegram_id: '',
    linux_do_id: '',
    email: '',
    quota: 0,
    quota_amount: 0,
    group: 'default',
    remark: '',
    is_agent: false,
    agent_rebate_rate_percent: 0,
    agent_rebate_balance: 0,
    agent_rebate_history_amount: 0,
  });

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      setGroupOptions(res.data.data.map((g) => ({ label: g, value: g })));
    } catch (e) {
      showError(e.message);
    }
  };

  const handleCancel = () => props.handleClose();

  const loadUser = async () => {
    setLoading(true);
    const url = userId ? `/api/user/${userId}` : `/api/user/self`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      data.password = '';
      data.quota_amount = Number(
        quotaToDisplayAmount(data.quota || 0).toFixed(6),
      );
      data.agent_rebate_rate_percent = Number(
        (Number(data.agent_rebate_rate_bps || 0) / 100).toFixed(2),
      );
      setInputs({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (inputs && formApiRef.current) {
      formApiRef.current.setValues(inputs);
    }
  }, [inputs]);

  useEffect(() => {
    loadUser();
    if (userId) fetchGroups();
    setBindingModalVisible(false);
  }, [props.editingUser.id]);

  const openBindingModal = () => {
    setBindingModalVisible(true);
  };

  const closeBindingModal = () => {
    setBindingModalVisible(false);
  };

  const formatAgentMoney = (amount) => {
    const symbol = getCurrencyConfig().symbol || '$';
    return `${symbol}${Number(amount || 0).toFixed(6)}`;
  };

  const refreshLoadedUser = async () => {
    await loadUser();
    props.refresh();
  };

  /* ----------------------- submit ----------------------- */
  const submit = async (values) => {
    setLoading(true);
    let payload = { ...values };
    delete payload.quota;
    delete payload.quota_amount;
    payload.agent_rebate_rate_bps = Math.round(
      Number(payload.agent_rebate_rate_percent || 0) * 100,
    );
    delete payload.agent_rebate_rate_percent;
    delete payload.agent_rebate_balance;
    delete payload.agent_rebate_history_amount;
    if (userId) {
      payload.id = parseInt(userId);
    }
    const url = userId ? `/api/user/` : `/api/user/self`;
    const res = await API.put(url, payload);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('用户信息更新成功！'));
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  /* --------------------- atomic quota adjust -------------------- */
  const adjustQuota = async () => {
    const rawQuota =
      adjustQuotaLocal === '' || adjustQuotaLocal == null
        ? NaN
        : parseInt(adjustQuotaLocal, 10);
    const rawAmount =
      adjustAmountLocal === '' || adjustAmountLocal == null
        ? NaN
        : Number(adjustAmountLocal);
    const fallbackQuota = Number.isFinite(rawAmount)
      ? displayAmountToQuota(rawAmount)
      : 0;

    let effectiveQuota =
      Number.isFinite(rawQuota) && rawQuota !== 0 ? rawQuota : fallbackQuota;

    if (adjustMode === 'override') {
      if (!Number.isFinite(effectiveQuota)) {
        showError(t('请输入额度'));
        return;
      }
    } else {
      effectiveQuota = Math.abs(effectiveQuota);
      if (!Number.isFinite(effectiveQuota) || effectiveQuota <= 0) {
        showError(t('请输入有效的数字'));
        return;
      }
    }

    effectiveQuota = Math.trunc(effectiveQuota);
    if (!Number.isFinite(effectiveQuota) || effectiveQuota < 0) {
      showError(t('请输入有效的数字'));
      return;
    }
    setAdjustLoading(true);
    try {
      const res = await API.post('/api/user/manage', {
        id: parseInt(userId),
        action: 'add_quota',
        mode: adjustMode,
        value: effectiveQuota,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('调整额度成功'));
        setAdjustModalOpen(false);
        setAdjustQuotaLocal('');
        setAdjustAmountLocal('');
        await refreshLoadedUser();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
    setAdjustLoading(false);
  };

  const getAgentAdjustPreviewText = () => {
    const current = Number(inputs?.agent_rebate_balance || 0);
    const val = Number(agentAdjustAmount || 0);
    switch (agentAdjustMode) {
      case 'add':
        return `${t('当前返利余额')}：${formatAgentMoney(current)}，+${formatAgentMoney(Math.abs(val))} = ${formatAgentMoney(current + Math.abs(val))}`;
      case 'subtract':
        return `${t('当前返利余额')}：${formatAgentMoney(current)}，-${formatAgentMoney(Math.abs(val))} = ${formatAgentMoney(Math.max(current - Math.abs(val), 0))}`;
      case 'override':
        return `${t('当前返利余额')}：${formatAgentMoney(current)} → ${formatAgentMoney(val)}`;
      default:
        return '';
    }
  };

  const adjustAgentRebate = async () => {
    const amount = Number(agentAdjustAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      showError(t('请输入有效的返利金额'));
      return;
    }
    if (
      (agentAdjustMode === 'add' || agentAdjustMode === 'subtract') &&
      amount <= 0
    ) {
      showError(t('请输入有效的返利金额'));
      return;
    }

    setAgentAdjustLoading(true);
    try {
      const res = await API.post(`/api/user/${userId}/agent_rebate/adjust`, {
        mode: agentAdjustMode,
        amount,
        note: agentAdjustNote,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('代理返利余额调整成功'));
        setAgentAdjustModalOpen(false);
        setAgentAdjustMode('add');
        setAgentAdjustAmount('');
        setAgentAdjustNote('');
        await refreshLoadedUser();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
    setAgentAdjustLoading(false);
  };

  const toggleAgentStatus = async (checked) => {
    if (!userId) {
      return;
    }

    const previous = Boolean(inputs?.is_agent);
    const nextInputs = {
      ...(inputs || getInitValues()),
      is_agent: checked,
      agent_rebate_rate_percent: Number(inputs?.agent_rebate_rate_percent || 0),
    };
    setInputs(nextInputs);
    formApiRef.current?.setValues(nextInputs);
    setAgentToggleLoading(true);

    try {
      const rebateRateBps = checked
        ? Math.round(Number(nextInputs.agent_rebate_rate_percent || 0) * 100)
        : undefined;
      const res = await API.patch(`/api/user/${userId}/agent`, {
        is_agent: checked,
        ...(rebateRateBps === undefined
          ? {}
          : { agent_rebate_rate_bps: rebateRateBps }),
      });
      const { success, message, data } = res.data;
      if (!success) {
        throw new Error(message || t('代理人状态更新失败'));
      }

      const updatedInputs = {
        ...nextInputs,
        is_agent: Boolean(data?.is_agent),
        agent_rebate_rate_percent: Number(
          (Number(data?.agent_rebate_rate_bps || 0) / 100).toFixed(2),
        ),
        agent_rebate_balance: Number(data?.agent_rebate_balance || 0),
        agent_rebate_history_amount: Number(
          data?.agent_rebate_history_amount || 0,
        ),
      };
      setInputs(updatedInputs);
      formApiRef.current?.setValues(updatedInputs);
      showSuccess(checked ? t('已开启代理人身份') : t('已关闭代理人身份'));
      props.refresh();
    } catch (error) {
      const rolledBackInputs = {
        ...(inputs || getInitValues()),
        is_agent: previous,
      };
      setInputs(rolledBackInputs);
      formApiRef.current?.setValues(rolledBackInputs);
      showError(error.message || t('代理人状态更新失败'));
    }

    setAgentToggleLoading(false);
  };

  const getPreviewText = () => {
    const current = formApiRef.current?.getValue('quota') || 0;
    const val = parseInt(adjustQuotaLocal) || 0;
    let result;
    switch (adjustMode) {
      case 'add':
        result = current + Math.abs(val);
        return `${t('当前额度')}：${renderQuota(current)}，+${renderQuota(Math.abs(val))} = ${renderQuota(result)}`;
      case 'subtract':
        result = current - Math.abs(val);
        return `${t('当前额度')}：${renderQuota(current)}，-${renderQuota(Math.abs(val))} = ${renderQuota(result)}`;
      case 'override':
        return `${t('当前额度')}：${renderQuota(current)} → ${renderQuota(val)}`;
      default:
        return '';
    }
  };

  /* --------------------------- UI --------------------------- */
  return (
    <>
      <SideSheet
        placement='right'
        title={
          <Space>
            <Tag color='blue' shape='circle'>
              {t(isEdit ? '编辑' : '新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('编辑用户') : t('创建用户')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: 0 }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={handleCancel}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2 space-y-3'>
                {/* 基本信息 */}
                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconUser size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('用户的基本账户信息')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='username'
                        label={t('用户名')}
                        placeholder={t('请输入新的用户名')}
                        rules={[{ required: true, message: t('请输入用户名') }]}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='password'
                        label={t('密码')}
                        placeholder={t('请输入新的密码，最短 8 位')}
                        mode='password'
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='display_name'
                        label={t('显示名称')}
                        placeholder={t('请输入新的显示名称')}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='remark'
                        label={t('备注')}
                        placeholder={t('请输入备注（仅管理员可见）')}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 权限设置 */}
                {userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color='green'
                        className='mr-2 shadow-md'
                      >
                        <IconUserGroup size={16} />
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {t('权限设置')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('用户分组和额度管理')}
                        </div>
                      </div>
                    </div>

                    <Row gutter={12}>
                      <Col span={24}>
                        <Form.Select
                          field='group'
                          label={t('分组')}
                          placeholder={t('请选择分组')}
                          optionList={groupOptions}
                          allowAdditions
                          search
                          rules={[{ required: true, message: t('请选择分组') }]}
                        />
                      </Col>

                      <Col span={10}>
                        <Form.InputNumber
                          field='quota_amount'
                          label={t('金额')}
                          prefix={getCurrencyConfig().symbol}
                          precision={6}
                          step={0.000001}
                          style={{ width: '100%' }}
                          readonly
                        />
                      </Col>

                      <Col span={14}>
                        <Form.Slot label={t('调整额度')}>
                          <Button
                            icon={<IconEdit />}
                            onClick={() => setAdjustModalOpen(true)}
                          >
                            {t('调整额度')}
                          </Button>
                        </Form.Slot>
                      </Col>

                      <Col span={24}>
                        <div
                          className='text-xs cursor-pointer'
                          style={{ color: 'var(--semi-color-text-2)' }}
                          onClick={() => setShowQuotaInput((v) => !v)}
                        >
                          {showQuotaInput
                            ? `▾ ${t('收起原生额度输入')}`
                            : `▸ ${t('使用原生额度输入')}`}
                        </div>
                        <div
                          style={{ display: showQuotaInput ? 'block' : 'none' }}
                          className='mt-2'
                        >
                          <Form.InputNumber
                            field='quota'
                            label={t('额度')}
                            placeholder={t('请输入额度')}
                            style={{ width: '100%' }}
                            readonly
                          />
                        </div>
                      </Col>
                    </Row>
                  </Card>
                )}

                {userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center mb-2'>
                      <Avatar
                        size='small'
                        color='orange'
                        className='mr-2 shadow-md'
                      >
                        <IconUserGroup size={16} />
                      </Avatar>
                      <div>
                        <Text className='text-lg font-medium'>
                          {t('代理返利')}
                        </Text>
                        <div className='text-xs text-gray-600'>
                          {t('代理身份、返点比例和独立返利余额')}
                        </div>
                      </div>
                    </div>

                    <Row gutter={12}>
                      <Col span={24}>
                        <Form.Switch
                          field='is_agent'
                          label={t('是否为代理人')}
                          disabled={agentToggleLoading}
                          onChange={toggleAgentStatus}
                        />
                      </Col>

                      <Col span={24}>
                        <Form.InputNumber
                          field='agent_rebate_rate_percent'
                          label={t('返点比例 (%)')}
                          min={0}
                          max={100}
                          precision={2}
                          step={0.1}
                          style={{ width: '100%' }}
                          disabled={!values.is_agent}
                        />
                      </Col>

                      <Col span={12}>
                        <Form.Slot label={t('当前返利余额')}>
                          <Text strong>
                            {formatAgentMoney(inputs?.agent_rebate_balance)}
                          </Text>
                        </Form.Slot>
                      </Col>

                      <Col span={12}>
                        <Form.Slot label={t('累计返利')}>
                          <Text strong>
                            {formatAgentMoney(
                              inputs?.agent_rebate_history_amount,
                            )}
                          </Text>
                        </Form.Slot>
                      </Col>

                      <Col span={24}>
                        <Form.Slot label={t('人工调整返利余额')}>
                          <Button
                            icon={<IconEdit />}
                            disabled={!values.is_agent}
                            onClick={() => setAgentAdjustModalOpen(true)}
                          >
                            {t('调整返利余额')}
                          </Button>
                        </Form.Slot>
                        {!values.is_agent ? (
                          <div className='text-xs text-gray-600 mt-1'>
                            {t('仅代理人账号可使用独立返利余额')}
                          </div>
                        ) : null}
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* 绑定信息入口 */}
                {userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='flex items-center min-w-0'>
                        <Avatar
                          size='small'
                          color='purple'
                          className='mr-2 shadow-md'
                        >
                          <IconLink size={16} />
                        </Avatar>
                        <div className='min-w-0'>
                          <Text className='text-lg font-medium'>
                            {t('绑定信息')}
                          </Text>
                          <div className='text-xs text-gray-600'>
                            {t('管理用户已绑定的第三方账户，支持筛选与解绑')}
                          </div>
                        </div>
                      </div>
                      <Button
                        type='primary'
                        theme='outline'
                        onClick={openBindingModal}
                      >
                        {t('管理绑定')}
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>

      <UserBindingManagementModal
        visible={bindingModalVisible}
        onCancel={closeBindingModal}
        userId={userId}
        isMobile={isMobile}
        formApiRef={formApiRef}
      />

      {/* 调整额度模态框 */}
      <Modal
        centered
        visible={agentAdjustModalOpen}
        onOk={adjustAgentRebate}
        onCancel={() => {
          setAgentAdjustModalOpen(false);
          setAgentAdjustMode('add');
          setAgentAdjustAmount('');
          setAgentAdjustNote('');
        }}
        confirmLoading={agentAdjustLoading}
        closable={null}
        title={
          <div className='flex items-center'>
            <IconEdit className='mr-2' />
            {t('调整代理返利余额')}
          </div>
        }
      >
        <div className='mb-4'>
          <Text type='secondary' className='block mb-2'>
            {getAgentAdjustPreviewText()}
          </Text>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('操作')}</Text>
          </div>
          <RadioGroup
            type='button'
            value={agentAdjustMode}
            onChange={(e) => {
              setAgentAdjustMode(e.target.value);
              setAgentAdjustAmount('');
            }}
            style={{ width: '100%' }}
          >
            <Radio value='add'>{t('添加')}</Radio>
            <Radio value='subtract'>{t('减少')}</Radio>
            <Radio value='override'>{t('覆盖')}</Radio>
          </RadioGroup>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('返利金额')}</Text>
          </div>
          <InputNumber
            prefix={getCurrencyConfig().symbol}
            placeholder={t('输入返利金额')}
            value={agentAdjustAmount}
            precision={6}
            min={0}
            step={0.000001}
            onChange={(val) =>
              setAgentAdjustAmount(val === '' || val == null ? '' : val)
            }
            style={{ width: '100%' }}
            showClear
          />
        </div>
        <div>
          <div className='mb-1'>
            <Text size='small'>{t('备注')}</Text>
          </div>
          <Input
            value={agentAdjustNote}
            onChange={(value) => setAgentAdjustNote(value)}
            placeholder={t('例如：退款手动扣减')}
            showClear
          />
        </div>
      </Modal>

      <Modal
        centered
        visible={adjustModalOpen}
        onOk={adjustQuota}
        onCancel={() => {
          setAdjustModalOpen(false);
          setAdjustQuotaLocal('');
          setAdjustAmountLocal('');
          setAdjustMode('add');
        }}
        confirmLoading={adjustLoading}
        closable={null}
        title={
          <div className='flex items-center'>
            <IconEdit className='mr-2' />
            {t('调整额度')}
          </div>
        }
      >
        <div className='mb-4'>
          <Text type='secondary' className='block mb-2'>
            {getPreviewText()}
          </Text>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('操作')}</Text>
          </div>
          <RadioGroup
            type='button'
            value={adjustMode}
            onChange={(e) => {
              setAdjustMode(e.target.value);
              setAdjustQuotaLocal('');
              setAdjustAmountLocal('');
            }}
            style={{ width: '100%' }}
          >
            <Radio value='add'>{t('添加')}</Radio>
            <Radio value='subtract'>{t('减少')}</Radio>
            <Radio value='override'>{t('覆盖')}</Radio>
          </RadioGroup>
        </div>
        <div className='mb-3'>
          <div className='mb-1'>
            <Text size='small'>{t('金额')}</Text>
          </div>
          <InputNumber
            prefix={getCurrencyConfig().symbol}
            placeholder={t('输入金额')}
            value={adjustAmountLocal}
            precision={6}
            min={adjustMode === 'override' ? undefined : 0}
            step={0.000001}
            onChange={(val) => {
              const amount = val === '' || val == null ? '' : val;
              setAdjustAmountLocal(amount);
              setAdjustQuotaLocal(
                amount === ''
                  ? ''
                  : adjustMode === 'override'
                    ? displayAmountToQuota(amount)
                    : displayAmountToQuota(Math.abs(amount)),
              );
            }}
            style={{ width: '100%' }}
            showClear
          />
        </div>
        <div
          className='text-xs cursor-pointer mt-2'
          style={{ color: 'var(--semi-color-text-2)' }}
          onClick={() => setShowAdjustQuotaRaw((v) => !v)}
        >
          {showAdjustQuotaRaw
            ? `▾ ${t('收起原生额度输入')}`
            : `▸ ${t('使用原生额度输入')}`}
        </div>
        <div
          style={{ display: showAdjustQuotaRaw ? 'block' : 'none' }}
          className='mt-2'
        >
          <div className='mb-1'>
            <Text size='small'>{t('额度')}</Text>
          </div>
          <InputNumber
            placeholder={t('输入额度')}
            value={adjustQuotaLocal}
            min={adjustMode === 'override' ? undefined : 0}
            onChange={(val) => {
              const quota = val === '' || val == null ? '' : val;
              setAdjustQuotaLocal(quota);
              setAdjustAmountLocal(
                quota === ''
                  ? ''
                  : adjustMode === 'override'
                    ? Number(quotaToDisplayAmount(quota).toFixed(6))
                    : Number(quotaToDisplayAmount(Math.abs(quota)).toFixed(6)),
              );
            }}
            style={{ width: '100%' }}
            showClear
            step={500000}
          />
        </div>
      </Modal>
    </>
  );
};

export default EditUserModal;
