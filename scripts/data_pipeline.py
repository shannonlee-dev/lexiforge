#!/usr/bin/env python3
"""Deterministic, resumable vocabulary compiler. No model/API required."""
import csv, hashlib, json, re, sys, unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DOMAINS={'contract':'계약·법무','finance':'회계·재무','banking':'은행·결제','hr':'인사·채용','office':'공지·행정','logistics':'물류·배송','procurement':'구매·조달','production':'생산·품질','sales':'영업·마케팅','service':'고객 서비스','travel':'출장·교통','hotel':'호텔·관광','facility':'시설·부동산','it':'IT·소프트웨어','education':'교육·행사','health':'의료·복리후생','news':'기업·기사','general':'일반 독해'}
URLS={'ngsl':'https://www.newgeneralservicelist.com/s/NGSL_12_alphabetized_description.txt','tsl':'https://www.newgeneralservicelist.com/s/TSL_12_alphabetized_description.txt','bsl':'https://www.newgeneralservicelist.com/s/BSL_120_alphabetized_description.txt'}
def normalize(s):return ' '.join(unicodedata.normalize('NFKC',s).lower().split())
def parse_source(name):
 text=(ROOT/'data/raw'/f'{name}.txt').read_text(encoding='utf-8-sig')
 if name=='ngsl': lines=text.split('\na\n',1)[1].splitlines();lines=['a']+lines
 elif name=='tsl':lines=[m.group(1) for m in re.finditer(r'^\d+\.\s+(.+)$',text,re.M)]
 else:lines=text.split('\nabolish\n',1)[1].splitlines();lines=['abolish']+lines
 return [normalize(x) for x in lines if x.strip()]
def validate_rows(rows):
 ids=set(); meaning_keys=set()
 for n,r in enumerate(rows,1):
  if len(r)!=9 or not all(x.strip() for x in r):raise ValueError(f'Row {n}: 9 nonempty fields required')
  lemma,sid,pos,meaning,domain,difficulty,expr,en,ko=r
  key=normalize(lemma)+'-'+sid
  if key in ids or (normalize(lemma),normalize(meaning)) in meaning_keys:raise ValueError(f'Duplicate sense: {key}')
  ids.add(key);meaning_keys.add((normalize(lemma),normalize(meaning)))
  if pos not in ['n','v','adj','adv','prep','phrase'] or domain not in DOMAINS or difficulty not in ['1','2','3','4','5']:raise ValueError(f'Invalid metadata {key}')
  if not re.search('[가-힣]',ko) or not re.search('[A-Za-z]',en):raise ValueError(f'Translation/example missing {key}')
  if len(en.split())<4:raise ValueError(f'Example too short: {key}')
 return True

