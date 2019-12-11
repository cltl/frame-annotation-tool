# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

### Installation

To install all the needed packages, please run `npm install`. This will install all dependencies listed in `package.json`.

Other things needed for the tool to work (if you don't know how to get these, contact Filip or Piek):
* The `data` folder should be in this directory and contain a subfolder `json`. 
* There should be an authentication file `allowed.json` that contains the users and their passwords as key-value pairs. 

*That should be it ;)*

### Starting the server

To start the server, simply run `node frame.js` or `npm start`.

### Directory structure

* `frame.js` is the main Node.js server file.
* the folder `public` contains all static code (HTML, Javascript) and static files to be served (images and PDF files).
* the filder `data` contains the input data for the tool. Specifically, its `naf` subfolder contains the NAF files, whereas `data/json` contains several JSON indices. All of this data is created by [MWEP](https://github.com/cltl/multilingual-wiki-event-pipeline).
* the tool documentation can be found in `docs`.

### Reloading the data

Reloading the tool data requires three steps:
1. Run the `main.py` script from the [MWEP](https://github.com/cltl/multilingual-wiki-event-pipeline) project
2. Run the script `reload.sh` to update our data (.json and .naf) files with the new files created in step 1. Note: make sure you update the directories in the script to correspond to your local file structure.
3. [optionally] remove the old data in `annotation`

### Acknowledgements

Some functionality was reused from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

### Contact
Filip Ilievski (f.ilievski@vu.nl)

Vrije Universiteit Amsterdam
