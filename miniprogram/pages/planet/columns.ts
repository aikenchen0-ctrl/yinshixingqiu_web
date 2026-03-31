interface ColumnItem {
  id: string
  title: string
  count: string
  expanded: boolean
  items: string[]
}

Page({
  data: {
    columns: [
      {
        id: 'col1',
        title: '100个MCP案例',
        count: '3',
        expanded: true,
        items: [
          '飞书MCP这里面的可玩性太多了，除了我文章里的案例外随便提几个。',
          '手把手教你用Firecrawl MCP做知识星球分析',
          '手把手教你用高德地图API和Claude的MCP功能打造智能旅游助手！',
        ],
      },
      {
        id: 'col2',
        title: '商业案例拆解',
        count: '3',
        expanded: false,
        items: [
          '拆解一条爆款内容从选题、转化到复购的完整路径。',
          '分析知识付费项目如何用低成本验证用户需求。',
          '复盘社群项目中高留存运营机制的关键动作。',
        ],
      },
      {
        id: 'col3',
        title: 'AI编程',
        count: '9',
        expanded: false,
        items: [
          '从0到1搭建可复用的AI工作流。',
          '用原生能力做小程序功能，而不是先堆库。',
          'AI协作开发里怎样拆任务最省心。',
        ],
      },
      { id: 'col4', title: '100个创业项目', count: '67', expanded: false, items: [] },
      { id: 'col5', title: 'AI工具测评', count: '13', expanded: false, items: [] },
      { id: 'col6', title: '易安AI工具库', count: '4', expanded: false, items: [] },
      { id: 'col7', title: 'DeepSeek', count: '5', expanded: false, items: [] },
      { id: 'col8', title: '商业洞察', count: '4', expanded: false, items: [] },
      { id: 'col9', title: '2025勤商', count: '57', expanded: false, items: [] },
      { id: 'col10', title: '易安学思维模型', count: '15', expanded: false, items: [] },
    ] as ColumnItem[],
  },

  onToggleColumn(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || ''
    const nextColumns = this.data.columns.map((column) => {
      if (column.id === id) {
        return {
          ...column,
          expanded: !column.expanded,
        }
      }

      return {
        ...column,
        expanded: false,
      }
    })

    this.setData({
      columns: nextColumns,
    })
  },
})
