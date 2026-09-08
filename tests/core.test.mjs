import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createRecord, flattenProfile, validateStore, mergeStores, completeness } from '../extension/lib/schema.mjs';
import { matchField } from '../extension/lib/matcher.mjs';
function fixture() {
  const store=createStore(),p=store.profiles[0];
  Object.assign(p.basic,{name:'测试同学',phone:'13800000000',email:'test@example.com',position:'前端开发',idNumber:'00000020000101000X'}); // Deliberately invalid region code for test data.
  p.extras.summary='测试个人介绍\n第二行内容';
  p.education=[{...createRecord('education'),school:'示例大学',degree:'硕士',major:'软件工程',start:'2025-09',end:'2027-06'}];
  p.work=[{...createRecord('work'),company:'示例科技',role:'前端实习生',start:'2026-04'}];
  p.projects=[{...createRecord('projects'),name:'测试项目',description:'项目说明'}];
  p.extras.skills='JavaScript / Vue';return store;
}
test('roundtrip backup preserves values and completeness',()=>{const store=fixture();const restored=validateStore(JSON.parse(JSON.stringify(store)));assert.deepEqual(restored.profiles[0].basic,store.profiles[0].basic);assert.equal(completeness(restored.profiles[0]),100);});
test('imports append copies and never overwrite an existing profile',()=>{const store=fixture();const merged=mergeStores(store,store);assert.equal(merged.profiles.length,2);assert.notEqual(merged.profiles[0].id,merged.profiles[1].id);assert.equal(merged.profiles[0],store.profiles[0]);});
test('reject corrupt, unsupported, huge and non-text imports',()=>{for(const data of [null,{}, {...fixture(),version:9}])assert.throws(()=>validateStore(data));const store=fixture();store.profiles[0].basic.name={value:'wrong'};assert.throws(()=>validateStore(store));store.profiles[0].basic.name='x'.repeat(20001);assert.throws(()=>validateStore(store));});
test('unknown properties and prototype-shaped keys are discarded',()=>{const store=fixture();store.profiles[0].basic.unknown='x';const p=validateStore(store).profiles[0];assert.equal(p.basic.unknown,undefined);assert.equal(Object.getPrototypeOf(p.basic),Object.prototype);});
test('identity number text and multiline introduction survive backup and import',()=>{
  const store=fixture(), restored=mergeStores(createStore(),JSON.parse(JSON.stringify(store))).profiles[1];
  assert.equal(restored.basic.idNumber,'00000020000101000X');
  assert.equal(restored.extras.summary,'测试个人介绍\n第二行内容');
  const fields=flattenProfile(restored);
  assert.equal(fields.find(field=>field.kind==='basic.idNumber').value,restored.basic.idNumber);
  assert.equal(fields.find(field=>field.kind==='extras.summary').label,'个人介绍');
});
test('old backups default missing identity number to blank and retain existing introduction',()=>{
  const old=fixture();delete old.profiles[0].basic.idNumber;
  const restored=validateStore(old).profiles[0];
  assert.equal(restored.basic.idNumber,'');
  assert.equal(restored.extras.summary,old.profiles[0].extras.summary);
  assert.equal(flattenProfile(restored).some(field=>field.kind==='basic.idNumber'),false);
});
for(const [descriptor,expected] of [
  [{label:'姓名'},'basic.name'],[{label:'手机号码'},'basic.phone'],[{label:'Email address'},'basic.email'],
  [{label:'项目名称'},'projects.name'],[{label:'公司名称'},'work.company'],[{label:'职位名称'},'work.role'],
  [{label:'求职意向'},'basic.position'],[{label:'学校名称'},'education.school'],
  [{label:'开始时间',section:'实习经历'},'work.start'],[{autocomplete:'section-person email'},'basic.email'],
  [{name:'full_name'},'basic.name'],[{label:'身份证号码'},'basic.idNumber'],[{name:'id_card_number'},'basic.idNumber'],
  [{label:'个人介绍'},'extras.summary'],[{label:'自我介绍'},'extras.summary'],[{name:'personalIntroduction'},'extras.summary']
])test(`matches ${JSON.stringify(descriptor)}`,()=>assert.equal(matchField(descriptor,flattenProfile(fixture().profiles[0])).field?.kind,expected));
for(const descriptor of [{label:'紧急联系人姓名'},{label:'姓名',section:'紧急联系人'},{label:'验证码'},{name:'emergency_phone'},{label:'推荐人邮箱'},{label:'父亲身份证号'},{label:'身份证号码',section:'紧急联系人'}])test(`does not propose private/third-party field ${JSON.stringify(descriptor)}`,()=>{assert.equal(matchField(descriptor,flattenProfile(fixture().profiles[0])).field,null);assert.equal(matchField(descriptor,[]).blocked,true);});
test('identity numbers do not match generic IDs, other documents, or document metadata',()=>{
  const fields=flattenProfile(fixture().profiles[0]);
  for(const descriptor of [{name:'id'},{label:'护照号码'},{label:'证件号码'},{label:'身份证有效期'},{label:'身份证类型'},{name:'idCardType'}]) assert.equal(matchField(descriptor,fields).field,null);
});
test('does not match generic identifiers by partial name',()=>{assert.equal(matchField({name:'username'},flattenProfile(fixture().profiles[0])).field,null);assert.equal(matchField({label:'开始时间'},flattenProfile(fixture().profiles[0])).field,null);});
test('multiple education entries require manual selection, except known highest degree',()=>{const p=fixture().profiles[0];p.education.push({...createRecord('education'),school:'本科大学',degree:'本科'});const fields=flattenProfile(p);assert.equal(matchField({label:'学校名称'},fields).field,null);assert.equal(matchField({label:'学校名称'},fields).candidates.length,2);assert.equal(matchField({label:'最高学历'},fields).field.value,'硕士');});
test('missing a more specific value cannot fall back to a misleading broad label',()=>{const p=fixture().profiles[0];p.projects=[];assert.equal(matchField({label:'项目名称'},flattenProfile(p)).field,null);});
test('weak metadata stays unchecked pending review',()=>{const result=matchField({name:'fullName'},flattenProfile(fixture().profiles[0]));assert.equal(result.field.kind,'basic.name');assert.equal(result.auto,false);});
