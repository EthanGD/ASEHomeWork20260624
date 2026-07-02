import datetime
import os
import zipfile
from xml.sax.saxutils import escape


def p_xml(text: str, style: str | None) -> str:
    t = escape(text)
    if style and text:
        return (
            f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
        )
    return f'<w:p><w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'


def build_docx(paragraphs: list[tuple[str, str | None]]) -> bytes:
    body = "".join(p_xml(t, s) for t, s in paragraphs)
    sect = (
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
        'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<w:body>{body}{sect}</w:body></w:document>"
    )

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="44"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>"""

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    now = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
    xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
    xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>trae_skill_practice_report_20260629</dc:title>
  <dc:creator>Trae</dc:creator>
  <cp:lastModifiedBy>Trae</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
    xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Trae</Application>
</Properties>"""

    buf = bytearray()
    with zipfile.ZipFile(
        io := __import__("io").BytesIO(buf), "w", compression=zipfile.ZIP_DEFLATED
    ) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", styles)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app)
    return io.getvalue()


def main() -> None:
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "trae_skill_practice_report_20260629_v14.docx")
    paragraphs: list[tuple[str, str | None]] = []
    paragraphs.append(("软件工程 SKILL 驱动开发实践总结（Trae）", "Title"))
    paragraphs.append(("项目：语音转文字事务记录工作台（React+Ant Design / Express+TypeScript / PostgreSQL）", "Subtitle"))
    paragraphs.append(("依据材料：promtHistory20260629.md（项目对话过程记录）", None))
    paragraphs.append((f"生成日期：{datetime.date.today().isoformat()}", None))
    paragraphs.append(("", None))

    paragraphs.append(("一、开发过程及成果（约按时间线回顾）", "Heading1"))
    paragraphs.append(("1. 从需求到基线：先把“要做什么”说清楚", "Heading2"))
    paragraphs.append(("本项目的起点是“开发一个语音转文字的事务记录网页，支持用户管理”。在实际推进时，我把它拆成三个层次：核心业务（事务记录）、组织与权限（用户/角色/权限）、外部能力（语音转写与第三方登录）。", None))
    paragraphs.append(("开发策略上优先固化需求基线：在每次新增约束时（例如日历界面、微信扫码登录、PostgreSQL 持久化、Express+TypeScript 后端、React+Ant Design 前端），都先把口径写进基线，再动代码。这样做的好处是：一方面减少“写完才发现范围变了”的返工；另一方面也便于回溯每个功能为什么存在、验收标准是什么。", None))
    paragraphs.append(("在 GitHub 登录/绑定这块，也经历了典型的“业务含义澄清”：绑定与登录看起来都是“拿到 GitHub 用户信息”，但后半段完全不同。绑定是登记第三方账号与本系统用户的映射关系；登录是用第三方账号反查系统用户并签发会话 token。对齐这一点后，才有了后续 oauth_identities 的通用表设计。", None))
    paragraphs.append(("另外，一个在实践中反复出现的教训是：只要进入“联调 + 多环境”阶段，问题往往不在代码，而在运行态。比如接口 404 可能是旧进程还在跑；用户“新增后数据库看不到”可能是写进了另一个端口的 PostgreSQL 实例。若不先做证据采集，很容易误判并产生无效改动。", None))

    paragraphs.append(("2. 第一阶段：用可运行 MVP 验证交互与主流程", "Heading2"))
    paragraphs.append(("早期实现先以“能跑起来”为目标：把事务新增/编辑/删除、基础登录与会话、用户与角色管理等做成一个前端原型，快速验证信息架构与交互形态是否合理。此阶段强调反馈闭环：每次点击路径是否通、表单是否可用、数据是否能回显、错误是否可理解。", None))
    paragraphs.append(("在语音转文字方面，采取“后端代理对接外部 funASR 服务”的思路：前端只负责上传与展示；后端负责调用外部服务、处理结果并回填事务正文。这样能避免浏览器端引入大型模型依赖，也为未来接入鉴权、限流与审计留下空间。", None))
    paragraphs.append(("MVP 阶段的另一个关键点是“保留演示可用性”：微信登录、GitHub 登录等第三方能力在开发期经常拿不到真实凭据，因此采用 mock 与真实模式可切换的策略，优先保证主流程可演示、可验证，再在拿到真实参数后把链路切换到真实回调。这种做法对课程作业尤其有效：既能展示完整工程链路，又不会被外部平台的资质与审核流程卡住。", None))

    paragraphs.append(("3. 第二阶段：全面升级为全栈项目（React+Antd / Express+TS / PostgreSQL）", "Heading2"))
    paragraphs.append(("当需求明确要求 PostgreSQL 持久化与 Express+TypeScript 后端后，项目从“前端本地存储原型”进入“前后端分离但同仓库协作”的工程化阶段。此阶段最关键的成果是：核心业务数据（用户、角色、用户角色、事务、系统配置、第三方绑定信息）全部落到 PostgreSQL，并通过后端 API 统一读写。", None))
    paragraphs.append(("前端方面，用 Ant Design 统一了布局与组件体系，形成工作台式界面：侧边栏菜单（事务、日历、用户、角色、设置、账号管理等）+ 内容区视图切换。日历视图支持按月、按周、按三日、按日查看，并提供从日历快速创建/查看事务的路径，从“列表管理”扩展为“时间管理”。", None))
    paragraphs.append(("后端方面，采用 Express + TypeScript 并逐步完成分层：把应用装配、中间件、路由、业务服务、数据库访问与通用工具函数拆开，让 index.ts 回归“启动入口”。同时把易错配置（端口、前端回跳地址、数据库连接、第三方 OAuth 回调地址等）收敛到 .env，通过 config.ts 统一读取。", None))
    paragraphs.append(("为了降低“单文件过大、逻辑纠缠”的维护成本，后端把 auth/account/tasks/users/roles/settings/transcriptions 等拆成独立路由文件，把 users/roles/tasks/github/wechat/passkey 等拆成服务层。拆分的关键收益是边界更清晰：路由层关注 HTTP 与鉴权，服务层关注业务与数据库读写，配置层关注环境变量与默认值。", None))
    paragraphs.append(("数据库方面，形成“schema/seed/ops”脚本体系：schema 用于建表与约束；seed 用于初始化基础数据（角色、用户、权限等）；ops 用于记录常用插入与查询脚本，便于验证与排错。针对第三方绑定需求，引入 oauth_identities 作为通用身份映射表，满足未来扩展更多 OAuth2 提供方的演进方向。", None))

    paragraphs.append(("4. 第三阶段：联调与问题收敛（调试/测试/运维）", "Heading2"))
    paragraphs.append(("在联调阶段，出现过多类典型问题：端口冲突（本机已有服务占用）、多版本 PostgreSQL 并存导致连错库（5432/5433）、Vite 端口漂移（5174/5175）、CORS 与代理配置不一致、旧进程未停止导致“代码已改但运行态仍旧”引发 404/提示文案不一致等。", None))
    paragraphs.append(("这些问题的共同点是：并非业务逻辑写错，而是运行环境与预期不一致。解决思路也逐渐稳定为：先做可证伪验证（端口监听、健康检查、直连与代理对照、查看启动日志确认当前读取的 .env），再决定是否改代码。", None))
    paragraphs.append(("测试与文档作为收敛手段：后端使用 Node 内置 test runner 增加 API 自动化测试，覆盖健康检查、登录、CRUD、权限校验、第三方绑定/解绑等；同时输出 Excel 版 API 调用说明，减少前后端对接口细节的反复确认成本。", None))
    paragraphs.append(("此外，为了把“前端只调用一个入口”的诉求工程化，曾引入 apiGateWay 作为中间层：前端统一 POST /apiGateWay（携带 path/method/payload/header/query），网关转发到后端。它的价值在于集中处理鉴权头与错误透传，并为后续扩展限流、审计或多后端路由预留位置。实践中也暴露了一个常见坑：代理规则匹配顺序不当会导致 /apiGateWay 被误转发，需要在 proxy 配置中保证优先级。", None))

    paragraphs.append(("5. 当前主要成果清单（可验收的交付物）", "Heading2"))
    paragraphs.append(("（1）可运行的全栈应用：前端 React+Antd 工作台，后端 Express+TS API，数据库 PostgreSQL。", None))
    paragraphs.append(("（2）事务管理能力：事务 CRUD、搜索筛选、状态与优先级、最近事务、仪表盘统计等。", None))
    paragraphs.append(("（3）日历视图：按月/周/三日/日查看事务排期，并可从日历入口创建与查看。", None))
    paragraphs.append(("（4）用户与角色管理：用户增删改查、禁用/逻辑删除、角色自定义、权限配置与校验。", None))
    paragraphs.append(("（5）语音转文字入口：上传音频并调用 funASR，转写结果回填事务。", None))
    paragraphs.append(("（6）账号管理：提供微信与 GitHub 的绑定/解绑入口；第三方绑定信息通过 oauth_identities（或 users.wechat_open_id）记录在数据库。", None))
    paragraphs.append(("（7）工程化资产：数据库脚本目录、后端 API 自动化测试、API Excel 文档、一键初始化与启动脚本（按对话过程演进）。", None))
    paragraphs.append(("（8）配置治理：.env/.env.example 收敛关键变量，并在启动日志中输出关键目标信息（例如数据库端口），降低“连错库”“回跳端口错误”等隐性风险。", None))
    paragraphs.append(("（9）问题排查套路沉淀：对于“看起来像代码 bug”的问题，先验证运行态与配置（端口监听、进程是否旧版本、代理是否生效、数据库目标是否一致），再进入代码层定位；并把这些经验固化为脚本与文档，避免每次都从零开始排查。", None))
    paragraphs.append(("（10）可扩展架构雏形：通过 oauth_identities 统一第三方身份映射，通过 config.ts 统一运行配置，通过 routes/services 的拆分降低耦合度，为未来接入更多 OAuth2 平台、增加移动端/网关层或替换转写服务预留空间。", None))
    paragraphs.append(("（11）安全与一致性策略：第三方登录采用 OAuth2 Authorization Code Flow（而非误用 OIDC 概念），state 用于防 CSRF；绑定与登录共享“获取第三方账号 id”的前半段，后半段分别执行“写映射”和“查映射并签 token”。同时通过数据库唯一约束（provider + provider_user_id）确保一个第三方账号不会被绑定到多个系统用户，避免账户劫持与混乱。", None))

    paragraphs.append(("", None))
    paragraphs.append(("二、使用软件工程 SKILL 的体会（优缺点与反思）", "Heading1"))
    paragraphs.append(("本次作业要求在 Trae 中使用“别人已经准备好的 SKILL（13 个 SKILL 不要求全部用）”完成一个完整项目。这个过程更像是把团队协作中的角色与流程显性化：每个 SKILL 都对应一种工作视角与产出物，强迫开发过程从“写代码”扩展为“需求—设计—实现—验证—交付”的闭环。", None))
    paragraphs.append(("本仓库的 13 个 SKILL 位于 .trae/skills，分别是：需求管家、任务规划、技术方案、交互设计、前端开发、后端开发、数据库设计、测试用例、api文档、bug修复、部署运维、全栈协调、生成图表。", None))

    paragraphs.append(("1. 优点：让“过程可控、产出可追溯”", "Heading2"))
    paragraphs.append(("（1）目标清晰：需求管家将“我要什么”写清楚，避免开发过程中不断漂移导致做成了另一个系统。尤其是在新增日历、微信、GitHub、网关等需求时，先锁定口径再动代码能显著减少返工。", None))
    paragraphs.append(("（2）决策前置：技术方案阶段把关键分歧先讲明白，例如 OAuth2 与 OIDC 的概念纠偏、绑定与登录的分叉点、WebAuthn 对安全上下文的约束等。很多问题在设计阶段就能避免在联调时“推倒重来”。", None))
    paragraphs.append(("（3）分工语义一致：前端开发/后端开发/数据库设计/测试用例/api文档/部署运维等 SKILL 让讨论天然聚焦。比如“后端 404”到底是路由没实现、还是旧进程没停、还是代理配置错了，就能分别落在 bug修复 与 部署运维 的检查清单里。", None))
    paragraphs.append(("（4）验证闭环：测试用例与 api文档在项目里不是“最后才补的材料”，而是让联调可重复、可对照、可回归。尤其是接口增量迭代时，自动化测试能快速发现回归；Excel 文档能减少前端对接口细节的猜测。", None))

    paragraphs.append(("2. 缺点与成本：流程不是免费的", "Heading2"))
    paragraphs.append(("（1）上下文切换成本：角色化的好处是聚焦，但现实问题往往跨边界。例如 CORS/502/端口冲突是运维问题、同时会表现为前端报错；第三方回调失败既可能是后端逻辑，也可能是 .env 或第三方平台后台配置。过度割裂会导致来回切换。", None))
    paragraphs.append(("（2）环境依赖高：只要运行环境不一致，过程再规范也会失败。本次出现的典型例子是“旧进程仍在跑导致路由 404”“本机多个 PG 版本并存导致看库不一致”“Vite 端口漂移导致 CORS 失配”等。说明规范体系必须覆盖运行与部署层面的自检。", None))
    paragraphs.append(("（3）维护成本：文档、脚本、示例配置、测试、API Excel 都需要随着代码变化持续维护，否则会变成新的误导源。这个成本在项目规模扩大时会更明显，因此需要机制（质量闸门）来强制同步更新。", None))

    paragraphs.append(("3. 个人体会：最重要的是“证据驱动”与“配置收敛”", "Heading2"))
    paragraphs.append(("（1）证据驱动：遇到 404/500/CORS/502，优先用健康检查、端口监听、直连对照、查看实际响应体来证伪假设，而不是先改业务代码。这样能避免“改了一堆，其实只是没重启/连错端口”。", None))
    paragraphs.append(("（2）配置收敛：把端口、回跳地址、数据库连接、OAuth 回调等全部写到 .env，并在启动时打印关键值，相当于给系统加了一层“自解释能力”。很多联调问题其实是“系统不知道自己当前在连哪里”。", None))
    paragraphs.append(("（3）从可运行到可维护：前期能跑很重要，但当需求开始扩展（账号绑定、网关、指纹等），代码组织必须跟上。前端拆分 AppShell、后端拆分 index.ts 都是把“可运行”升级成“可持续迭代”的必要步骤。", None))
    paragraphs.append(("（4）用 SKILL 当“检查清单”而不是“格式要求”：例如数据库设计不只是画 ER 图，更关键是约束与迁移策略；测试用例不只是写几条接口测试，更关键是把验收标准固化成可回归的脚本。", None))
    paragraphs.append(("（5）把问题分类能提升效率：同样是登录失败，可能是前端未启动（连接拒绝）、代理规则未生效（5174/5175 混用）、CORS 失配（Origin 未放行）、后端旧进程仍在跑（路由 404）、数据库连错实例（写入与查询不一致）。明确分类后，每类问题都有固定的最快验证手段。", None))
    paragraphs.append(("（6）对外部依赖要“可替换”：微信与 GitHub 这类第三方服务在开发期往往缺少真实参数，采用 mock 与真实模式可切换能让开发不断档；同时通过统一的身份映射表 oauth_identities 为未来扩展更多 OAuth2 平台提供结构化支撑。", None))
    paragraphs.append(("（7）对“可维护性”要持续投资：前端的 AppShell 如果把所有视图、弹窗、表格列定义、提交逻辑都堆在一起，短期能交付但长期难演进。实践中通过拆分 view、modal、utils 与 api 封装，让代码结构更接近组件化与单一职责。后端同理，index.ts 的收缩与路由拆分，使得新功能（账号管理、第三方绑定、passkey 等）能在明确位置扩展，而不是在巨型文件里叠加条件分支。", None))

    paragraphs.append(("", None))
    paragraphs.append(("三、如果要规范软件开发过程并构建自己的体系：设想", "Heading1"))
    paragraphs.append(("结合本次实践，我设想的体系目标是：用尽可能少的强制规则，换取尽可能高的可重复交付能力。核心不是写一份大而全的流程，而是建立“最小闭环 + 质量闸门 + 可观测性”。", None))

    paragraphs.append(("1. 最小闭环：从需求到交付的最短路径", "Heading2"))
    paragraphs.append(("（1）需求阶段：必须有需求基线与验收标准。每个需求至少包含：用户故事、范围边界、验收用例、非功能约束（安全/性能/兼容性）。", None))
    paragraphs.append(("（2）设计阶段：必须有关键决策记录（ADR）。例如：为何使用 oauth_identities 作为第三方绑定的统一表；为何绑定与登录共享 callback 但分叉后半段；为何 WebAuthn 在局域网 IP 下需要 https；这些决策应可追溯。", None))
    paragraphs.append(("（3）实现阶段：按分层与契约协作。后端建议 route/controller/service/repository 分层，数据库 schema 与迁移脚本版本化；前端按 view/component/hook/utils 拆分，接口调用统一封装。", None))
    paragraphs.append(("（4）验证阶段：必须有可重复验证路径。接口至少有集成测试；核心 UI 至少有冒烟测试流程；关键风险点（登录、权限、数据一致性）必须可回归。", None))
    paragraphs.append(("（5）交付阶段：必须有一键启动与配置模板。包括：.env.example、初始化 SQL、启动脚本、健康检查、关键日志位置说明。", None))

    paragraphs.append(("2. 质量闸门：用机制对抗遗忘", "Heading2"))
    paragraphs.append(("（1）提交/合并闸门：build 与 test 必须通过；涉及配置变更必须同步更新 .env.example；涉及数据库变更必须同步更新 schema/migrations；涉及接口变更必须同步更新 API 文档或 OpenAPI。", None))
    paragraphs.append(("（2）发布闸门：必须能从空环境一键启动（含 DB 初始化/迁移），并通过健康检查与核心用例。", None))
    paragraphs.append(("（3）安全闸门：禁止把 client secret、数据库密码等敏感信息提交到仓库；对外服务必须有最小权限、输入校验与日志脱敏策略。", None))
    paragraphs.append(("（4）协作闸门：代码评审不仅看功能是否实现，还要检查“是否新增了回归风险”：是否引入了隐藏端口/硬编码回调地址、是否遗漏数据库迁移脚本、是否新增 API 却未更新文档与测试。把这些检查项固化为评审清单，能显著降低集成阶段的返工。", None))
    paragraphs.append(("（5）持续集成设想：加入 CI 流水线在每次提交自动执行 typecheck/build/test，并对 API 文档与数据库脚本版本做一致性检查，让规范更多依赖自动化约束。", None))

    paragraphs.append(("3. 可观测性：让系统“自己告诉你哪里不对”", "Heading2"))
    paragraphs.append(("（1）启动日志必须打印关键目标：例如数据库主机与端口、对外回调地址、当前运行模式（dev/prod/mock）。", None))
    paragraphs.append(("（2）统一错误模型：后端错误返回统一结构（code/message/details），前端把错误提示与可操作建议展示给用户。", None))
    paragraphs.append(("（3）联调工具链：保留健康检查、调试事件上报、API 文档与测试用例，形成“从现象到定位”的快速通道。", None))
    paragraphs.append(("（4）配置校验与启动失败要“早报错”：例如检测到同时存在 5432/5433 两套 PostgreSQL 时，启动时明确输出当前实际连接目标；检测到 CLIENT_URL 与前端实际端口不一致时，提示回跳可能失败；检测到 GitHub 缺少 client secret 时，直接在发起绑定/登录时返回可操作错误，而不是让用户跳转到 GitHub 之后才失败。", None))
    paragraphs.append(("（5）对网关/代理类组件要提供最小健康端点：例如 apiGateWay 提供 /health 返回目标后端地址；后端提供 /api/health 返回数据库连通性；前端通过环境变量控制是否走网关，避免联调时路径混乱。", None))
    paragraphs.append(("（6）对配置的“正确性”做约束：建议在启动阶段对关键环境变量做校验（如端口必须是数字、URL 必须可解析、PG 连接信息必须完整），并在检测到常见错误时给出明确提示。例如：当检测到本机同时存在 5432/5433 并且用户名密码只对其中一套生效时，打印“当前连接的是哪个端口、版本是多少”，避免出现“我明明看到了数据但接口查不到”的错觉。", None))

    paragraphs.append(("", None))
    paragraphs.append(("四、面向未来迭代的规划建议（在当前架构上可直接扩展）", "Heading1"))
    paragraphs.append(("为了让项目不仅“能交付”，还“能持续演进”，我把后续优化建议分为三类：安全与合规、工程效率、产品体验。三类建议都尽量基于当前代码结构可直接落地，而不是推翻重写。", None))
    paragraphs.append(("（1）安全与合规：完善 token 生命周期与刷新策略；对第三方回调与网关转发加强校验（限制可转发目标、防 SSRF）；对日志与错误信息做脱敏；对账号解绑做保护。", None))
    paragraphs.append(("（2）工程效率：把 API 文档升级为 OpenAPI 并从代码或路由定义生成；把数据库 schema 迁移纳入版本管理（migration 编号与回滚策略）；把 build/test 纳入 CI；对联调问题写成启动自检脚本。", None))
    paragraphs.append(("（3）产品体验：日历视图可补充拖拽排期与冲突提示；事务可支持附件；转写结果可提供关键字提取；账号管理提供更清晰的异常提示与重试入口。", None))

    paragraphs.append(("", None))
    paragraphs.append(("附：本次实践中对应使用到的 SKILL 典型场景举例", "Heading1"))
    paragraphs.append(("需求管家：新增日历/微信/GitHub/网关等需求时先固化验收口径与边界。", None))
    paragraphs.append(("任务规划：把“全栈重构、数据库持久化、账号绑定、测试与文档”拆成阶段性里程碑。", None))
    paragraphs.append(("技术方案：纠正 OAuth2 与 OIDC/SSO 的概念；明确“绑定 vs 登录”的同回调分叉策略。", None))
    paragraphs.append(("交互设计：工作台布局、日历多模式切换、账号管理绑定/解绑交互。", None))
    paragraphs.append(("前端开发：React+Antd 视图拆分、AppShell 体积治理、接口封装与代理/网关调用编排。", None))
    paragraphs.append(("后端开发：Express+TS 分层、路由拆分、会话鉴权、第三方回调处理。", None))
    paragraphs.append(("数据库设计：schema/seed/ops 脚本化、oauth_identities 通用绑定表、唯一约束与外键。", None))
    paragraphs.append(("测试用例：Node test runner 覆盖关键 API 路径并用于回归验证。", None))
    paragraphs.append(("api文档：Excel 形式的调用方法、鉴权说明与示例，降低联调沟通成本。", None))
    paragraphs.append(("bug修复：对 404/500/CORS/502 做证据驱动定位，优先排除旧进程/端口/代理问题。", None))
    paragraphs.append(("部署运维：处理端口占用、反向代理、Vite host/端口、环境变量生效与重启顺序。", None))
    paragraphs.append(("全栈协调：统一配置收敛，避免前后端与数据库实例不一致导致的“看不到数据”。", None))
    paragraphs.append(("生成图表：可扩展为仪表盘统计图、日历热力图或任务状态分布图（本次以说明为主）。", None))

    docx_bytes = build_docx(paragraphs)
    with open(out_path, "wb") as f:
        f.write(docx_bytes)
    print(out_path)


if __name__ == "__main__":
    main()
