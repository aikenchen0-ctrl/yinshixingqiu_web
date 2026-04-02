import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const joinedGroups = [
  { name: 'Datawhale', badge: '2' },
  { name: '易文AI编程·出海赚钱线', badge: '5' },
  { name: '祥哥陪你终身成长', badge: '99+' },
  { name: '五竹的成长笔记', badge: '88' },
]

const recommendedGroups = [
  { name: '新物种', meta: '2  1' },
  { name: '卖力榜', meta: '2  1' },
  { name: '活跃榜', meta: '2  1' },
]

const feedTabs = ['最新', '等我回答', '精华', '只看星主', '问答', '打卡', '作业', '文件', '图片']

const ideas = ['珠宝 梗子', '国足负于10人喀麦隆', '4月一批新规施行']

const feedCardPool = [
  {
    id: 'feed_1',
    author: '(*´▽`*)o',
    time: '2026-03-31 11:23  阅读人数 1',
    title: '欢迎加入「ysc的星球」，非常高兴能与大家在这里相遇。',
    body: [
      '建议大家使用「知识星球 App」进行交流，这能及时收到我的消息，更好地与我互动，获得更多成长与启发。',
      '点击下方链接进行下载安装，期待在 App 里与大家更深入地交流。',
      '◎ 知识星球 - 连接一千位铁杆粉丝，知识变现，小团队共享',
    ],
    tabs: ['最新', '精华', '只看星主'],
  },
  {
    id: 'feed_2',
    author: '庄东方',
    time: '2026-04-01 00:31',
    title: '2026年目标，公众号粉丝丝1.5W+，英语口语可以向业务员流利使用。',
    body: ['把职业技能和内容更新节奏一起拆解，每周复盘一次。'],
    tabs: ['最新', '等我回答', '问答'],
  },
  {
    id: 'feed_3',
    author: '程序员996号',
    time: '2026-03-18 15:47',
    title: '26年目标 ai智能体开发或ai产品经理',
    body: ['这条更像打卡内容，后续我会继续用实战记录补充细节。'],
    tabs: ['最新', '打卡', '作业'],
  },
  {
    id: 'feed_4',
    author: '云梦&&玄龙',
    time: '2026-01-05 09:02',
    title: '分享一个关于AI 智能体的综述',
    body: ['附带 PDF 文件，方便回看和做二次整理。'],
    tabs: ['最新', '文件'],
  },
]

function UserTopbar() {
  return (
    <header className="zsxq-topbar">
      <div className="zsxq-topbar-brand">
        <div className="zsxq-topbar-logo">○</div>
        <div className="zsxq-topbar-name">知识星球</div>
        <div className="zsxq-topbar-tag">笔记 0</div>
      </div>

      <div className="zsxq-topbar-search">
        <input readOnly value="可搜索当前星球的文件、主题" />
        <span>⌕</span>
      </div>

      <div className="zsxq-topbar-actions">
        <a className="zsxq-topbar-link" href="/group_data">
          星球管理后台
        </a>
        <button className="zsxq-topbar-upgrade">快抢单</button>
        <div className="zsxq-topbar-icon">◔</div>
        <div className="zsxq-topbar-icon">◔</div>
        <div className="zsxq-topbar-avatar" />
      </div>
    </header>
  )
}

