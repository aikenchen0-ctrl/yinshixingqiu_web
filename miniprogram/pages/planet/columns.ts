interface ColumnItem {
  id: string
  title: string
  count: string
}

Page({
  data: {
    columns: [
      { id: 'col1', title: '100个MCP案例', count: '3' },
      { id: 'col2', title: '商业案例拆解', count: '3' },
      { id: 'col3', title: 'AI编程', count: '9' },
      { id: 'col4', title: '100个创业项目', count: '67' },
      { id: 'col5', title: 'AI工具测评', count: '13' },
      { id: 'col6', title: '易安AI工具库', count: '4' },
      { id: 'col7', title: 'DeepSeek', count: '5' },
      { id: 'col8', title: '商业洞察', count: '4' },
      { id: 'col9', title: '2025勤商', count: '57' },
      { id: 'col10', title: '易安学思维模型', count: '15' },
    ] as ColumnItem[],
  },
})
