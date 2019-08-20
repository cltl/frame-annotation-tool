import glob
import pickle
import json
from collections import defaultdict

bin_dir='../data'
doc_dir='../data/naf'
inc2doc_file='%s/inc2doc_index.json' % bin_dir
inc2str_file='%s/inc2str_index.json' % bin_dir

inc2doc={}
inc2str={}

for f in glob.glob('%s/*.bin' % bin_dir):
    with open(f, 'rb') as fl:
        inc_data=pickle.load(fl)
    for inc in inc_data.incidents:
        str_data={}
        for k, v in inc.extra_info.items():
            str_data[k]=list(v)
            
        rts=[]
        for rt in inc.reference_texts:
            rt_info='%s/%s' % (rt.language, rt.name)
            rts.append(rt_info)
        key='%s/%s' % (inc.incident_type, inc.wdt_id)
        inc2doc[key]=rts
        inc2str[key]=str_data

print(inc2doc)
print(inc2str)

with open(inc2doc_file, 'w') as f:
    json.dump(inc2doc, f)
with open(inc2str_file, 'w') as f:
    json.dump(inc2str, f)
