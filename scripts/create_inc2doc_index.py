import glob
import pickle
import json
from collections import defaultdict

bin_dir='../data'
doc_dir='../data/naf'
outfile='%s/inc2doc_index.json' % bin_dir

inc2doc={}

for f in glob.glob('%s/*.bin' % bin_dir):
    with open(f, 'rb') as fl:
        inc_data=pickle.load(fl)
    for inc in inc_data.incidents:
        rts=[]
        for rt in inc.reference_texts:
            rt_info='%s/%s' % (rt.language, rt.name)
            rts.append(rt_info)
        key='%s/%s' % (inc.incident_type, inc.wdt_id)
        inc2doc[key]=rts
print(inc2doc)
with open(outfile, 'w') as f:
    json.dump(inc2doc, f)
