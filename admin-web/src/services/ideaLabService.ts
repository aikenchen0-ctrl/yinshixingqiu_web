export type IdeaLabBoardSource = 'WEIBO' | 'TOUTIAO'

export interface IdeaLabBoardItem {
  rank: number
  title: string
  url: string
}

export interface IdeaLabBoardSection {
  source: IdeaLabBoardSource
  label: string
  items: IdeaLabBoardItem[]
}

export interface IdeaLabHotBoardPayload {
  ok: true
  data: {
    fetchedAt: string
    statement: string
    boards: IdeaLabBoardSection[]
  }
}

const hotBoardSample: IdeaLabHotBoardPayload = {
  ok: true,
  data: {
    fetchedAt: '2026-03-31T19:18:38+08:00',
    statement:
      '当前页面先按旧版管理端的热点榜结构还原，榜单内容使用参考 HTML 样例数据承接；后续接入 hot_board_snapshots / hot_board_items 后，可直接替换为实时热榜。',
    boards: [
      {
        source: 'WEIBO',
        label: '微博',
        items: [
          { rank: 1, title: '瑞幸 紫椰子', url: 'https://s.weibo.com/weibo?q=%23%E7%91%9E%E5%B9%B8+%E7%B4%AB%E6%A4%B0%E5%AD%90%23' },
          { rank: 2, title: '国足负于10人喀麦隆', url: 'https://s.weibo.com/weibo?q=%23%E5%9B%BD%E8%B6%B3%E8%B4%9F%E4%BA%8E10%E4%BA%BA%E5%96%80%E9%BA%A6%E9%9A%86%23' },
          { rank: 3, title: '4月一批新规将施行', url: 'https://s.weibo.com/weibo?q=%234%E6%9C%88%E4%B8%80%E6%89%B9%E6%96%B0%E8%A7%84%E5%B0%86%E6%96%BD%E8%A1%8C%23' },
          { rank: 4, title: '李健硬要给许飞版权费', url: 'https://s.weibo.com/weibo?q=%23%E6%9D%8E%E5%81%A5%E7%A1%AC%E8%A6%81%E7%BB%99%E8%AE%B8%E9%A3%9E%E7%89%88%E6%9D%83%E8%B4%B9%23' },
          { rank: 5, title: 'Ruler 韩国兵役', url: 'https://s.weibo.com/weibo?q=%23Ruler+%E9%9F%A9%E5%9B%BD%E5%85%B5%E5%BD%B9%23' },
          { rank: 6, title: '麻辣烫里最夯的是啥菜', url: 'https://s.weibo.com/weibo?q=%23%E9%BA%BB%E8%BE%A3%E7%83%AB%E9%87%8C%E6%9C%80%E5%A4%AF%E7%9A%84%E6%98%AF%E5%95%A5%E8%8F%9C%23' },
          { rank: 7, title: '张雪', url: 'https://s.weibo.com/weibo?q=%23%E5%BC%A0%E9%9B%AA%23' },
          { rank: 8, title: '范世錡工作室回应被删', url: 'https://s.weibo.com/weibo?q=%23%E8%8C%83%E4%B8%96%E9%8C%A1%E5%B7%A5%E4%BD%9C%E5%AE%A4%E5%9B%9E%E5%BA%94%E8%A2%AB%E5%88%A0%23' },
          { rank: 9, title: '米饭拌白糖', url: 'https://s.weibo.com/weibo?q=%23%E7%B1%B3%E9%A5%AD%E6%8B%8C%E7%99%BD%E7%B3%96%23' },
          { rank: 10, title: 'B站明日将下线猜你喜欢算法', url: 'https://s.weibo.com/weibo?q=%23B%E7%AB%99%E6%98%8E%E6%97%A5%E5%B0%86%E4%B8%8B%E7%BA%BF%E7%8C%9C%E4%BD%A0%E5%96%9C%E6%AC%A2%E7%AE%97%E6%B3%95%23' },
          { rank: 11, title: '曾沛慈人气第一', url: 'https://s.weibo.com/weibo?q=%23%E6%9B%BE%E6%B2%9B%E6%85%88%E4%BA%BA%E6%B0%94%E7%AC%AC%E4%B8%80%23' },
          { rank: 12, title: '严浩翔考核试卷', url: 'https://s.weibo.com/weibo?q=%23%E4%B8%A5%E6%B5%A9%E7%BF%94%E8%80%83%E6%A0%B8%E8%AF%95%E5%8D%B7%23' },
          { rank: 13, title: '怪不得公司一边招人一边裁员', url: 'https://s.weibo.com/weibo?q=%23%E6%80%AA%E4%B8%8D%E5%BE%97%E5%85%AC%E5%8F%B8%E4%B8%80%E8%BE%B9%E6%8B%9B%E4%BA%BA%E4%B8%80%E8%BE%B9%E8%A3%81%E5%91%98%23' },
          { rank: 14, title: '范世錡怎么了', url: 'https://s.weibo.com/weibo?q=%23%E8%8C%83%E4%B8%96%E9%8C%A1%E6%80%8E%E4%B9%88%E4%BA%86%23' },
          { rank: 15, title: '人民日报曾评单依纯李白改编争议', url: 'https://s.weibo.com/weibo?q=%23%E4%BA%BA%E6%B0%91%E6%97%A5%E6%8A%A5%E6%9B%BE%E8%AF%84%E5%8D%95%E4%BE%9D%E7%BA%AF%E6%9D%8E%E7%99%BD%E6%94%B9%E7%BC%96%E4%BA%89%E8%AE%AE%23' },
        ],
      },
      {
        source: 'TOUTIAO',
        label: '头条',
        items: [
          { rank: 1, title: '国足0-2不敌喀麦隆', url: 'https://www.toutiao.com/trending/7622942162724700196/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622942162724700196' },
          { rank: 2, title: '人民日报评张雪：奋斗是逆天改命密码', url: 'https://www.toutiao.com/trending/7622594721889897990/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622594721889897990' },
          { rank: 3, title: '春日经济供需两旺活力足', url: 'https://www.toutiao.com/article/7623035959105405490' },
          { rank: 4, title: '央视新闻专访张雪', url: 'https://www.toutiao.com/trending/7623348682162769454/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7623348682162769454' },
          { rank: 5, title: '《新闻联播》正在直播', url: 'https://webcast-open.douyin.com/open/media_live/330698468897' },
          { rank: 6, title: '名嘴：郑丽文访陆对民进党非常不利', url: 'https://www.toutiao.com/trending/7622284876758388266/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622284876758388266' },
          { rank: 7, title: '张雪凭语音秒判机车啥故障', url: 'https://www.toutiao.com/trending/7623332548361358891/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7623332548361358891' },
          { rank: 8, title: '外交部揭底自卫队官员为何强闯中使馆', url: 'https://www.toutiao.com/trending/7622819484025409065/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622819484025409065' },
          { rank: 9, title: '人类即将时隔半个世纪再赴月球', url: 'https://www.toutiao.com/trending/7622618084647370798/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622618084647370798' },
          { rank: 10, title: '郑丽文访问大陆的核心动因是什么', url: 'https://www.toutiao.com/trending/7622905970075271178/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622905970075271178' },
          { rank: 11, title: '“过敏是因为免疫力差”系误区', url: 'https://www.toutiao.com/trending/7622284876758289962/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622284876758289962' },
          { rank: 12, title: '伊朗称精准打击美军指挥中心', url: 'https://www.toutiao.com/trending/7623316496202092042/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7623316496202092042' },
          { rank: 13, title: '有存款还需要缴纳养老保险吗', url: 'https://www.toutiao.com/trending/7623015171456057380/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7623015171456057380' },
          { rank: 14, title: '张雪是如何成功的', url: 'https://www.toutiao.com/trending/7623317929970388489/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7623317929970388489' },
          { rank: 15, title: '张雪回应禁止新手买820RR摩托车', url: 'https://www.toutiao.com/trending/7622532934087950378/?category_name=topic_innerflow&event_type=hot_board&style_id=40132&topic_id=7622532934087950378' },
        ],
      },
    ],
  },
}

export async function getIdeaLabHotBoard() {
  return Promise.resolve(hotBoardSample)
}
