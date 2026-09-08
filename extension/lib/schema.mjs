export const VERSION = 1;
export const KEY = 'jianli-v1';
export const uid = () => crypto.randomUUID();
export const sections = [
  { id: 'basic', title: '个人信息', sub: '让每一次自我介绍，从这里开始。', icon: 'user' },
  { id: 'education', title: '教育经历', sub: '记录你的学习轨迹，优先填写最高学历。', icon: 'book' },
  { id: 'work', title: '实习与工作', sub: '把做过的事情，整理成清楚的经历。', icon: 'case' },
  { id: 'projects', title: '项目经历', sub: '留下能体现你能力的项目与贡献。', icon: 'code' },
  { id: 'extras', title: '常用长文本', sub: '技能、个人介绍与荣誉，随时取用。', icon: 'text' }
];
// [key, Chinese label, input type, placeholder]
export const definitions = {
  basic: [
    ['name', '姓名', 'text', '你的真实姓名'], ['phone', '手机号码', 'tel', '常用联系电话'],
    ['email', '电子邮箱', 'email', '用于接收招聘通知'], ['city', '现居城市', 'text', '如：南京'],
    ['gender', '性别', 'text', '选填'], ['birthday', '出生日期', 'date', ''],
    ['idNumber', '身份证号', 'text', '选填，请按证件填写（含末尾字母 X）'],
    ['political', '政治面貌', 'text', '选填'], ['hometown', '籍贯', 'text', '选填'],
    ['position', '求职意向', 'text', '如：前端开发工程师'], ['targetCity', '期望城市', 'text', '如：上海'],
    ['website', '个人网站', 'url', 'https://'], ['github', 'GitHub', 'url', 'https://github.com/…']
  ],
  education: [
    ['school', '学校名称', 'text', '学校全称'], ['college', '学院', 'text', '如：软件学院'],
    ['major', '专业名称', 'text', '所学专业'],
    ['degree', '学历', 'text', '如：硕士'], ['gpa', 'GPA', 'text', '如：3.8 / 4.0'],
    ['ranking', '成绩排名', 'text', '如：5 / 120 或前 10%'],
    ['start', '入学时间', 'month', ''], ['end', '毕业时间', 'month', ''],
    ['advisor', '导师', 'text', '导师姓名（选填）'],
    ['description', '教育经历描述', 'textarea', '课程、研究方向或校园经历']
  ],
  work: [
    ['company', '公司名称', 'text', '公司全称'], ['role', '职位名称', 'text', '你的正式岗位'],
    ['department', '所在部门', 'text', '部门或团队'], ['location', '工作地点', 'text', '城市'],
    ['start', '开始时间', 'month', ''], ['end', '结束时间', 'month', ''],
    ['description', '工作内容', 'textarea', '职责、行动和可验证的成果']
  ],
  projects: [
    ['name', '项目名称', 'text', '项目的名字'], ['role', '项目职责', 'text', '你的角色'],
    ['start', '项目开始时间', 'month', ''], ['end', '项目结束时间', 'month', ''],
    ['url', '项目链接', 'url', 'https://'], ['description', '项目描述', 'textarea', '背景、技术方案与个人贡献']
  ],
  extras: [
    ['summary', '个人介绍', 'textarea', '用一段话介绍你的方向和优势，可用于自我介绍或自我评价'],
    ['skills', '专业技能', 'textarea', '按方向整理技术栈和熟练程度'],
    ['awards', '荣誉奖项', 'textarea', '奖学金、竞赛、资格证书等']
  ]
};
const record = section => Object.fromEntries(definitions[section].map(([key]) => [key, '']));
export function createProfile(name = '我的第一份简历') {
  return { id: uid(), title: name, updatedAt: new Date().toISOString(), basic: record('basic'),
    education: [], work: [], projects: [], extras: record('extras') };
}
export function createRecord(section) { return { id: uid(), ...record(section) }; }
export function createStore() {
  const profile = createProfile();
  return { version: VERSION, activeId: profile.id, profiles: [profile] };
}
function cleanRecord(value, section) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('资料字段格式不正确');
  return Object.fromEntries(definitions[section].map(([key]) => {
    const text = value[key] ?? '';
    if (typeof text !== 'string' || text.length > 20000) throw new Error('字段必须是文本，且不超过 20,000 字');
    return [key, text];
  }));
}
export function validateStore(data) {
  if (!data || data.version !== VERSION || !Array.isArray(data.profiles) || !data.profiles.length || data.profiles.length > 30)
    throw new Error('请导入简历匣导出的 JSON 文件（版本 1，1–30 份简历）');
  const ids = new Set();
  const profiles = data.profiles.map(p => {
    if (!p || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 80) throw new Error('简历名称不能为空，且不超过 80 字');
    const id = typeof p.id === 'string' && p.id.length <= 80 && !ids.has(p.id) ? p.id : uid();
    ids.add(id);
    const result = { id, title: p.title.trim(), updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt.slice(0, 40) : '', basic: cleanRecord(p.basic, 'basic'), extras: cleanRecord(p.extras, 'extras') };
    for (const section of ['education', 'work', 'projects']) {
      if (!Array.isArray(p[section]) || p[section].length > 30) throw new Error('每类经历最多支持 30 条');
      result[section] = p[section].map(row => ({ id: uid(), ...cleanRecord(row, section) }));
    }
    return result;
  });
  return { version: VERSION, activeId: profiles.some(p => p.id === data.activeId) ? data.activeId : profiles[0].id, profiles };
}
export function mergeStores(current, incoming) {
  const clean = validateStore(incoming);
  if (current.profiles.length + clean.profiles.length > 30) throw new Error('最多保存 30 份简历，请先整理已有版本');
  const added = clean.profiles.map(p => ({ ...p, id: uid() }));
  return { ...current, profiles: [...current.profiles, ...added], activeId: added[0].id };
}
export function flattenProfile(profile) {
  const fields = [];
  for (const section of sections) {
    const rows = Array.isArray(profile[section.id]) ? profile[section.id] : [profile[section.id]];
    rows.forEach((row, index) => {
      for (const [key, label] of definitions[section.id]) {
        const value = row[key]?.trim();
        if (value) fields.push({ key: `${section.id}.${index}.${key}`, kind: `${section.id}.${key}`, section: section.id, index, label, display: `${section.title}${rows.length > 1 ? ` ${index + 1}` : ''} · ${label}`, value });
      }
    });
  }
  return fields;
}
export function completeness(profile) {
  const keys = ['name', 'phone', 'email', 'position'];
  const count = keys.filter(key => profile.basic[key]?.trim()).length + Number(profile.education.some(e => e.school && e.degree)) + Number(Boolean(profile.extras.skills?.trim()));
  return Math.round(count / 6 * 100);
}
