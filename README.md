# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

### Installation

To install all the needed packages, please run `npm install`. This will install all dependencies listed in `package.json`.

*That should be it ;)*

### Starting the server

To start the server, simply run `node frame.js` or `npm start`.

### Directory structure

* `frame.js` is the main Node.js server file.
* the folder `public` contains all static code (HTML, Javascript) and static files to be served (images and PDF files).
* the filder `data` contains the input data for the tool. Specifically, its `naf` subfolder contains the NAF files, whereas `data/json` contains several JSON indices. All of this data is created by [MWEP](https://github.com/cltl/multilingual-wiki-event-pipeline).
* the tool documentation can be found in `docs`.

### Reloading the data

Reloading the tool data requires four steps:
1. Re-create the .naf files and move them to `data/naf' (remove the old ones first)
2. Re-create the .json files and move them to `data/json' (remove the old ones first)
3. [optionally] remove the old data in `annotation`

Steps 1 and 2 essentially require running of the `main.py` file from the [MWEP](https://github.com/cltl/multilingual-wiki-event-pipeline) project, and copying the resulting data to the directory `data` of this tool.

### Acknowledgements

Some functionality was reused from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

### Contact
Filip Ilievski (f.ilievski@vu.nl)

Vrije Universiteit Amsterdam
