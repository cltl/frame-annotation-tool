#!/usr/bin/env bash

rm -f scripts/spacy_to_naf.py
wget https://raw.githubusercontent.com/cltl/SpaCy-to-NAF/master/spacy_to_naf.py

mv spacy_to_naf.py scripts/

rm -f scripts/classes.py
wget https://raw.githubusercontent.com/cltl/multilingual-wiki-event-pipeline/master/classes.py

mv classes.py scripts/
