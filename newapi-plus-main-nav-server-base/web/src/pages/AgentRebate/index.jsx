import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Table, Tag, Typography, Space } from '@douyinfe/semi-ui';
import { Gift, TrendingUp, Users, Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  API,
  getCurrencyConfig,
  showError,
  timestamp2string,
} from '../../helpers';

const { Text } = Typography;

const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
  alipay: '支付宝',
  wxpay: '微信',
};

const RECORD_TYPE_MAP = {
  topup: '充值返利',
  adjustment: '人工调整',
};

function formatRateBps(rateBps) {
  return `${(Number(rateBps || 0) / 100).toFixed(2)}%`;
}

function formatMoney(amount) {
  const symbol = getCurrencyConfig().symbol || '$';
  return `${symbol}${Number(amount || 0).toFixed(6)}`;
}

function AgentRebatePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [notAgent, setNotAgent] = useState(false);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async (currentPage, currentPageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/agent_rebate?p=${currentPage}&page_size=${currentPageSize}`,
      );
      const { success, data } = res.data;
      if (!success) {
        setNotAgent(true);
        setSummary(null);
        setRecords([]);
        setTotal(0);
        return;
      }
      setNotAgent(false);
      setSummary(data.summary || null);
      setRecords(data.page?.items || []);
      setTotal(data.page?.total || 0);
    } catch (error) {
      setNotAgent(true);
      showError(t('加载代理返利失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page, pageSize);
  }, [page, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: t('时间'),
        dataIndex: 'top_up_completed_at',
        render: (_, record) =>
          timestamp2string(record.top_up_completed_at || record.created_at),
      },
      {
        title: t('类型'),
        dataIndex: 'record_type',
        render: (value) => (
          <Tag
            color={value === 'adjustment' ? 'orange' : 'green'}
            shape='circle'
          >
            {t(RECORD_TYPE_MAP[value] || value)}
          </Tag>
        ),
      },
      {
        title: t('被邀请用户'),
        dataIndex: 'invitee_name',
        render: (_, record) => {
          if (!record.invitee_user_id) {
            return <Text type='tertiary'>-</Text>;
          }
          return (
            <div>
              <div>{record.invitee_name || '-'}</div>
              <Text type='tertiary' size='small'>
                {record.invitee_username || '-'}
              </Text>
            </div>
          );
        },
      },
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        render: (value) => (value ? <Text copyable>{value}</Text> : '-'),
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        render: (value) => PAYMENT_METHOD_MAP[value] || value || '-',
      },
      {
        title: t('支付金额'),
        dataIndex: 'payment_amount',
        render: (value) => (Number(value || 0) > 0 ? formatMoney(value) : '-'),
      },
      {
        title: t('返点比例'),
        dataIndex: 'rebate_rate_bps',
        render: (value) => formatRateBps(value),
      },
      {
        title: t('返利金额'),
        dataIndex: 'rebate_amount',
        render: (value) => {
          const amount = Number(value || 0);
          const display = formatMoney(Math.abs(amount));
          return (
            <Text type={amount < 0 ? 'danger' : 'success'}>
              {amount < 0 ? '-' : '+'}
              {display}
            </Text>
          );
        },
      },
      {
        title: t('余额快照'),
        dataIndex: 'balance_after',
        render: (value) => formatMoney(value || 0),
      },
      {
        title: t('备注'),
        dataIndex: 'note',
        render: (_, record) => {
          if (!record.note && !record.operator_username) {
            return <Text type='tertiary'>-</Text>;
          }
          return (
            <div>
              <div>{record.note || '-'}</div>
              {record.operator_username ? (
                <Text type='tertiary' size='small'>
                  {t('操作人')}: {record.operator_username}
                </Text>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t],
  );

  if (notAgent) {
    return (
      <Card className='!rounded-2xl shadow-sm border-0'>
        <Empty description={t('当前账号不是代理人，暂时无法查看返利数据')} />
      </Card>
    );
  }

  return (
    <div className='mt-[60px] px-2 space-y-4'>
      <Card className='!rounded-2xl shadow-sm border-0'>
        <div className='flex items-center mb-4'>
          <div className='mr-3 rounded-full bg-[var(--semi-color-success-light-default)] p-2'>
            <Gift size={18} />
          </div>
          <div>
            <Typography.Text className='text-lg font-medium'>
              {t('代理返利')}
            </Typography.Text>
            <div className='text-xs text-gray-600'>
              {t('查看邀请用户充值带来的返利明细和当前余额')}
            </div>
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <Card className='!rounded-xl border-0 bg-[var(--semi-color-fill-0)]'>
            <Space align='center'>
              <TrendingUp size={16} />
              <Text strong>{t('当前返利余额')}</Text>
            </Space>
            <div className='mt-3 text-xl font-semibold'>
              {formatMoney(summary?.agent_rebate_balance || 0)}
            </div>
          </Card>

          <Card className='!rounded-xl border-0 bg-[var(--semi-color-fill-0)]'>
            <Space align='center'>
              <Gift size={16} />
              <Text strong>{t('累计返利')}</Text>
            </Space>
            <div className='mt-3 text-xl font-semibold'>
              {formatMoney(summary?.agent_rebate_history_amount || 0)}
            </div>
          </Card>

          <Card className='!rounded-xl border-0 bg-[var(--semi-color-fill-0)]'>
            <Space align='center'>
              <Percent size={16} />
              <Text strong>{t('当前返点比例')}</Text>
            </Space>
            <div className='mt-3 text-xl font-semibold'>
              {formatRateBps(summary?.agent_rebate_rate_bps || 0)}
            </div>
          </Card>

          <Card className='!rounded-xl border-0 bg-[var(--semi-color-fill-0)]'>
            <Space align='center'>
              <Users size={16} />
              <Text strong>{t('已邀请用户数')}</Text>
            </Space>
            <div className='mt-3 text-xl font-semibold'>
              {summary?.invitee_count || 0}
            </div>
          </Card>
        </div>
      </Card>

      <Card className='!rounded-2xl shadow-sm border-0'>
        <Table
          columns={columns}
          dataSource={records}
          rowKey='id'
          loading={loading}
          pagination={{
            currentPage: page,
            pageSize,
            total,
            pageSizeOpts: [10, 20, 50],
            showSizeChanger: true,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          empty={<Empty description={t('暂无代理返利记录')} image={null} />}
        />
      </Card>
    </div>
  );
}

export default AgentRebatePage;
