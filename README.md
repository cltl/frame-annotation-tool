# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

### Installation

To install all the needed packages, please run `npm install`. This will install all dependencies listed in `package.json`.

Also, run `bash install.sh` to download additional files.

### Starting the server

To start the server, simply run `node frame.js` or `npm start`.

### Directory structure

* `frame.js` is the main Node.js server file.
* the folder `public` contains all static code (HTML, Javascript) and static files to be served (images and PDF files).
* the filder `data` contains the input data for the tool. Specifically, it contains all the *.bin files and a `naf` folder that contains the NAF files. It also contains the `inc2doc_index.json` file that we create with the `scripts/`.
* `scripts` has loading scripts that prepare the data for the tool.
* the tool documentation can be found in `docs`.

### Reloading the data

Reloading the tool data requires four steps:
1. Re-create the .bin files and move them to `data/` (remove the old ones first if the event types are different)
2. Re-create the .naf files and move them to `data/naf' (remove the old ones first)
3. Run the script in `scripts/create_indices.py`.
4. [optionally] remove the old data in `annotation`

### Acknowledgements

Some functionality was copied from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

### Contact
Filip Ilievski (f.ilievski@vu.nl)

Vrije Universiteit Amsterdam