def build(write=True):
 sources={k:parse_source(k) for k in URLS};candidates={}
 for source,words in sources.items():
  for word in words:
   c=candidates.setdefault(word,{'id':word.replace(' ','-'),'lemma':word,'sources':[],'status':'candidate'})
   if source not in c['sources']:c['sources'].append(source)
 rows=[];batches=[]
 for file in sorted((ROOT/'data/batches').glob('*.tsv')):
  batch=list(csv.reader(file.open(),delimiter='\t'));validate_rows(batch);rows+=batch;batches.append({'file':file.name,'rows':len(batch),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
 validate_rows(rows)
 extra_file=ROOT/'data/enrichment.json';extra=json.loads(extra_file.read_text()) if extra_file.exists() else {}
 valid_ids={normalize(r[0]).replace(' ','-')+'-'+r[1] for r in rows}
 if set(extra)-valid_ids:raise ValueError('Enrichment refers to missing senses: '+str(set(extra)-valid_ids))
 for key,ext in extra.items():
  for example in ext.get('examples',[]):
   if not example.get('en') or not re.search('[가-힣]',example.get('ko','')):raise ValueError('Invalid enrichment example: '+key)
 senses=[];expressions={}
 for lemma,sid,pos,meaning,domain,difficulty,expr,en,ko in rows:
  lemma=normalize(lemma);wid=lemma.replace(' ','-');senseid=wid+'-'+sid;ext=extra.get(senseid,{})
  c=candidates.setdefault(lemma,{'id':wid,'lemma':lemma,'sources':['original'],'status':'candidate'});c['status']='learning'
  phrases=[normalize(x) for x in expr.split(';')]
  if pos=='phrase' and lemma not in phrases: phrases.insert(0,lemma)
  for phrase in phrases:
   p=expressions.setdefault(phrase,{'id':'expr-'+hashlib.sha1(phrase.encode()).hexdigest()[:12],'text':phrase,'senseIds':[],'reviewStatus':'needs-review','source':'original'})
   if senseid not in p['senseIds']:p['senseIds'].append(senseid)
  examples=[{'id':senseid+'-1','en':en,'ko':ko}]+[{'id':senseid+'-'+str(i+2),**e} for i,e in enumerate(ext.get('examples',[]))]
  senses.append({'id':senseid,'wordId':wid,'lemma':lemma,'pos':pos,'meaning':meaning,'aliases':ext.get('aliases',meaning.split('/')),'domain':domain,'difficulty':int(difficulty),'priority':ext.get('priority',4 if int(difficulty)>=3 else 3),'examples':examples,'expressions':phrases,'prepositions':ext.get('prepositions',[]),'confusion':ext.get('confusion',[]),'family':ext.get('family',[]),'misconception':ext.get('misconception','문장 속 목적어와 주변 표현을 함께 확인하세요.'),'reviewStatus':'needs-review','source':'original','cefr':None})
 if len({s['id'] for s in senses})!=len(senses):raise ValueError('Normalized sense ID collision')
 if len({c['id'] for c in candidates.values()})!=len(candidates):raise ValueError('Normalized candidate ID collision')
 counts={'candidates':len(candidates),'learningWords':len(set(s['wordId'] for s in senses if s['pos']!='phrase')),'learningExpressions':len(set(s['wordId'] for s in senses if s['pos']=='phrase')),'senses':len(senses),'expressions':len(expressions),'examples':sum(len(s['examples']) for s in senses),'humanReviewed':0,'sourceRows':sum(map(len,sources.values())),'duplicatesMerged':sum(map(len,sources.values()))-len(set(sum(sources.values(),[]))),'domains':{d:sum(s['domain']==d for s in senses) for d in DOMAINS}}
 report={'counts':counts,'sources':[{'id':k,'url':v,'authors':'Browne, Culligan; NGSL also Phillips','license':'CC-BY-SA-4.0','retrieved':'2026-10-25','rows':len(sources[k]),'sha256':hashlib.sha256((ROOT/'data/raw'/f'{k}.txt').read_bytes()).hexdigest()} for k,v in URLS.items()],'checks':{'schema':'passed','duplicateSenses':0,'duplicateHeadwords':'merged','linguisticReview':'pending human review'},'batches':batches,'remaining':{'candidateWordsWithoutSenses':sum(c['status']=='candidate' for c in candidates.values()),'expressionTarget':[1500,3000],'wordTarget':[4000,6000]}}
 if write:
  for name,obj in [('vocabulary',senses),('candidates',list(candidates.values())),('expressions',list(expressions.values())),('data-report',report)]:
   p=ROOT/'public'/f'{name}.json';tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2));tmp.replace(p)
  (ROOT/'data/checkpoint.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 return report,candidates
if __name__=='__main__':
 command=sys.argv[1] if len(sys.argv)>1 else 'build'
 report,candidates=build(command=='build')
 if command=='next':
  todo=[c for c in candidates.values() if c['status']=='candidate'];todo.sort(key=lambda c:('tsl' not in c['sources'],'bsl' not in c['sources'],c['lemma']))
  print(json.dumps({'batchSize':25,'instructions':'Add a new numbered TSV, then run build. Never label generated content reviewed.','candidates':todo[:25]},ensure_ascii=False,indent=2))
 else:print(json.dumps(report['counts'],ensure_ascii=False,indent=2))
