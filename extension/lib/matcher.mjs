export const normalize = value => String(value || '').toLowerCase().normalize('NFKC').replace(/[\s_\-:*：()（）/.]/g, '');
const rules = {
  'basic.name': ['姓名', '真实姓名', '中文姓名', '候选人姓名', 'fullname', 'realname', 'candidatename', 'name'],
  'basic.phone': ['手机号码', '手机号', '联系电话', '联系电话号码', '手机', 'mobile', 'mobilephone', 'phonenumber', 'phone', 'tel'],
  'basic.email': ['电子邮箱', '联系邮箱', '邮箱', 'email', 'emailaddress'],
  'basic.city': ['现居城市', '现居住地', '现居地', '居住城市', 'currentcity', 'cityofresidence'],
  'basic.gender': ['性别', 'gender', 'sex'],
  'basic.birthday': ['出生日期', '出生年月', '生日', 'dateofbirth', 'birthdate', 'birthday'],
  'basic.political': ['政治面貌', 'politicalstatus', 'politicalaffiliation'],
  'basic.hometown': ['籍贯', 'hometown'],
  'basic.position': ['求职意向', '意向职位', '意向岗位', '应聘职位', '应聘岗位', '期望职位', 'desiredposition', 'targetposition'],
  'basic.targetCity': ['期望城市', '意向城市', '期望工作地点', '意向工作城市', 'preferredcity'],
  'basic.website': ['个人网站', '个人主页', '作品集链接', 'portfolio', 'personalwebsite'],
  'basic.github': ['github', 'github地址', 'github链接'],
  'education.school': ['学校名称', '毕业院校', '毕业学校', '就读院校', '学校', '院校', 'university', 'school', 'schoolname', 'institution'],
  'education.college': ['学院', '所在学院', '学院名称', '院系', '院系名称', 'college', 'faculty', 'facultyname', 'academicdepartment'],
  'education.major': ['专业名称', '所学专业', '专业', 'major', 'fieldofstudy'],
  'education.degree': ['最高学历', '学历', 'degree', 'educationlevel'],
  'education.gpa': ['gpa', '平均绩点', '绩点', 'gradepointaverage'],
  'education.ranking': ['成绩排名', '专业排名', '年级排名', '班级排名', '学业排名', 'academicranking', 'classrank', 'classranking'],
  'education.advisor': ['导师', '导师姓名', '指导教师', '指导老师', 'advisor', 'advisorname', 'supervisor', 'supervisorname'],
  'education.start': ['入学时间', '入学日期', 'enrollmentdate', 'educationstart'],
  'education.end': ['毕业时间', '毕业日期', '预计毕业时间', 'graduationdate', 'educationend'],
  'education.description': ['教育经历描述', '校园经历', '教育经历', 'educationdescription'],
  'work.company': ['公司名称', '实习单位', '工作单位', '公司', 'companyname', 'company', 'employer'],
  'work.role': ['职位名称', '担任职位', '工作岗位', '实习岗位', 'jobtitle'],
  'work.department': ['所在部门', '部门', 'department'],
  'work.location': ['工作地点', 'worklocation'],
  'work.start': ['入职时间', '入职日期', '实习开始时间', 'workstart'],
  'work.end': ['离职时间', '离职日期', '实习结束时间', 'workend'],
  'work.description': ['工作内容', '工作描述', '实习内容', '实习描述', '工作职责', 'jobdescription', 'responsibilities'],
  'projects.name': ['项目名称', 'projectname'],
  'projects.role': ['项目职责', '项目角色', 'projectrole'],
  'projects.start': ['项目开始时间', 'projectstart'],
  'projects.end': ['项目结束时间', 'projectend'],
  'projects.url': ['项目链接', '项目地址', 'projecturl'],
  'projects.description': ['项目描述', '项目内容', '项目介绍', '项目经历', 'projectdescription'],
  'extras.summary': ['自我介绍', '自我评价', '个人简介', 'selfintroduction', 'aboutme', 'summary'],
  'extras.skills': ['专业技能', '技术技能', '技能特长', '技能', 'skills'],
  'extras.awards': ['荣誉奖项', '所获荣誉', '获奖情况', '奖项', 'awards', 'honors']
};
const autocomplete = { name:'basic.name', tel:'basic.phone', email:'basic.email', sex:'basic.gender', bday:'basic.birthday', url:'basic.website' };
const unsafe = /紧急|联系人|推荐人|证明人|父亲|母亲|配偶|监护|密码|验证码|搜索|emergency|referee|referenceperson|contactperson|password|captcha|verificationcode|search/;
export function matchField(descriptor, fields) {
  const combined = normalize([descriptor.label, descriptor.placeholder, descriptor.name, descriptor.id, descriptor.section].join(' '));
  if (unsafe.test(combined)) return { field: null, reason: '不自动匹配此类字段', blocked: true };
  const scores = new Map();
  const give = (key, score) => scores.set(key, Math.max(scores.get(key) || 0, score));
  const explicit = normalize(descriptor.label);
  const hints = [descriptor.placeholder, descriptor.name, descriptor.id].map(normalize).filter(Boolean);
  for (const [kind, aliases] of Object.entries(rules)) {
    for (const alias of aliases.map(normalize)) {
      if (explicit === alias) give(kind, 100);
      // Generic English identifiers such as "name" must match exactly.
      else if (explicit.includes(alias) && (/[\u3400-\u9fff]/.test(alias) || alias.length > 5)) give(kind, 90);
      for (const hint of hints) {
        if (hint === alias) give(kind, 80);
        else if (hint.includes(alias) && (/[\u3400-\u9fff]/.test(alias) || alias.length > 5)) give(kind, 65);
      }
    }
  }
  const context = normalize(descriptor.section);
  const section = /项目|project/.test(context) ? 'projects' : /教育|学历|education/.test(context) ? 'education' : /工作|实习|work|employment/.test(context) ? 'work' : '';
  if (section) {
    const generic = { start: /^(开始时间|开始日期|起始时间|startdate|from)$/, end: /^(结束时间|结束日期|截止时间|enddate|to)$/ };
    for (const [key, re] of Object.entries(generic)) if (re.test(explicit)) give(`${section}.${key}`, 95);
    if (/^(描述|description)$/.test(explicit)) give(`${section}.description`, 95);
  }
  const token = String(descriptor.autocomplete || '').split(/\s+/).at(-1);
  if (autocomplete[token]) give(autocomplete[token], 85);
  const ranked = [...scores].sort((a,b) => b[1]-a[1]);
  if (!ranked.length || ranked[0][1] < 65) return { field: null, reason: '请选择对应资料' };
  if (ranked[1] && ranked[0][1] === ranked[1][1]) return { field: null, reason: '含义不明确，请手动选择' };
  const [kind, score] = ranked[0];
  let candidates = fields.filter(f => f.kind === kind);
  if (kind === 'education.degree' && /最高学历/.test(explicit)) {
    const rank = value => ({ 博士: 6, 博士研究生: 6, 硕士: 5, 硕士研究生: 5, 研究生: 5, 本科: 4, 学士: 4, 大专: 3, 专科: 3, 高中: 2 })[value] || 0;
    candidates = candidates.sort((a,b) => rank(b.value) - rank(a.value));
    if (candidates.length && rank(candidates[0].value) > rank(candidates[1]?.value)) candidates = [candidates[0]];
  }
  if (candidates.length > 1) return { field: null, candidates, reason: '存在多条经历，请选择', score };
  if (!candidates.length) return { field: null, reason: '资料中尚未填写此项', kind };
  return { field: candidates[0], score, reason: score >= 85 ? '已识别' : '建议核对', auto: score >= 85 };
}