function LeftSidebar() {
  return (
    <aside className="group-home-left">
      <div className="group-home-section-label">
        <span>所有星球 · 最新动态</span>
        <span className="group-home-badge">11</span>
      </div>

      <div className="group-home-block">
        <div className="group-home-dropdown">创建/管理的星球 ▾</div>
        <a className="group-home-current" href="/group/28882128518851">
          ysc的星球
        </a>
      </div>

      <div className="group-home-block">
        <div className="group-home-dropdown">加入的星球 ▾</div>
        {joinedGroups.map((group) => (
          <div className="group-home-link-row" key={group.name}>
            <span>{group.name}</span>
            <span className="group-home-badge is-orange">{group.badge}</span>
          </div>
        ))}
      </div>

      <div className="group-home-block">
        <div className="group-home-more">更多优质星球:</div>
        {recommendedGroups.map((group) => (
          <div className="group-home-link-row is-compact" key={group.name}>
            <span>{group.name}</span>
            <span className="group-home-mini-avatars">
              <span />
              <span />
              <span />
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ComposerCard({ onCompose }: { onCompose: () => void }) {
  return (
    <section className="group-card group-composer-card" onClick={onCompose} role="button" tabIndex={0}>
      <div className="group-composer-head">
        <div className="group-avatar small" />
        <div className="group-composer-input">点击发表主题...</div>
      </div>
      <div className="group-composer-tools">
        <span>☺</span>
        <span>▣</span>
        <span>◫</span>
        <span>B</span>
        <span>#</span>
        <span>⊙</span>
        <span>布置作业</span>
        <span>∡ 写文章</span>
      </div>
    </section>
  )
}

function FeedCard({
  author,
  time,
  title,
  body,
}: {
  author: string
  time: string
  title: string
  body: string[]
}) {
  return (
    <article className="group-card group-feed-card">
      <div className="group-feed-header">
        <div className="group-avatar" />
        <div className="group-feed-meta">
          <div className="group-feed-author">{author}</div>
          <div className="group-feed-time">{time}</div>
        </div>
        <div className="group-feed-more">···</div>
      </div>

      <div className="group-feed-title">{title}</div>

      <div className="group-feed-body">
        {body.map((paragraph) => (
          <p className={paragraph.startsWith('◎') ? 'group-feed-link' : ''} key={paragraph}>
            {paragraph}
          </p>
        ))}
      </div>

      <div className="group-feed-actions">
        <span>♡</span>
        <span>▢</span>
        <span>☆</span>
        <span>↗</span>
        <a href="/">查看详情 ›</a>
      </div>
    </article>
  )
}

function RightSidebar({
  onQuestion,
  questionSent,
  onOpenAdmin,
}: {
  onQuestion: () => void
  questionSent: boolean
  onOpenAdmin: () => void
}) {
  return (
    <aside className="group-home-right">
      <section className="group-side-card group-side-cover">
        <div className="group-side-cover-art">
          <div className="group-side-cover-mark" />
        </div>
        <div className="group-side-cover-avatar" />
        <div className="group-side-cover-name">(*´▽`*)o</div>
        <div className="group-side-cover-days">创建1天</div>
        <div className="group-side-cover-title">ysc的星球</div>
      </section>

      <section className="group-side-card group-side-tip">
        <div className="group-side-tip-icon">✦</div>
        <div>
          为避免无法改成，请尽快开通收款账户，点击查看开通方式
        </div>
      </section>

      <section className="group-side-card group-side-link-card" onClick={onOpenAdmin} role="button" tabIndex={0}>
        <div>
          <div className="group-side-link-title">
            星球管理后台 <span>New</span>
          </div>
          <div className="group-side-link-subtitle">「成长型小星球」接口已开放</div>
        </div>
        <div className="group-side-arrow">›</div>
      </section>

      <section className="group-side-card">
        <div className="group-side-heading">向他们提问</div>
        <div className="group-side-subheading">星主已合伙人 1 位，嘉宾 0 位</div>
        <div className="group-side-member">
          <div className="group-avatar" />
          <div className="group-side-member-name">(*´▽`*)o</div>
          <button className={questionSent ? 'is-success' : ''} onClick={onQuestion}>
            {questionSent ? '已问' : '问'}
          </button>
        </div>
      </section>

      <section className="group-side-card">
        <div className="group-side-heading">创作灵感</div>
        <div className="group-side-subheading">发现热点，挖掘合适的创作素材</div>
        <div className="group-side-ideas">
          {ideas.map((idea, index) => (
            <div className="group-side-idea" key={idea}>
              <span>{index + 1}</span>
              <div>{idea}</div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function SurveyCard({
  onClose,
  selectedScore,
  onSelectScore,
}: {
  onClose: () => void
  selectedScore: number | null
  onSelectScore: (score: number) => void
}) {
  return (
    <section className="group-survey-card">
      <button className="group-survey-close" onClick={onClose}>
        ×
      </button>
      <div className="group-survey-title">你愿不愿意向朋友推荐知识星球网页版?</div>
      <div className="group-survey-labels">
        <span>不推荐</span>
        <span>十分推荐</span>
      </div>
      <div className="group-survey-scale">
        {Array.from({ length: 10 }, (_, index) => (
          <button
            className={selectedScore === index + 1 ? 'is-active' : ''}
            key={index}
            onClick={() => onSelectScore(index + 1)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </section>
  )
}

export function GroupHomePage() {
  const navigate = useNavigate()
  const { groupId } = useParams()
  const displayGroupId = groupId ?? '28882128518851'
  const [activeTab, setActiveTab] = useState('最新')
  const [questionSent, setQuestionSent] = useState(false)
  const [surveyVisible, setSurveyVisible] = useState(true)
  const [selectedScore, setSelectedScore] = useState<number | null>(null)

  const filteredFeeds = useMemo(
    () => feedCardPool.filter((item) => item.tabs.includes(activeTab)),
    [activeTab],
  )

  return (
    <div className="zsxq-page-shell">
      <UserTopbar />

      <main className="group-home-page">
        <LeftSidebar />

        <section className="group-home-center">
          <ComposerCard onCompose={() => navigate('/promotion/data')} />

          <div className="group-feed-tabs">
            {feedTabs.map((tab) => (
              <button className={activeTab === tab ? 'is-active' : ''} key={tab} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {filteredFeeds.length ? (
            filteredFeeds.map((feed) => <FeedCard key={feed.id} {...feed} />)
          ) : (
            <div className="group-feed-empty">当前分类还没有内容，先切回「最新」看看。</div>
          )}

          <div className="group-feed-empty">没有更多了</div>
          <div className="group-home-group-id">groupId: {displayGroupId}</div>
        </section>

        <RightSidebar
          onQuestion={() => setQuestionSent(true)}
          questionSent={questionSent}
          onOpenAdmin={() => navigate('/promotion/data')}
        />
      </main>

      <div className="group-year-pill">最近<br />2026</div>
      {surveyVisible ? (
        <SurveyCard
          onClose={() => setSurveyVisible(false)}
          selectedScore={selectedScore}
          onSelectScore={setSelectedScore}
        />
      ) : null}
    </div>
  )
}
