(function () {
  'use strict';
  var form = document.getElementById('pediatricForm');
  var isEnglish = document.documentElement.lang === 'en';
  var storageKey = 'pediatricEmergencyForm';
  var rangeLabels = isEnglish ? {
    energy:['Normal','Slightly less active','About half as active','Mostly lying down','Hardly moves'],
    intake:['Normal','Slightly less','About half','Very little','Almost none'],
    pain:['0 / No pain','2 / Mild','4 / Moderate','6 / Severe','8 / Very severe','10 / Worst pain']
  } : {
    energy:['いつも通り','少し元気がない','半分くらい','ほとんど横になっている','ほとんど動かない'],
    intake:['いつも通り','少し少ない','半分くらい','ごく少量','ほとんど取らない'],
    pain:['0 / 痛くない','2 / 少し痛い','4 / 痛い','6 / とても痛い','8 / かなり強い','10 / 最大の痛み']
  };
  document.getElementById('birthDate').max = new Date().toISOString().slice(0, 10);

  function calculateAge(dateText) {
    if (!dateText) return null;
    var parts = dateText.split('-').map(Number), birth = new Date(parts[0], parts[1]-1, parts[2]), today = new Date();
    if (birth.getFullYear() !== parts[0] || birth.getMonth() !== parts[1]-1 || birth.getDate() !== parts[2] || birth > today) return null;
    var years = today.getFullYear()-birth.getFullYear();
    if (today.getMonth()<birth.getMonth() || (today.getMonth()===birth.getMonth() && today.getDate()<birth.getDate())) years--;
    var months=(today.getFullYear()-birth.getFullYear())*12+today.getMonth()-birth.getMonth();
    if(today.getDate()<birth.getDate()) months--;
    return {years:years,months:months};
  }

  function setSection(id, show) {
    var section=document.getElementById(id); section.hidden=!show;
    section.querySelectorAll('[data-required-when-visible]').forEach(function(el){el.required=show;});
    section.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=!show;});
  }

  function updateAgeSections() {
    var age=calculateAge(document.getElementById('birthDate').value), badge=document.getElementById('ageBadge');
    if(!age){badge.hidden=true;setSection('guardianSection',false);setSection('developmentSection',false);setSection('vaccinationSection',false);setSection('pediatricSymptomsSection',false);return;}
    badge.hidden=false;
    badge.textContent=isEnglish ? (age.years<2?'Current age: '+age.years+' year(s) '+(age.months-age.years*12)+' month(s)':'Current age: '+age.years+' years') : (age.years<2 ? '現在の年齢：'+age.years+'歳 '+(age.months-age.years*12)+'か月' : '現在の年齢：'+age.years+'歳');
    setSection('guardianSection',age.years<15); setSection('developmentSection',age.months<24); setSection('vaccinationSection',age.years<6); setSection('pediatricSymptomsSection',age.years<15);
  }

  function radioValue(name){var el=form.querySelector('input[name="'+name+'"]:checked');return el?el.value:'';}
  function updateComplaint(){var fever=radioValue('complaint')==='熱・体調不良';document.getElementById('feverHint').hidden=!fever;['energyQuestion','seizureQuestion','rashQuestion'].forEach(function(id){document.getElementById(id).classList.toggle('is-priority',fever);});}
  function updateConditional(name){var show=radioValue(name)==='有';var box=form.querySelector('[data-show-for="'+name+'"]');if(box)box.hidden=!show;}
  function updateRanges(){Object.keys(rangeLabels).forEach(function(id){var input=document.getElementById(id);document.getElementById(id+'Output').textContent=rangeLabels[id][Number(input.value)];});}

  function snapshot(){var data={};new FormData(form).forEach(function(v,k){if(data[k])data[k]=[].concat(data[k],v);else data[k]=v;});form.querySelectorAll('input[type=range]').forEach(function(el){data[el.name]=el.value;});return data;}
  function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(snapshot()));}catch(e){/* private mode may reject storage */}}
  function restore(){var data;try{data=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch(e){data=null;}if(!data)return;Object.keys(data).forEach(function(name){var values=[].concat(data[name]);form.querySelectorAll('[name="'+CSS.escape(name)+'"]').forEach(function(el){if(el.type==='radio'||el.type==='checkbox')el.checked=values.indexOf(el.value)!==-1;else el.value=values[0];});});}
  function val(id){var el=document.getElementById(id);return el&&!el.disabled?el.value:'';}
  function yesDetail(name,id){var answer=radioValue(name);return answer+(answer==='有'&&val(id)?'（'+val(id)+'）':'');}
  function buildText(){
    var age=calculateAge(val('birthDate')), ageText=age?(age.years<2?age.years+'歳'+(age.months-age.years*12)+'か月':age.years+'歳'):'';
    var entries=[['','【小児救急問診】'],['氏名',val('patientName')],['フリガナ',val('patientKana')],['生年月日',val('birthDate')+(ageText?' '+ageText:'')],['性別',val('sex')],['診察券',val('patientId')],['体重',val('weight')?val('weight')+'kg':''],['保護者',val('guardianName')],['続柄',radioValue('relationship')],['連絡先',val('guardianPhone')],['緊急連絡先',val('emergencyContact')],['主訴',radioValue('complaint')],['発症',val('onset')],['体温',val('temperature')?val('temperature')+'℃':''],['経過',val('symptoms')]];
    if(!document.getElementById('developmentSection').hidden){entries.push(['妊娠週数',val('gestationalWeeks')?val('gestationalWeeks')+'週 '+radioValue('gestationalTerm'):''],['出生体重',val('birthWeight')?val('birthWeight')+radioValue('birthWeightUnit'):''],['先天異常',yesDetail('congenital','congenitalDetail')],['発達の心配',yesDetail('developmentConcern','developmentDetail')]);}
    if(!document.getElementById('vaccinationSection').hidden){entries.push(['予防接種',radioValue('vaccinationStatus')],['直近接種',[val('lastVaccinationDate'),val('lastVaccine')].filter(Boolean).join(' ')]);}
    if(!document.getElementById('pediatricSymptomsSection').hidden){entries.push(['元気さ',rangeLabels.energy[Number(val('energy'))]],['飲食',rangeLabels.intake[Number(val('intake'))]],['排泄',val('elimination')],['けいれん',yesDetail('seizure','seizureDuration')+(radioValue('seizure')==='有'?' 初回'+val('seizureFirstAge')+'歳 頻度'+val('seizureFrequency'):'')],['熱性けいれん',radioValue('febrileSeizure')+(val('febrileSeizureCount')?' '+val('febrileSeizureCount')+'回':'')],['発疹',yesDetail('rash','rashDetail')]);}
    entries.push(['痛み',rangeLabels.pain[Number(val('pain'))]],['薬',val('medications')],['アレルギー',val('allergies')],['その他',val('notes')]);return window.PediatricQR.buildPipeText(entries);
  }

  form.addEventListener('input',function(){updateAgeSections();updateComplaint();updateRanges();save();});
  form.addEventListener('change',function(e){['seizure','febrileSeizure','rash'].forEach(updateConditional);updateAgeSections();updateComplaint();updateRanges();save();});
  form.addEventListener('submit',function(e){e.preventDefault();var error=document.getElementById('formError');if(!form.reportValidity()){error.textContent=isEnglish?'Please complete all required fields.':'必須項目を確認してください。';error.hidden=false;return;}try{var text=buildText();window.PediatricQR.render(document.getElementById('qrcode'),text);document.getElementById('qrText').textContent=text;document.getElementById('qrResult').hidden=false;error.hidden=true;save();document.getElementById('qrResult').scrollIntoView({behavior:'smooth',block:'start'});}catch(err){error.textContent=err.message;error.hidden=false;}});
  document.getElementById('resetButton').addEventListener('click',function(){if(!window.confirm(isEnglish?'Clear all answers?':'入力内容をすべて消します。よろしいですか？'))return;sessionStorage.clear();form.reset();document.getElementById('qrResult').hidden=true;document.getElementById('qrcode').replaceChildren();document.getElementById('formError').hidden=true;updateAgeSections();updateComplaint();updateRanges();['seizure','febrileSeizure','rash'].forEach(updateConditional);window.scrollTo({top:0,behavior:'smooth'});});
  restore();updateAgeSections();updateComplaint();updateRanges();['seizure','febrileSeizure','rash'].forEach(updateConditional);
})();
