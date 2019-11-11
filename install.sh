#!/usr/bin/env bash

rm -f scripts/spacy_to_naf.py
wget https://raw.githubusercontent.com/cltl/SpaCy-to-NAF/master/spacy_to_naf.py
mv spacy_to_naf.py scripts/

for f in classes config 
do
    rm -f "scripts/${f}.py"
    wget --no-check-certificate --no-cache --no-cookies https://raw.githubusercontent.com/cltl/multilingual-wiki-event-pipeline/master/${f}.py
    mv "${f}.py" scripts/
done

